import { keccak256 } from 'js-sha3';
import { AbiCoder } from '@ethersproject/abi';

/**
 * Look through an ABI definition to see if there is a function that matches the signature provided.
 * @param sig    a 0x-prefixed hex string containing 4 bytes of info
 * @param abi    a Solidity JSON ABI structure ([external link](https://docs.ethers.io/v5/api/utils/abi/formats/#abi-formats--solidity))
 * @returns      Buffer containing RLP-serialized array of calldata info to pass to signing request
 * @public
 */
export const parseSolidityJSONABI = function (
  sig: string,
  abi: any[],
): { def: EVMDef } {
  sig = coerceSig(sig);
  // Find the first match in the ABI
  const match = abi
    .filter((item) => item.type === 'function')
    .find((item) => {
      const def = parseDef(item);
      const funcSig = getFuncSig(def.canonicalName);
      return funcSig === sig;
    });
  if (match) {
    const def = parseDef(match).def;
    return { def };
  }
  throw new Error('Unable to find matching function in ABI');
};

/**
 * Convert a canonical name into an ABI definition that can be included with calldata to a general
 * "2", "2.1", "3")
 * @param sig    a 0x-prefixed hex string containing 4 bytes of info
 * @param name   canonical name of the function
 * @returns      Buffer containing RLP-serialized array of calldata info to pass to signing request
 * @public
 */
export const parseCanonicalName = function (sig: string, name: string) {
  sig = coerceSig(sig);
  if (sig !== getFuncSig(name)) {
    throw new Error('Name does not match provided sig.');
  }
  const def = [];
  // Get the function name
  const paramStart = name.indexOf('(');
  if (paramStart < 0) {
    throw new Error(BAD_CANONICAL_ERR);
  }
  def.push(name.slice(0, paramStart));
  name = name.slice(paramStart + 1);
  let paramDef = [];
  while (name.length > 1) {
    // scan until the terminating ')'
    const typeStr = popTypeStrFromCanonical(name);
    paramDef = paramDef.concat(parseTypeStr(typeStr));
    name = name.slice(typeStr.length + 1);
  }
  const parsedParamDef = parseParamDef(paramDef);
  return def.concat(parsedParamDef);
};

/**
 * Pull out nested calldata which may correspond to nested ABI definitions.
 * This is relevant for e.g. `multicall` patterns.
 * A def may be nested if the underlying type is `bytes` or `bytes[]` and
 * the calldata parm is of size (4 + 32*n).
 * @param def - calldata decoder data for a def
 * @param calldata - Buffer containing full calldata payload
 * @return -  Array of calldata params, or null values. If the return
 *            item has data (0x-prefixed hex string), it should be
 *            checked as a possible nested def
 */
export const getNestedCalldata = function (def, calldata) {
  const possibleNestedDefs = [];
  // Skip past first item, which is the function name
  const defParams = def.slice(1);
  const strParams = getParamStrNames(defParams);
  const coder = new AbiCoder();
  const decoded = coder.decode(
    strParams,
    '0x' + calldata.slice(4).toString('hex'),
  );
  function couldBeNestedDef(x) {
    return (x.length - 4) % 32 === 0;
  }
  decoded.forEach((paramData, i) => {
    if (isBytesType(defParams[i])) {
      let nestedDefIsPossible = true;
      if (isBytesArrItem(defParams[i])) {
        // `bytes[]` type. Decode all underlying `bytes` items and
        // do size checks on those.
        // NOTE: We only do this for `bytes[]` but could, in the future,
        // extend to more complex array structures if we see nested defs
        // in this pattern. However, we have only ever seen `bytes[]`, which
        // is typically used in `multicall` patterns
        paramData.forEach((nestedParamDatum) => {
          const nestedParamDatumBuf = Buffer.from(
            nestedParamDatum.slice(2),
            'hex',
          );
          if (!couldBeNestedDef(nestedParamDatumBuf)) {
            nestedDefIsPossible = false;
          }
        });
      } else if (isBytesItem(defParams[i])) {
        // Regular `bytes` type - perform size check
        const paramDataBuf = Buffer.from(paramData.slice(2), 'hex');
        nestedDefIsPossible = couldBeNestedDef(paramDataBuf);
      } else {
        // Unknown `bytes` item type
        nestedDefIsPossible = false;
      }
      // If the data could contain a nested def (determined based on
      // data size of the item), add the paramData to the return array.
      possibleNestedDefs.push(nestedDefIsPossible ? paramData : null);
    } else {
      // No nested defs for non-bytes types
      possibleNestedDefs.push(null);
    }
  });
  return possibleNestedDefs;
};

/**
 * If applicable, update decoder data to represent nested
 * definitions, which are used in e.g. multicall patterns.
 * This will update `def` in place and return it with any
 * additional info necessary.
 * @param def - Decoder data for a specific calldata function (def)
 * @param nestedDefs - Array containing a possible set of nested
 *                     defs which must be added to `def`
 * @return - Possibly modified version of `def`
 */
export const replaceNestedDefs = function (def, nestedDefs) {
  for (let i = 0; i < nestedDefs.length; i++) {
    const isArrItem = isBytesArrItem(def[1 + i]);
    const isItem = isBytesItem(def[1 + i]);
    if (nestedDefs[i] !== null && (isArrItem || isItem)) {
      // Update the def item type to indicate it will hold
      // one or more nested definitions
      def[1 + i][1] = EVM_TYPES.indexOf('nestedDef');
      // Add nested def(s) in in an array. If this is an array
      // item it means the nestedDefs should already be in an
      // array. Otherwise we need to wrap the single nested
      // def in an array to keep the data type consistent.
      const defs = isArrItem ? nestedDefs[i] : [nestedDefs[i]];
      def[1 + i] = def[1 + i].concat([defs]);
    }
  }
  return def;
};

/**
 * Convert a canonical name to a function selector (a.k.a. "sig")
 * @internal
 */
function getFuncSig(canonicalName: string): string {
  return `0x${keccak256(canonicalName).slice(0, 8)}`;
}

/**
 * Ensure the sig is properly formatted
 */
function coerceSig(sig: string): string {
  if (typeof sig !== 'string' || (sig.length !== 10 && sig.length !== 8)) {
    throw new Error('`sig` must be a hex string with 4 bytes of data.');
  }
  if (sig.length === 8) {
    sig = `0x${sig}`;
  }
  return sig;
}

/**
 * Convert calldata param definitions into an array of their
 * canonical string names.
 * Returns an array of string names that are consumable by
 * the @ethersproject/abi AbiCoder decoder instance.
 * @param defParams - Array of def params
 * @internal
 */
function getParamStrNames(defParams) {
  const strNames = [];
  for (let i = 0; i < defParams.length; i++) {
    const param = defParams[i];
    let s = EVM_TYPES[param[1]];
    if (param[2]) {
      s = `${s}${param[2] * 8}`;
    }
    if (param[3].length > 0) {
      param[3].forEach((d) => {
        if (param[3][d] === 0) {
          s = `${s}[]`;
        } else {
          s = `${s}[${param[3][d]}]`;
        }
      });
    }
    if (param[4]) {
      // Tuple - get nested type names
      const nested = getParamStrNames(param[4]);
      s = `${s}(${nested.join(',')})`;
    }
    strNames.push(s);
  }
  return strNames;
}

/**
 * Take the next type from a canonical definition string. Note that the string can be that of a
 * tuple. NOTE: The string should start at the index after the leading '('
 * @internal
 */
function popTypeStrFromCanonical(subName: string): string {
  if (isTuple(subName)) {
    return getTupleName(subName);
  } else if (subName.indexOf(',') > -1) {
    // Normal non-tuple param
    return subName.slice(0, subName.indexOf(','));
  } else if (subName.indexOf(')') > -1) {
    // Last non-tuple param in the name
    return subName.slice(0, subName.indexOf(')'));
  }
  throw new Error(BAD_CANONICAL_ERR);
}

/**
 * Parse a type string, e.g. 'uint256'. Converts the string to an array of EVMParamInfo, which may
 * have nested structure if there are tuples.
 * @internal
 */
function parseTypeStr(typeStr: string): any[] {
  // Non-tuples can be decoded without worrying about recursion
  if (!isTuple(typeStr)) {
    return [parseBasicTypeStr(typeStr)];
  }
  // Tuples may require recursion
  const param: EVMParamInfo = {
    szBytes: 0,
    typeIdx: EVM_TYPES.indexOf('tuple'),
    arraySzs: [],
  };
  // Get the full tuple param name and separate out the array stuff
  let typeStrLessArr = getTupleName(typeStr, false);
  const typeStrArr = typeStr.slice(typeStrLessArr.length);
  param.arraySzs = getArraySzs(typeStrArr);
  // Slice off the leading paren
  typeStrLessArr = typeStrLessArr.slice(1);
  // Parse each nested param
  let paramArr = [];
  while (typeStrLessArr.length > 0) {
    const subType = popTypeStrFromCanonical(typeStrLessArr);
    typeStrLessArr = typeStrLessArr.slice(subType.length + 1);
    paramArr = paramArr.concat(parseTypeStr(subType));
  }
  // There must be at least one sub-param in the tuple
  if (!paramArr.length) {
    throw new Error(BAD_CANONICAL_ERR);
  }
  return [param, paramArr];
}

/**
 * Convert a basic type (e.g. 'uint256') from a string to EVMParamInfo type.
 * @internal
 */
function parseBasicTypeStr(typeStr: string): EVMParamInfo {
  const param: EVMParamInfo = {
    szBytes: 0,
    typeIdx: 0,
    arraySzs: [],
  };
  let found = false;
  EVM_TYPES.forEach((t, i) => {
    if (typeStr.indexOf(t) > -1 && !found) {
      param.typeIdx = i;
      param.arraySzs = getArraySzs(typeStr);
      const arrStart =
        param.arraySzs.length > 0 ? typeStr.indexOf('[') : typeStr.length;
      const typeStrNum = typeStr.slice(t.length, arrStart);
      if (parseInt(typeStrNum)) {
        param.szBytes = parseInt(typeStrNum) / 8;
        if (param.szBytes > 32) {
          throw new Error(BAD_CANONICAL_ERR);
        }
      }
      found = true;
    }
  });
  if (!found) {
    throw new Error(BAD_CANONICAL_ERR);
  }
  return param;
}

/**
 * Parse an Etherscan definition into a calldata structure that the Lattice EVM decoder can handle
 * (EVMDef). This function may recurse if there are tuple types.
 * @internal
 */
function parseDef(
  item,
  canonicalName = '',
  def = [],
  recursed = false,
): EVMDef {
  // Function name. Can be an empty string.
  if (!recursed) {
    const nameStr = item.name || '';
    def.push(nameStr);
    canonicalName += nameStr;
  }
  // Loop through params
  if (item.inputs) {
    canonicalName += '(';
    item.inputs.forEach((input) => {
      // Convert the input to a flat param that we can serialize
      const flatParam = getFlatParam(input);
      if (input.type.indexOf('tuple') > -1 && input.components) {
        // For tuples we need to recurse
        const recursed = parseDef(
          { inputs: input.components },
          canonicalName,
          [],
          true,
        );
        canonicalName = recursed.canonicalName;
        // Add brackets if this is a tuple array and also add a comma
        canonicalName += `${input.type.slice(5)},`;
        flatParam.push(recursed.def);
      } else {
        canonicalName += input.type;
        canonicalName += ',';
      }
      def.push(flatParam);
    });
    // Take off the last comma. Note that we do not want to slice if the last param was a tuple,
    // since we want to keep that `)`
    if (canonicalName[canonicalName.length - 1] === ',') {
      canonicalName = canonicalName.slice(0, canonicalName.length - 1);
    }
    // Add the closing parens
    canonicalName += ')';
  }
  return { def, canonicalName };
}

/**
 * Convert a set of EVMParamInfo objects into an array that can be serialized into decoder info that
 * can be passed with the signing request. NOTE: We do not know parameter names, so we just number
 * them
 * @internal
 */
function parseParamDef(def: any[], prefix = ''): any[] {
  const parsedDef = [];
  let numTuples = 0;
  def.forEach((param, i) => {
    if (Array.isArray(param)) {
      // Arrays indicate nested params inside a tuple and always come after the initial tuple type
      // info. Recurse to parse nested tuple params and append them to the most recent.
      parsedDef[parsedDef.length - 1].push(parseParamDef(param, `${i}-`));
    } else {
      // If this is not tuple info, add the flat param info to the def
      parsedDef.push([
        `#${prefix}${i + 1 - numTuples}`,
        param.typeIdx,
        param.szBytes,
        param.arraySzs,
      ]);
    }
    // Tuple
    if (param.typeIdx === EVM_TYPES.indexOf('tuple')) {
      numTuples += 1;
    }
  });
  return parsedDef;
}

/**
 * Convert a param into an EVMParamInfo object before flattening its data into an array.
 * @internal
 */
function getFlatParam(input): any[] {
  if (!input.type) {
    throw new Error('No type in input');
  }
  const param = [input.name];
  const { typeIdx, szBytes, arraySzs } = getParamTypeInfo(input.type);
  param.push(typeIdx);
  param.push(szBytes);
  param.push(arraySzs);
  return param;
}

/**
 * Convert a param type string into an EVMParamInfo object with attributes:
 * 1. paramName -     name of the parameter. This piece of data is unverified, so it will display
 *                    differently if the user has the function saved in secure storage.
 * 2. paramType -     basic type of param. Firmware has an enum with 7 values.
 * 3. paramSzBytes -  number of bytes representing this param. Only certain types can have nonzero
 *                    value for this. For example, a `uint` with a 4 in this slot would be uint32
 *                    (8*4 = 32). Maximum number of bytes is always 32 because these types can only
 *                    be used in single 32 byte words.
 * @internal
 */
function getParamTypeInfo(type: string): EVMParamInfo {
  const param: EVMParamInfo = {
    szBytes: 0,
    typeIdx: 0,
    arraySzs: [],
  };
  let baseType;
  EVM_TYPES.forEach((t, i) => {
    if (type.indexOf(t) > -1 && !baseType) {
      baseType = t;
      param.typeIdx = i;
    }
  });
  // Get the array size, if any
  param.arraySzs = getArraySzs(type);
  // Determine where to search for expanded size
  const szIdx = param.arraySzs.length > 0 ? type.indexOf('[') : type.length;
  if (['uint', 'int', 'bytes'].indexOf(baseType) > -1) {
    // If this can have a fixed size, capture that
    const szBits = parseInt(type.slice(baseType.length, szIdx)) || 0;
    if (szBits > 256) {
      throw new Error('Invalid param size');
    }
    param.szBytes = szBits / 8;
  } else {
    // No fixed size in the type
    param.szBytes = 0;
  }
  return param;
}

/**
 * Determine the dimensions of an array type. These dimensions can be either fixed or variable size.
 * Returns an array of sizes. Ex: uint256[][] -> [0, 0], uint256[1][3] -> [1, 3], uint256 -> []
 * @internal
 */
function getArraySzs(type: string): number[] {
  if (typeof type !== 'string') {
    throw new Error('Invalid type');
  }
  const szs = [];
  let t1 = type;
  while (t1.length > 0) {
    const openIdx = t1.indexOf('[');
    if (openIdx < 0) {
      return szs;
    }
    const t2 = t1.slice(openIdx);
    const closeIdx = t2.indexOf(']');
    if (closeIdx < 0) {
      throw new Error('Bad param type');
    }
    const t3 = t2.slice(1, closeIdx);
    if (t3.length === 0) {
      // Variable size
      szs.push(0);
    } else {
      // Fixed size
      szs.push(parseInt(t3));
    }
    t1 = t2.slice(closeIdx + 1);
  }
  return szs;
}

/** @internal */
function getTupleName(name, withArr = true) {
  let brackets = 0,
    addedFirstBracket = false;
  for (let i = 0; i < name.length; i++) {
    if (name[i] === '(') {
      brackets += 1;
      addedFirstBracket = true;
    } else if (name[i] === ')') {
      brackets -= 1;
    }
    let canBreak =
      name[i + 1] === ',' || name[i + 1] === ')' || i === name.length - 1;
    if (!withArr && name[i + 1] === '[') {
      canBreak = true;
    }
    if (!brackets && addedFirstBracket && canBreak) {
      return name.slice(0, i + 1);
    }
  }
  throw new Error(BAD_CANONICAL_ERR);
}

/** @internal */
function isTuple(type: string): boolean {
  return type[0] === '(';
}

/** @internal */
function isBytesType(param) {
  return EVM_TYPES[param[1]] === 'bytes';
}
function isBytesItem(param) {
  return isBytesType(param) && param[3].length === 0;
}
function isBytesArrItem(param) {
  return isBytesType(param) && param[3].length === 1 && param[3][0] === 0;
}

const BAD_CANONICAL_ERR = 'Could not parse canonical function name.';
const EVM_TYPES = [
  null,
  'address',
  'bool',
  'uint',
  'int',
  'bytes',
  'string',
  'tuple',
  'nestedDef',
];

type EVMParamInfo = {
  szBytes: number;
  typeIdx: number;
  arraySzs: number[];
};

type EVMDef = {
  canonicalName: string;
  def: any;
};
