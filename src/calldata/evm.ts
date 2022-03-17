import { Buffer } from 'buffer/';
import { keccak256 } from 'js-sha3';
import { encode } from 'rlp';

/**
* Look through the response of an Etherescan ABI request to see
* if there is a function that matches the signature provided.
* @param sig    a 0x-prefixed hex string containing 4 bytes of info
* @param resp   the response of Etherscan's `getabi` API call
* @returns      Buffer containing RLP-serialized array of 
*               calldata info to pass to signing request
*/ 
export const searchEtherscanAbiDef = function(sig, resp): Buffer {
  if (typeof sig !== 'string' || (sig.length !== 10 && sig.length !== 8)) {
    throw new Error('`sig` must be a hex string with 4 bytes of data.')
  }
  if (sig.length === 8) {
    sig = `0x${sig}`;
  }
  if (typeof resp === 'string') {
    resp = JSON.parse(resp);
  }
  const abiData = JSON.parse(resp.result);
  let match = null;
  abiData.forEach((item) => {
    const def = parseDef(item);
    if (def) {
      // If this matches the function selector (sig) we can return it
      const defSig = `0x${keccak256(def.canonicalName).slice(0, 8)}`;
      if (def && defSig === sig) {
        match = def.def;
      }
    }
  })
  if (match) {
    console.log(JSON.stringify(match, null, 2))
    return Buffer.from(encode(match));
  }
  return null;
}

// Parse an Etherscan definition into a calldata structure that the 
// Lattice EVM decoder can handle. Returns a `def` of structure
// [ 
//    [ param1Name, param1Type, param1Sz ],
//    [ param2Name, param2Type, param2Sz ],
//    ...
// ]
function parseDef(item): EVMDef {
  // Skip non-functions
  if (item.type !== 'function') {
    return;
  }
  return __parseDef(item, '', []);
}

function __parseDef(item, canonicalName, def=[], recursed=false): EVMDef {
  // Function name. Can be an empty string.
  if (!recursed) {
    const nameStr = item.name || '';
    def.push(nameStr)
    canonicalName += nameStr;
  }
  // Loop through params
  if (item.inputs) {
    canonicalName += '(';
    item.inputs.forEach((input) => {
      const parsedParam = _parseParam(input);
      if (input.type.indexOf('tuple') > -1 && input.components) {
        // For tuples we need to recurse
        const recursed = __parseDef(
          { inputs: input.components }, canonicalName, [], true
        );
        canonicalName = recursed.canonicalName;
        // Add brackets if this is a tuple array and also add
        // a comma
        canonicalName += `${input.type.slice(5)},`
        parsedParam.push(recursed.def);
      } else {
        canonicalName += input.type;
        canonicalName += ',';
      }
      def.push(parsedParam);
    })
    // Take off the last comma. Note that we do not want to slice
    // if the last param was a tuple, since we want to keep that `)`
    if (canonicalName[canonicalName.length - 1] === ',') {
      canonicalName = canonicalName.slice(0, canonicalName.length - 1);
    }
    // Add the closing parens
    canonicalName += ')';
  }
  return { def, canonicalName };
}


// Build an array of the following:
// [ paramName, paramType, paramSzBytes, ...]
// * paramName - name of the parameter. This piece of data is unverified,
//   so it will display differently if the user has the function saved
//   in secure storage.
// * paramType - basic type of param. Firmware has an enum with 7 values.
// * paramSzBytes - number of bytes representing this param. Only certain
//   types can have nonzero value for this. For example, a `uint` with 
//   a 4 in this slot would be uint32 (8*4 = 32). Maximum number of bytes
//   is always 32 because these types can only be used in single 32 byte words.
function _parseParam(input) {
  if (!input.type) {
    throw new Error('No type in input');
  }
  const param = [ input.name ];
  const { typeIdx, szBytes, arraySzs} = _getParamTypeInfo(input.type);
  param.push(typeIdx);
  param.push(szBytes);
  param.push(arraySzs);
  return param;
}

function _getParamTypeInfo(type): EVMParamInfo {
  const TYPES = {
    'address': 1, 'bool': 2, 'uint': 3, 'int': 4, 
    'bytes': 5, 'string': 6, 'tuple': 7,
  };
  const param: EVMParamInfo = {
    szBytes: 0,
    typeIdx: 0,
    arraySzs: [],
  };
  let baseType;
  Object.keys(TYPES).forEach((k) => {
    if (type.indexOf(k) > -1 && !baseType) {
      baseType = k;
      param.typeIdx = TYPES[k];
    }
  })
  // Get the array size, if any
  param.arraySzs = _getArraySzs(type);
  // Determine where to search for expanded size
  const szIdx = param.arraySzs.length > 0 ?
                type.indexOf('[') :
                type.length;
  if (['uint', 'int', 'bytes'].indexOf(baseType) > -1) {
    // If this can have a fixed size, capture that
    const szBits = parseInt(
      type.slice(baseType.length, szIdx)
    ) || 0;
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

// Determine the dimensions of an array type. These dimensions can
// be either fixed or variable size. Returns an array of sizes.
// Ex: uint256[][] -> [0, 0], uint256[1][3] -> [1, 3], uint256 -> []
function _getArraySzs(type): number[] {
  if (typeof type !== 'string') {
    throw new Error('Invalid type')
  }
  const szs = [];
  let t1 = type;
  while (t1.length > 0) {
    const openIdx = t1.indexOf('[')
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

type EVMParamInfo = {
  szBytes: number;
  typeIdx: number;
  arraySzs: number[];
}

type EVMDef = {
  canonicalName: string;
  def: any;
}