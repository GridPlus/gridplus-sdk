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

export function convertDecoderToEthers(def: unknown[]) {
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
function getConvertedDef(def: unknown[]) {
  const converted: { type: string | null; data: unknown }[] = [];
  def.forEach((param: unknown) => {
    const p = param as { toString: (fmt: string) => string }[];
    const arrSzs = p[3] as { toString: (fmt: string) => string }[];
    const evmType = EVM_TYPES[Number.parseInt(p[1].toString('hex'), 16)];
    let type = evmType;
    const numBytes = Number.parseInt(p[2].toString('hex'), 16);
    if (numBytes > 0) {
      type = `${type}${numBytes * 8}`;
    }
    // Handle tuples by recursively generating data
    let tupleData: unknown[] | undefined;
    if (evmType === 'tuple') {
      tupleData = [];
      type = `${type}(`;
      const tupleDef = getConvertedDef(p[4] as unknown[]);
      tupleDef.forEach((tupleParam) => {
        type = `${type}${tupleParam.type}, `;
        tupleData?.push(tupleParam.data);
      });
      type = type.slice(0, type.length - 2);
      type = `${type})`;
    }
    // Get the data of a single function (i.e. excluding arrays)
    const funcData = tupleData ? tupleData : genParamData(p);
    // Apply the data to arrays
    for (let i = 0; i < arrSzs.length; i++) {
      const sz = Number.parseInt(arrSzs[i].toString('hex'));
      if (Number.isNaN(sz)) {
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
      converted.push({ type, data: getArrayData(p, funcData) });
    } else {
      converted.push({ type, data: funcData });
    }
  });
  return converted;
}

function genTupleData(tupleParam: unknown[]) {
  const nestedData: unknown[] = [];
  tupleParam.forEach((nestedParam: unknown) => {
    const np = nestedParam as { toString: (fmt: string) => string }[];
    nestedData.push(
      genData(EVM_TYPES[Number.parseInt(np[1].toString('hex'), 16)] ?? '', np),
    );
  });
  return nestedData;
}

function genParamData(param: { toString: (fmt: string) => string }[]) {
  const evmType =
    EVM_TYPES[Number.parseInt(param[1].toString('hex'), 16)] ?? '';
  const baseData = genData(evmType, param);
  return getArrayData(param, baseData);
}

function getArrayData(
  param: { toString: (fmt: string) => string }[],
  baseData: unknown,
) {
  let arrayData: unknown[] | undefined;
  let data: unknown;
  const arrSzs = param[3] as unknown as { toString: (fmt: string) => string }[];
  for (let i = 0; i < arrSzs.length; i++) {
    // let sz = parseInt(arrSzs[i].toString('hex')); TODO: fix this
    const dimData: unknown[] = [];
    let sz = Number.parseInt(
      (param[3] as unknown as { toString: (fmt: string) => string }[])[
        i
      ].toString('hex'),
    );
    if (Number.isNaN(sz)) {
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

function genData(type: string, param: { toString: (fmt: string) => string }[]) {
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
      return genTupleData(param[4] as unknown[]);
    default:
      throw new Error('Unrecognized type');
  }
}
