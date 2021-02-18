require('it-each')({ testPerIteration: true });
const _ = require('lodash');
// Use bn.js here instead of bignumber because it is compatable with ethereumjs-abi
const BN = require('bn.js'); 
const constants = require('./../src/constants');
const abi = require('./../src/ethereumAbi');
const randomWords = require('random-words');
const crypto = require('crypto');
const ethers = require('ethers');
const expect = require('chai').expect;
const helpers = require('./testUtil/helpers');
const question = require('readline-sync').question;
const seedrandom = require('seedrandom');

const encoder = new ethers.utils.AbiCoder;
const numIter = process.env.N || 20;
const prng = new seedrandom(process.env.SEED || 'myrandomseed');
//---------------------------------------
// STATE DATA
//---------------------------------------
let client = null;
let caughtErr = null;

// Definitions and indices (the latter are used with it.each and must be defined at the
// top of the file).
// Boundary conditions are tested with `boundaryAbiDefs` and random definitions are
// filled into `abiDefs`.
const boundaryAbiDefs = [];
const boundaryIndices = [];
createBoundaryDefs();
const abiDefs = [];
const indices = [];
for (let i = 0; i < numIter; i++)
  indices.push({ i });
for (let i = 0; i < boundaryAbiDefs.length; i++)
  boundaryIndices.push({ i });

// Transaction params
const txData = {
  nonce: 0,
  gasPrice: 1200000000,
  gasLimit: 50000,
  to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
  value: 0,
  data: null
};
const req = {
  currency: 'ETH',
  data: {
    signerPath: [helpers.BTC_LEGACY_PURPOSE, helpers.ETH_COIN, constants.HARDENED_OFFSET, 0, 0],
    ...txData,
    chainId: 'rinkeby', // Can also be an integer
  }
}

//---------------------------------------
// INTERNAL HELPERS
//---------------------------------------
function generateName(numChars) {
  const words = randomWords({ min: 1, max: numChars/4, join: '_'})
  return words.slice(0, numChars);
}

function randInt(n) {
  return Math.floor(n * prng.quick());
}

function isNumType(type) {
  const numTypes = [
    'uint8', 'uint16', 'uint32', 'uint64', 'uint128', 'uint256', 'uint'
  ];
  return numTypes.indexOf(type) > -1;
}

function randNumVal(type) {
  switch (type) {
    case 'uint8':
      return '0x' + crypto.randomBytes(1).toString('hex')
    case 'uint16':
      return '0x' + crypto.randomBytes(randInt(2)).toString('hex')
    case 'uint24':
      return '0x' + crypto.randomBytes(randInt(3)).toString('hex')
    case 'uint32':
      return '0x' + crypto.randomBytes(randInt(4)).toString('hex')
    case 'uint64':
      return '0x' + crypto.randomBytes(randInt(8)).toString('hex')
    case 'uint128':
      return '0x' + crypto.randomBytes(randInt(16)).toString('hex')
    case 'uint256':
    case 'uint':
      return '0x' + crypto.randomBytes(randInt(32)).toString('hex')
      // return new BN(crypto.randomBytes(randInt(32)).toString('hex'), 16)
    default:
      throw new Error('Unsupported type: ', type)
  }
}

function randBool() {
  return randInt(2) > 0
}

function randAddress() {
  return `0x${crypto.randomBytes(20).toString('hex')}`;
}

function randBytes(type) {
  const fixedSz = parseInt(type.slice(5));
  if (isNaN(fixedSz)) {
    return crypto.randomBytes(randInt(100)); // up to 100 bytes of random data
  } else {
    return crypto.randomBytes(fixedSz); // Fixed number of bytes
  }
}

function randString() {
  return generateName(1+randInt(99)); // Up to a 100 character string
}

function getRandType() {
  const i = randInt(7);
  const uintArr = ['uint8', 'uint16', 'uint32', 'uint64', 'uint128', 'uint256', 'uint'];
  switch (i) {
    case 0:
      return 'address';
    case 1:
      return 'bool';
    case 2: // uint types
      return uintArr[randInt(uintArr.length)];
    case 3: // fixed bytes types (bytes1-31)
      return `bytes${1+ randInt(31)}`
    case 4: // bytes32 (this one is common so we want to give it moreweight)
      return 'bytes32';
    case 5:
      return 'bytes';
    case 6:
      return 'string';
  }
}

function genRandParam() {
  const type = getRandType();
  const d = {
    name: null,
    type,
    isArray: randBool(),
    arraySz: 0,
    latticeTypeIdx: constants.ETH_ABI_LATTICE_FW_TYPE_MAP[type],
  }
  if (d.isArray && randBool())
    d.arraySz = randInt(10);
  d.name = d.type;
  if (d.isArray) {
    d.name += '[';
    if (d.arraySz > 0)
      d.name += d.arraySz;
    d.name += ']';
  }
  return d;
}

function getTypeNames(params) {
  const typeNames = [];
  params.forEach((param) => {
    let typeName = param.type;
    if (param.isArray) {
      typeName += '[';
      if (param.arraySz > 0)
        typeName += param.arraySz;
      typeName += ']';
    }
    typeNames.push(typeName);
  });
  return typeNames
}

function genRandVal(type) {  
  if (isNumType(type))
    return randNumVal(type) || 0;
  else if (type === 'address')
    return randAddress();
  else if (type === 'bool')
    return randBool();
  else if (type === 'string')
    return randString();
  else if (type.slice(0, 5) === 'bytes')
    return randBytes(type);
  throw new Error('Unsupported type: ', type)
}

function buildEthData(def) {
  const encoded = encoder.encode(def._typeNames, def._vals);
  return `0x${def.sig}${encoded.slice(2)}`
}

function buildFuncSelector(def) {
  const repurposedData = {
    name: def.name,
    inputs: [],
  };
  for (let i = 0; i < def._typeNames.length; i++) {
    let type = def._typeNames[i];
    // Convert to canonical type, if needed
    if (type === 'uint' || type.indexOf('uint[') > -1)
      type = type.replace('uint', 'uint256');
    repurposedData.inputs.push({ type })
  }
  return abi.getFuncSig(repurposedData);
}

function createDef() {
  const def = {
    name: `function_${randInt(5000000)}`,
    sig: null,
    params: [],
    _vals: [],
  }
  const sz = randInt(10)
  for (let i = 0; i < sz; i++) {
    const param = genRandParam();
    def.params.push(param)
    if (param.isArray) {
      const val = [];
      const sz = param.arraySz === 0 ? Math.max(1, randInt(10)) : param.arraySz;
      for (let j = 0; j < sz; j++) {
        val.push(genRandVal(param.type))
      }
      def._vals.push(val);
    } else {
      def._vals.push(genRandVal(param.type));
    }
  }
  def._typeNames = getTypeNames(def.params);
  def.sig = buildFuncSelector(def);
  const data = helpers.ensureHexBuffer(buildEthData(def));
  // Make sure the transaction will fit in the firmware buffer size
  const fwConstants = constants.getFwVersionConst(client.fwVersion)
  if (data.length > fwConstants.ethMaxDataSz)
    return createDef();
  
  return def;
}

function createBoundaryDefs() {
  // Function with max of each type of uint
  function makeUintParam(type, val) {
    return { name: val.toString(), type: type, isArray: false, arraySz: 0, latticeTypeIdx: constants.ETH_ABI_LATTICE_FW_TYPE_MAP[type] }
  }
  let def = {
    name: 'UintMaxVals',
    sig: null,
    params: [
      makeUintParam('uint8', '255'), 
      makeUintParam('uint16', '65535'),
      makeUintParam('uint32', '4294967295'),
      makeUintParam('uint64', '1.8446744073709e+19'),
      makeUintParam('uint128', '3.4028236692093e+38'),
      makeUintParam('uint256', '11579208923731e+77')
    ],
    _vals: [
      '0xff',
      '0xffff',
      '0xffffffff',
      '0xffffffffffffffff',
      '0xffffffffffffffffffffffffffffffff',
      '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    ]
  };
  def._typeNames = getTypeNames(def.params);
  def.sig = buildFuncSelector(def);
  boundaryAbiDefs.push(def);
  // Min of each type of uint
  def = {
    name: 'UintMinVals',
    sig: null,
    params: [
      makeUintParam('uint8', '0'), 
      makeUintParam('uint16', '0'),
      makeUintParam('uint32', '0'),
      makeUintParam('uint64', '0'),
      makeUintParam('uint128', '0'),
      makeUintParam('uint256', '0')
    ],
    _vals: [
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00',
      '0x00'
    ]
  };
  def._typeNames = getTypeNames(def.params);
  def.sig = buildFuncSelector(def);
  boundaryAbiDefs.push(def);
  // Powers of 10
  def = {
    name: 'PowersOfTen',
    sig: null,
    params: [
      makeUintParam('uint8', '10'), 
      makeUintParam('uint16', '100'),
      makeUintParam('uint32', '10000'),
      makeUintParam('uint64', '100000000'),
      makeUintParam('uint128', '10000000000000000'),
      makeUintParam('uint256', '1+e32')
    ],
    _vals: [
      '0x0a',
      '0x64',
      '0x2710',
      '0x05f5e100',
      '0x2386f26fc10000',
      '0x04ee2d6d415b85acef8100000000',
    ]
  };
  def._typeNames = getTypeNames(def.params);
  def.sig = buildFuncSelector(def);
  boundaryAbiDefs.push(def);

  function makeParamSet(type) {
    return [
      { name: `${type}_0`, type: type, isArray: false, arraySz: 0, latticeTypeIdx: constants.ETH_ABI_LATTICE_FW_TYPE_MAP[type] },
      { name: `${type}_1`, type: type, isArray: true, arraySz: 2, latticeTypeIdx: constants.ETH_ABI_LATTICE_FW_TYPE_MAP[type] },
      { name: `${type}_2`, type: type, isArray: true, arraySz: 0, latticeTypeIdx: constants.ETH_ABI_LATTICE_FW_TYPE_MAP[type] },
    ]
  }

  // bool, bool array (fixed), bool array (variable)
  def = {
    name: 'BooleanFiesta',
    sig: null,
    params: makeParamSet('bool'),
    _vals: [true, [false, true], [false, false, false, false, true, false]]
  };
  def._typeNames = getTypeNames(def.params);
  def.sig = buildFuncSelector(def);
  boundaryAbiDefs.push(def);

  // address, address array (fixed), address array (variable)
  def = {
    name: 'AddressesGalore',
    sig: null,
    params: makeParamSet('address'),
    _vals: [
      '0x0e9b7a0cfe43b6606be603a9a8b9335de93bace6',
      ['0x26c6d7ee87cf88537e423a443b3613cbb03b5072', '0xaea00d99767f52070b7757dec267fc3c362713d4'],
      ['0x4fd5c3ca2a9edbdb180349530bed84330cc08436']
    ]
  };
  def._typeNames = getTypeNames(def.params);
  def.sig = buildFuncSelector(def);
  boundaryAbiDefs.push(def);

  // bytes, bytes array (fixed), bytes array (variable)
  def = {
    name: 'BytesDump',
    sig: null,
    params: makeParamSet('bytes'),
    _vals: [
      Buffer.from('9df1', 'hex'), 
      [Buffer.from('70dab2213dc5a9', 'hex'), Buffer.from('0f472b', 'hex')],
      [Buffer.from('cc', 'hex')]
    ]
  };
  def._typeNames = getTypeNames(def.params);
  def.sig = buildFuncSelector(def);
  boundaryAbiDefs.push(def);

  // string, string array (fixed), string array (variable)
  def = {
    name: 'StringQuartet',
    sig: null,
    params: makeParamSet('string'),
    _vals: [
      'one', 
      ['twoone', 'twotwo'],
      ['three']
    ]
  };
  def._typeNames = getTypeNames(def.params);
  def.sig = buildFuncSelector(def);
  boundaryAbiDefs.push(def);
}

//---------------------------------------
// TESTS
//---------------------------------------
describe('Setup client', () => {
  it('Should setup the test client', () => {
    client = helpers.setupTestClient(process.env);
    expect(client).to.not.equal(null);
  })

  it('Should connect to a Lattice and make sure it is already paired.', async () => {
    // Again, we assume that if an `id` has already been set, we are paired
    // with the hardcoded privkey above.
    expect(process.env.DEVICE_ID).to.not.equal(null);
    const connectErr = await helpers.connect(client, process.env.DEVICE_ID);
    expect(connectErr).to.equal(null);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);
  });
})

describe('Preloaded ABI definitions', () => {
  it('Should test preloaded ERC20 ABI defintions', async () => {
    const erc20PreloadedDefs = [
      {
        name: 'approve',
        sig: null,
        params: [ 
          { name: 'spender', type: 'address', isArray: false, arraySz: 0, latticeTypeIdx: constants.ETH_ABI_LATTICE_FW_TYPE_MAP['address']},
          { name: 'value', type: 'uint256', isArray: false, arraySz: 0, latticeTypeIdx: constants.ETH_ABI_LATTICE_FW_TYPE_MAP['uint256']},
        ],
        _vals: [
          '0x2a4e921a7da4d381d84c51fe466ff7288bf2ce41',
          10000,
        ]
      },
      {
        name: 'transferFrom',
        sig: null,
        params: [ 
          { name: 'from', type: 'address', isArray: false, arraySz: 0, latticeTypeIdx: constants.ETH_ABI_LATTICE_FW_TYPE_MAP['address']},
          { name: 'to', type: 'address', isArray: false, arraySz: 0, latticeTypeIdx: constants.ETH_ABI_LATTICE_FW_TYPE_MAP['address']},
          { name: 'value', type: 'uint256', isArray: false, arraySz: 0, latticeTypeIdx: constants.ETH_ABI_LATTICE_FW_TYPE_MAP['uint256']},
        ],
        _vals: [
          '0x57974eb88e50cc61049b44e43e90d3bc40fa61c0',
          '0x39b657f4d86119e11de818e477a31c13feeb618c',
          9999,
        ]
      },
      {
        name: 'transfer',
        sig: null,
        params: [ 
          { name: 'to', type: 'address', isArray: false, arraySz: 0, latticeTypeIdx: constants.ETH_ABI_LATTICE_FW_TYPE_MAP['address']},
          { name: 'value', type: 'uint256', isArray: false, arraySz: 0, latticeTypeIdx: constants.ETH_ABI_LATTICE_FW_TYPE_MAP['uint256']},
        ],
        _vals: [
          '0x39b657f4d86119e11de818e477a31c13feeb618c',
          1234,
        ]
      }
    ];
    erc20PreloadedDefs.forEach((def) => {
      def._typeNames = getTypeNames(def.params);
      def.sig = buildFuncSelector(def);
    })

    try {
      const approveDef = erc20PreloadedDefs[0]; 
      req.data.data = helpers.ensureHexBuffer(buildEthData(approveDef));
      await helpers.sign(client, req);
    } catch (err) {
      caughtErr = 'Failed to markdown ERC20 approval def.';
      expect(err).to.equal(null);
    }
    try {
      const transfer = erc20PreloadedDefs[1]; 
      req.data.data = helpers.ensureHexBuffer(buildEthData(transfer));
      await helpers.sign(client, req);
    } catch (err) {
      caughtErr = 'Failed to markdown ERC20 transfer def.';
      expect(err).to.equal(null);
    }
    try {
      const transferFrom = erc20PreloadedDefs[2]; 
      req.data.data = helpers.ensureHexBuffer(buildEthData(transferFrom));
      await helpers.sign(client, req);
    } catch (err) {
      caughtErr = 'Failed to markdown ERC20 transferFrom def.';
      expect(err).to.equal(null);
    }
  })
})

describe('Add ABI definitions', () => {
  beforeEach(() => {
    expect(caughtErr).to.equal(null, 'Error found in prior test. Aborting.');
  })

  it(`Should generate and add ${numIter} ABI definitions to the Lattice`, async () => {
    try {
      for (let iter = 0; iter < numIter; iter++) {
        const def = createDef();
        abiDefs.push(def);
      }
    } catch (err) {
      caughtErr = err.toString();
      expect(err).to.equal(null, err);
    }
  })

  it('Should add the ABI definitions', async () => {
    try {
      await helpers.addAbi(client, boundaryAbiDefs.concat(abiDefs));
    } catch (err) {
      caughtErr = err;
      expect(err).to.equal(null, err);
    }
  })
})

describe('Test ABI Markdown', () => {
  beforeEach(() => {
    expect(caughtErr).to.equal(null, 'Error found in prior test. Aborting.');
    req.data.data = null;
  })

  it('Should inform the user what to do', async () => {
    question('Please APPROVE all ABI-decoded payloads and REJECT all unformatted ones. Make sure the type matches the function name! Press enter.')
    expect(true).to.equal(true);
  })

  it('Failure checks: it should fail to decode when variable arraySz is 0', async () => {
    const bytesDef = _.cloneDeep(boundaryAbiDefs[5])
    bytesDef._vals[2] = [];
    req.data.data = buildEthData(bytesDef);
    try {
      await helpers.sign(client, req);
      caughtErr = 'Transaction should have been rejected but was not.';
    } catch (err) {
      expect(err).to.not.equal(null, caughtErr);
    }
  })

  it('Failure checks: it should fail to decode when dynamic param has size 0', async () => {
    const bytesDef = _.cloneDeep(boundaryAbiDefs[5])
    bytesDef._vals[2] = [Buffer.from('')];

    req.data.data = buildEthData(bytesDef);
    try {
      await helpers.sign(client, req);
      caughtErr = 'Transaction should have been rejected but was not.';
    } catch (err) {
      expect(err).to.not.equal(null, caughtErr);
    }
  })

  it.each(boundaryIndices, 'Test ABI markdown of boundary conditions #%s', ['i'], async (n, next) => {
    const def = boundaryAbiDefs[n.i];
    req.data.data = buildEthData(def)
    try {
      const sigResp = await helpers.sign(client, req);
      expect(sigResp.tx).to.not.equal(null);
      expect(sigResp.txHash).to.not.equal(null);
      setTimeout(() => { next() }, 1000);
    } catch (err) {
      caughtErr = `Failed on tx #${n.i}: ${err.toString()}`;
      setTimeout(() => { next(err) }, 1000);
    }
  })

  it.each(indices, 'Test ABI markdown of payload #%s', ['i'], async (n, next) => {
    const def = abiDefs[n.i];
    req.data.data = buildEthData(def)
    try {
      const sigResp = await helpers.sign(client, req);
      expect(sigResp.tx).to.not.equal(null);
      expect(sigResp.txHash).to.not.equal(null);
      setTimeout(() => { next() }, 1000);
    } catch (err) {
      caughtErr = `Failed on tx #${n.i}: ${err.toString()}`;
      setTimeout(() => { next(err) }, 1000);
    }
  })

})
