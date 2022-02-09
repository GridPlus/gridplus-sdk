import { Buffer } from 'buffer/';
import { keccak256 } from 'js-sha3';
import { ETH_ABI_LATTICE_FW_TYPE_MAP } from './constants';
const NAME_MAX_SZ = 100;
const HEADER_SZ = 5 + NAME_MAX_SZ; // 4 byte sig + name + 1 byte param count
const CATEGORY_SZ = 32;
const PARAM_NAME_SZ = 20;
const PARAM_SZ = 26; // 20 byte name + 6 byte def
const MAX_PARAMS = 18;
export const MAX_ABI_DEFS = 2;
export const ABI_DEF_SZ = (HEADER_SZ + CATEGORY_SZ + (PARAM_SZ * MAX_PARAMS));

// Build a request to add ABI data
export const buildAddAbiPayload = function (defs) {
  if (!defs || !Array.isArray(defs)) throw new Error('Missing definitions.');
  if (defs.length > MAX_ABI_DEFS)
    throw new Error(
      `You may only add ${MAX_ABI_DEFS} ABI definitions per request.`
    );
  const b = Buffer.alloc(1 + (MAX_ABI_DEFS * ABI_DEF_SZ));
  let off = 0;
  b.writeUInt8(defs.length, off);
  off++;
  defs.forEach((def) => {
    if (!def.sig || !def.name || !def.params)
      throw new Error(
        'name, sig, and params must be present for every ABI definition.'
      );
    // -- Header data --
    const sig = Buffer.from(def.sig, 'hex');
    if (sig.length !== 4)
      throw new Error('Function signatures must always be four bytes.');
    sig.copy(b, off);
    off += sig.length;
    const name = Buffer.from(def.name);
    if (name.length > NAME_MAX_SZ - 1)
      // The -1 accounts for the null terminator
      throw new Error(
        `Only function names shorter than ${
          NAME_MAX_SZ - 1
        } characters are supported.`
      );
    Buffer.from(def.name).slice(0, NAME_MAX_SZ).copy(b, off);
    off += NAME_MAX_SZ;
    // Number of parameters
    const numParams = Array.isArray(def.params) ? def.params.length : 0;
    b.writeUInt8(numParams, off);
    off++;
    // -- (optional) Category name --
    if (def.category && typeof def.category === 'string') {
      const category = Buffer.from(def.category);
      if (category.length > CATEGORY_SZ - 1)
        // -1 accounts for null terminator
        throw new Error(
          `Category name must be shorter than ${CATEGORY_SZ - 1}. Got ${
            category.length
          }`
        );
      category.copy(b, off);
    }
    off += CATEGORY_SZ;
    // -- Param data --
    if (numParams > MAX_PARAMS)
      throw new Error(
        'Currently only ABI defintions with <=10 parameters are supported.'
      );
    if (numParams > 0) {
      // First copy param names
      def.params.forEach((param) => {
        if (
          param.name === undefined ||
          param.latticeTypeIdx === undefined ||
          param.isArray === undefined ||
          param.arraySz === undefined
        )
          throw new Error(
            'name, latticeTypeIdx, isArray, and arraySz must be defined for all ABI params.'
          );
        Buffer.from(param.name).slice(0, PARAM_NAME_SZ).copy(b, off); 
        off += PARAM_NAME_SZ;
      });
      // Bump offset to account for blank param slots
      off += PARAM_NAME_SZ * (MAX_PARAMS - numParams);
      // Next copy the definitions
      def.params.forEach((param) => {
        b.writeUInt8(param.latticeTypeIdx, off);
        off++;
        b.writeUInt8(param.isArray ? 1 : 0, off);
        off++;
        b.writeUInt32LE(param.arraySz, off);
        off += 4;
      });
      // Bump offset again
      off += 6 * (MAX_PARAMS - numParams);
    } else {
      // If there are no params, just bump the offset
      off += PARAM_SZ * MAX_PARAMS;
    }
  });
  return b;
};

// Get the 4-byte function identifier based on the canonical name
export const getFuncSig = function (f) {
  // Canonical name is:
  // funcName(paramType0, ..., paramTypeN)
  let canonicalName = `${f.name}(`;
  f.inputs.forEach((input) => {
    if (input.type.indexOf('tuple') > -1) {
      const arrSuffix = input.type.slice(input.type.indexOf('tuple') + 5);
      canonicalName += '(';
      input.components.forEach((c, i) => {
        canonicalName += `${c.type}${
          i === input.components.length - 1 ? '' : ','
        }`;
      });
      canonicalName += `)${arrSuffix},`;
    } else {
      canonicalName += `${input.type},`;
    }
  });
  if (f.inputs.length > 0)
    canonicalName = canonicalName.slice(0, canonicalName.length - 1);
  canonicalName += ')';
  return keccak256(canonicalName).slice(0, 8);
};

export const unpackAbiDef = function(_def) {
  let off = 0;
  const def = { 
    header: {
      sig: '',
      name: '',
      numParam: 0,
    }, 
    category: '', 
    params: []
  };
  def.header.sig = '0x' + _def.slice(off, off + 4).toString('hex'); off += 4;
  def.header.name = _def.slice(off, off + NAME_MAX_SZ).toString().split('\x00')[0]; off += NAME_MAX_SZ;
  def.header.numParam = _def.readUInt8(off); off += 1;
  def.category = _def.slice(off, off + CATEGORY_SZ).toString().split('\x00')[0]; off += CATEGORY_SZ;
  // Get param names
  for (let i = 0; i < MAX_PARAMS; i++) {
    if (i < def.header.numParam) {
      const param = {
        name: '',
        type: 0,
        typeName: '',
        isArray: false,
        arraySz: 0,
      }
      param.name = _def.slice(off, off + PARAM_NAME_SZ).toString().split('\x00')[0];
      def.params.push(param);
    }
    off += PARAM_NAME_SZ;
  }
  function reverseFwTypeMap(typeIdx) {
    let typeName = null;
    Object.keys(ETH_ABI_LATTICE_FW_TYPE_MAP).forEach((key) => {
      if (ETH_ABI_LATTICE_FW_TYPE_MAP[key] === typeIdx) {
        typeName = key;
      }
    })
    return typeName;
  }
  // Get param info
  for (let i = 0; i < MAX_PARAMS; i++) {
    if (i < def.header.numParam) {
      def.params[i].type = _def.readUInt8(off); off += 1;

      def.params[i].typeName = reverseFwTypeMap(def.params[i].type);
      def.params[i].isArray = _def.readUInt8(off); off += 1;
      def.params[i].arraySz = _def.readUInt32LE(off); off += 4;
    }
  }
  return def;
}

//--------------------------------------
// PARSERS
//--------------------------------------
function parseEtherscanAbiDefs(_defs, skipErrors = false) {
  // `_defs` are `result` of the parsed response
  const defs = [];
  _defs.forEach((d) => {
    if (
      d.name &&
      d.inputs &&
      d.type === 'function' &&
      d.stateMutability !== 'view' &&
      d.constant !== true
    ) {
      try {
        const sig = getFuncSig(d);
        const params = parseEtherscanAbiInputs(d.inputs);
        defs.push({
          name: d.name,
          sig,
          params,
        });
      } catch (err) {
        if (skipErrors === true)
          console.error('Failed to load def:', d.name, err.toString());
        else throw new Error(err);
      }
    }
  });
  return defs;
}

export const abiParsers = {
  etherscan: parseEtherscanAbiDefs,
};

//--------------------------------------
// HELPERS
//--------------------------------------
// Parse the ABI param data into structs Lattice firmware will recognize.
function parseEtherscanAbiInputs(inputs, data = [], isNestedTuple = false) {
  let tupleParams = [];
  inputs.forEach((input) => {
    const typeName = input.type;
    const d: any = { isArray: false, arraySz: 0, name: input.name };
    const openBracketIdx = typeName.indexOf('[');
    const closeBracketIdx = typeName.indexOf(']');
    const isMultiDim = typeName.split('[').length > 2;
    if (isMultiDim) {
      throw new Error(
        'Skipping function with unsupported multidimensional array type'
      );
    } else {
      if (openBracketIdx > -1 && closeBracketIdx > -1) {
        if (openBracketIdx >= closeBracketIdx) {
          // not a valid param -- skip it
        } else if (openBracketIdx + 1 === closeBracketIdx) {
          d.isArray = true;
        } else {
          // Parse the array size if applicable
          const number = parseInt(
            typeName.slice(openBracketIdx + 1, closeBracketIdx)
          );
          if (isNaN(number)) {
            return d;
          }
          d.isArray = true;
          d.arraySz = number;
        }
      }
      let singularTypeName =
        openBracketIdx > -1 ? typeName.slice(0, openBracketIdx) : typeName;
      if (singularTypeName === 'tuple') {
        if (isNestedTuple === true)
          throw new Error('Nested tuples are not supported');
        singularTypeName = `tuple${input.components.length}`;
        tupleParams = parseEtherscanAbiInputs(
          input.components,
          tupleParams,
          true
        );
      }
      d.latticeTypeIdx = getTypeIdxLatticeFw(singularTypeName);
      if (!d.latticeTypeIdx) throw new Error(`Unsupported type: ${typeName}`);
      data.push(d);
    }
  });
  const params = data.concat(tupleParams);
  if (params.length > 18)
    throw new Error(
      'Function has too many parameters for Lattice firmware (18 max)'
    );
  return data.concat(tupleParams);
}

// Enum values from inside Lattice firmware
function getTypeIdxLatticeFw(type) {
  return ETH_ABI_LATTICE_FW_TYPE_MAP[type];
}

export default {
  MAX_ABI_DEFS,
  buildAddAbiPayload,
  getFuncSig,
  abiParsers,
}
