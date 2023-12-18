const EVM_TYPES = [
  null,
  'address',
  'bool',
  'uint',
  'int',
  'bytes',
  'string',
  'tuple',
];

export function convertDecoderToEthers(def) {
  const converted = getConvertedDef(def);
  const types: any[] = [];
  const data: any[] = [];
  converted.forEach((i: any) => {
    types.push(i.type);
    data.push(i.data);
  });
  return { types, data };
}

// Convert an encoded def into a combination of ethers-compatable
// type names and data fields. The data should be random but it
// doesn't matter much for these tests, which mainly just test
// structure of the definitions
function getConvertedDef(def) {
  const converted: any[] = [];
  def.forEach((param) => {
    const arrSzs = param[3];
    const evmType = EVM_TYPES[parseInt(param[1].toString('hex'), 16)];
    let type = evmType;
    const numBytes = parseInt(param[2].toString('hex'), 16);
    if (numBytes > 0) {
      type = `${type}${numBytes * 8}`;
    }
    // Handle tuples by recursively generating data
    let tupleData;
    if (evmType === 'tuple') {
      tupleData = [];
      type = `${type}(`;
      const tupleDef = getConvertedDef(param[4]);
      tupleDef.forEach((tupleParam: any) => {
        type = `${type}${tupleParam.type}, `;
        tupleData.push(tupleParam.data);
      });
      type = type.slice(0, type.length - 2);
      type = `${type})`;
    }
    // Get the data of a single function (i.e. excluding arrays)
    const funcData = tupleData ? tupleData : genParamData(param);
    // Apply the data to arrays
    for (let i = 0; i < arrSzs.length; i++) {
      const sz = parseInt(arrSzs[i].toString('hex'));
      if (isNaN(sz)) {
        // This is a 0 size, which means we need to
        // define a size to generate data
        type = `${type}[]`;
      } else {
        type = `${type}[${sz}]`;
      }
    }
    // If this param is a tuple we need to copy base data
    // across all dimensions. The individual params are already
    // arraified this way, but not the tuple type
    if (tupleData) {
      converted.push({ type, data: getArrayData(param, funcData) });
    } else {
      converted.push({ type, data: funcData });
    }
  });
  return converted;
}

function genTupleData(tupleParam) {
  const nestedData: any = [];
  tupleParam.forEach((nestedParam) => {
    nestedData.push(
      genData(
        EVM_TYPES[parseInt(nestedParam[1].toString('hex'), 16)] ?? '',
        nestedParam,
      ),
    );
  });
  return nestedData;
}

function genParamData(param: any[]) {
  const evmType = EVM_TYPES[parseInt(param[1].toString('hex'), 16)] ?? '';
  const baseData = genData(evmType, param);
  return getArrayData(param, baseData);
}

function getArrayData(param: any, baseData: any) {
  let arrayData, data;
  const arrSzs = param[3];
  for (let i = 0; i < arrSzs.length; i++) {
    // let sz = parseInt(arrSzs[i].toString('hex')); TODO: fix this
    const dimData: any = [];
    let sz = parseInt(param[3][i].toString('hex'));
    if (isNaN(sz)) {
      sz = 2; //1;
    }
    if (!arrayData) {
      arrayData = [];
    }
    const lastDimData = JSON.parse(JSON.stringify(arrayData));
    for (let j = 0; j < sz; j++) {
      if (i === 0) {
        dimData.push(baseData);
      } else {
        dimData.push(lastDimData);
      }
    }
    arrayData = dimData;
  }
  if (!data) {
    data = arrayData ? arrayData : baseData;
  }
  return data;
}

function genData(type: string, param: any[]) {
  switch (type) {
    case 'address':
      return '0xdead00000000000000000000000000000000beef';
    case 'bool':
      return true;
    case 'uint':
      return 9;
    case 'int':
      return -9;
    case 'bytes':
      return '0xdeadbeef';
    case 'string':
      return 'string';
    case 'tuple':
      if (!param || param.length < 4) {
        throw new Error('Invalid tuple data');
      }
      return genTupleData(param[4]);
    default:
      throw new Error('Unrecognized type');
  }
}
