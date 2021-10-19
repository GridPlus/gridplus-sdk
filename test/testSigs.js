// Tests for validating deterministic signatures, which were introduced
// in Lattice firmware 0.12.0.
// This utilizes the Lattice's test harness to ensure signatures are 
// deterministic based on the loaded seed and message.
// To run these tests you will need a dev Lattice with: `FEATURE_TEST_RUNNER=1`
const bip32 = require('bip32');
const bip39 = require('bip39');
const ethutil = require('ethereumjs-util');
const expect = require('chai').expect;
const question = require('readline-sync').question;
const constants = require('./../src/constants');
const helpers = require('./testUtil/helpers');
const TEST_MNEMONIC = 'nose elder baby marriage frequent list ' +
                      'cargo swallow memory universe smooth involve ' + 
                      'iron purity throw vintage crew artefact ' +
                      'pyramid dash split announce trend grain';
const TEST_SEED = bip39.mnemonicToSeedSync(TEST_MNEMONIC);
let client, activeWalletUID, jobType, jobData, jobReq, latticeSeed=null, continueTests=true, txReq, msgReq;
const LEDGER_ROOT_PATH = [helpers.BTC_LEGACY_PURPOSE, helpers.ETH_COIN, constants.HARDENED_OFFSET, 0, 0]

async function runTestCase(expectedCode) {
    const res = await helpers.execute(client, 'test', jobReq);
    const parsedRes = helpers.parseWalletJobResp(res, client.fwVersion);
    expect(parsedRes.resultStatus).to.equal(expectedCode);
    if (parsedRes.resultStatus !== expectedCode)
      continueTests = false;
    return parsedRes;
}

function deriveAddress(seed, path) {
  const wallet = bip32.fromSeed(seed);
  let pathStr = 'm'
  path.forEach((idx) => {
    if (idx >= constants.HARDENED_OFFSET) {
      pathStr += `/${idx - constants.HARDENED_OFFSET}'`
    } else {
      pathStr += `/${idx}`
    }
  })
  const priv = wallet.derivePath(pathStr).privateKey;
  return `0x${ethutil.privateToAddress(priv).toString('hex')}`;
}

function _setupJob(type, opts={}) {
  if (type === helpers.jobTypes.WALLET_JOB_EXPORT_SEED) {
    jobType = type;
    jobData = {};
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    }
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    return
  } else if (type === helpers.jobTypes.WALLET_JOB_DELETE_SEED) {
    jobType = type;
    jobData = {
      iface: 1,
    };
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    }
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
  } else if (type === helpers.jobTypes.WALLET_JOB_LOAD_SEED) {
    jobType = type;
    jobData = {
      iface: 1, // external SafeCard interface
      seed: opts.seed,
      exportability: 2, // always exportable
    };
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    }
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
  }
}

describe('Connect', () => {
  before(() => {
    client = helpers.setupTestClient(process.env);
  });

  it('Should connect to a Lattice and make sure it is already paired.', async () => {
    expect(process.env.DEVICE_ID).to.not.equal(null);
    await helpers.connect(client, process.env.DEVICE_ID);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);
    activeWalletUID = helpers.copyBuffer(client.getActiveWallet().uid)
  });
})

describe('Setup Test', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Unauthorized or critical failure. Aborting');
  })

  it('Should tell the user to use a SafeCard', async () => {
    question(
      '\nYou must have a SafeCard inserted and setup with a seed to run these tests.\n' +
      'Press any key to continue.'
    );
  })

  it('Should fetch the seed', async () => {
    _setupJob(helpers.jobTypes.WALLET_JOB_EXPORT_SEED)
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeExportSeedJobResult(_res.result);
    latticeSeed = helpers.copyBuffer(res.seed);
  })

  it('Should remove the seed', async () => {
    _setupJob(helpers.jobTypes.WALLET_JOB_DELETE_SEED)
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  })

  it('Should load the known test seed', async () => {
    _setupJob(helpers.jobTypes.WALLET_JOB_LOAD_SEED, {seed: TEST_SEED})    
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  });

  it('Should wait for the user to remove and re-insert the card (triggering SafeCard wallet sync)', () => {
    question(
      '\nPlease remove, re-insert, and unlock your SafeCard.\n' +
      'Press any key to continue after addresses have fully synced.'
    );
  })

  it('Should re-connect to the Lattice and update the walletUID.', async () => {
    expect(process.env.DEVICE_ID).to.not.equal(null);
    await helpers.connect(client, process.env.DEVICE_ID);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);
    activeWalletUID = helpers.copyBuffer(client.getActiveWallet().uid)
  });

  it('Should ensure export seed matches the seed we just loaded', async () => {
    _setupJob(helpers.jobTypes.WALLET_JOB_EXPORT_SEED)
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeExportSeedJobResult(_res.result);
    const exportedSeed = helpers.copyBuffer(res.seed);
    expect(exportedSeed.toString('hex')).to.equal(TEST_SEED.toString('hex'));
    // Abort if this fails
    if (exportedSeed.toString('hex') !== TEST_SEED.toString('hex'))
      continueTests = false;
  })

  it('Should validate some Ledger addresses', async () => {
    // These addresses were all fetched using MetaMask with a real ledger loaded with TEST_MNEOMNIC
    // NOTE: These are 0-indexed indices whereas MetaMask shows 1-indexed (addr0 -> metamask1)
    const path0 = [helpers.BTC_LEGACY_PURPOSE, helpers.ETH_COIN, constants.HARDENED_OFFSET, 0, 0]
    const addr0 = '0x17E43083812d45040E4826D2f214601bc730F60C'
    const path1 = [helpers.BTC_LEGACY_PURPOSE, helpers.ETH_COIN, constants.HARDENED_OFFSET+1, 0, 0]
    const addr1 = '0xfb25a9D4472A55083042672e42309056763B667E'
    const path8 = [helpers.BTC_LEGACY_PURPOSE, helpers.ETH_COIN, constants.HARDENED_OFFSET+8, 0, 0]
    const addr8 = '0x8A520d7f70906Ebe00F40131791eFF414230Ea5c'
    // Derive these from the seed as a sanity check
    expect(deriveAddress(TEST_SEED, path0).toLowerCase()).to.equal(addr0.toLowerCase(), 'Incorrect address 0 derived.')
    expect(deriveAddress(TEST_SEED, path1).toLowerCase()).to.equal(addr1.toLowerCase(), 'Incorrect address 1 derived.')
    expect(deriveAddress(TEST_SEED, path8).toLowerCase()).to.equal(addr8.toLowerCase(), 'Incorrect address 8 derived.')
    // Fetch these addresses from the Lattice and validate

    const req = { 
      currency: 'ETH',
      startPath: path0,
      n: 1,
      skipCache: true,
    }
    const latAddr0 = await helpers.execute(client, 'getAddresses', req, 2000);
    expect(latAddr0[0].toLowerCase()).to.equal(addr0.toLowerCase(), 'Incorrect address 0 fetched.')
    req.startPath = path1;
    const latAddr1 = await helpers.execute(client, 'getAddresses', req, 2000);
    expect(latAddr1[0].toLowerCase()).to.equal(addr1.toLowerCase(), 'Incorrect address 1 fetched.')
    req.startPath = path8;
    const latAddr8 = await helpers.execute(client, 'getAddresses', req, 2000);
    expect(latAddr8[0].toLowerCase()).to.equal(addr8.toLowerCase(), 'Incorrect address 8 fetched.')
  })
})

/*
I don't have a good way to get a raw signature from Ledger but maybe we can just
validate that the same signature is made multiple times on the same payload for ETH txs
TODO: Figure it out
describe('Test deterministic signatures on ETH transactions', () => {
  beforeEach(() => {
    txReq = {
      currency: 'ETH',
      chainId: 4,
      data: {
        signerPath: LEDGER_ROOT_PATH,
        nonce: '0x02',
        gasPrice: '0x1fe5d61a00',
        gasLimit: '0x034e97',
        to: '0x1af768c0a217804cfe1a0fb739230b546a566cd6',
        value: '0x0102',
        data: null
      }
    };
  })

  it('Should validate signature from addr0');
  it('Should validate signature from addr1');
  it('Should validate signature from addr8');

  it('Should validate signature from addr0 on oversized data');
  it('Should validate signature from addr1 on oversized data');
  it('Should validate signature from addr8 on oversized data');
})
*/

describe('Test deterministic signatures on personal_sign messages', () => {
  beforeEach(() => {
    msgReq = {
      currency: 'ETH_MSG',
      data: {
        signerPath: LEDGER_ROOT_PATH,
        protocol: 'signPersonal',
        payload: 'hello ethereum'
      }
    }
  })

  it('Should validate signature from addr0', async () => {
    const expected =  '4820a558ab69907c90141f4857f54a7d71e77' +
                      '91f84478fef7b9a3e5b200ee242529cc19a58' +
                      'ed8fa017510d24a443b757018834b3e3585a7' +
                      '199168d3af4b3837e01'
    try {
      const res = await helpers.execute(client, 'sign', msgReq);
      const sig = `${res.sig.r}${res.sig.s}${parseInt(res.sig.v.toString('hex'), 16)} - 27`
      expect(sig).to.equal(expected)
      console.log(res)
    } catch (err) {
      expect(err).to.equal(null)
    }
  })

  it('Should validate signature from addr1', async () => {
    const expected =  'c292c988b26ae24a06a8270f2794c259ec574' +
                      '2168ed77cd635cba041f767a5692e4d218a02' +
                      'ba0b5f82b80488ccc519b67fb37a9f4cbb1d3' +
                      '5d9ce4b99e8afcc1801'
    msgReq.data.signerPath[2] = constants.HARDENED_OFFSET + 1;
    try {
      const res = await helpers.execute(client, 'sign', msgReq);
      const sig = `${res.sig.r}${res.sig.s}${parseInt(res.sig.v.toString('hex'), 16)} - 27`
      expect(sig).to.equal(expected)
    } catch (err) {
      expect(err).to.equal(null)
    }
  })
  it('Should validate signature from addr8', async () => {
    const expected =  '60cadafdbb7cba590a37eeff854d2598af719' +
                      '04077312875ef7b4f525d4dcb525903ae9e4b' +
                      '7e61f6f24abfe9a1d5fb1375347ef6a48f7ab' +
                      'e2319c89f426eb27c00'
    msgReq.data.signerPath[2] = constants.HARDENED_OFFSET + 8;
    try {
      const res = await helpers.execute(client, 'sign', msgReq);
      const sig = `${res.sig.r}${res.sig.s}${parseInt(res.sig.v.toString('hex'), 16)} - 27`
      expect(sig).to.equal(expected)
    } catch (err) {
      expect(err).to.equal(null)
    }
  })
})

describe('Test deterministic signatures on EIP712 messages', () => {
  beforeEach(() => {
    msgReq = {
      currency: 'ETH_MSG',
      data: {
        signerPath: LEDGER_ROOT_PATH,
        protocol: 'eip712',
        payload: {
          types: {
            Greeting: [
              { 
                name: 'salutation',
                type:'string'
              },
              { 
                name: 'target',
                type: 'string'
              },
              {
                name: 'born',
                type: 'int32'
              }
            ],
            EIP712Domain: [
              {
                name: 'chainId',
                type:'uint256'
              }
            ]
          },
          domain: {
            chainId: 1
          },
          primaryType: 'Greeting',
          message: {
            salutation: 'Hello',
            target: 'Ethereum',
            born: '2015'
          }
        }
      }
    }
  })

  it('Should validate signature from addr0', async () => {
    const expected =  'dbf9a493935770f97a1f0886f370345508398' +
                      'ac76fbf31ccf1c30d8846d3febf047e8ae03e' +
                      '146044e7857f1e485921a9d978b1ead93bdd0' +
                      'de6be619dfb72f0b501'
    try {
      const res = await helpers.execute(client, 'sign', msgReq);
      const sig = `${res.sig.r}${res.sig.s}${parseInt(res.sig.v.toString('hex'), 16)} - 27`
      expect(sig).to.equal(expected)
      console.log(res)
    } catch (err) {
      expect(err).to.equal(null)
    }
  })
  it('Should validate signature from addr1', async () => {
    const expected =  '9e784c6388f6f938f94239c67dc764909b86f' +
                      '34ec29312f4c623138fd71921155efbc9af23' +
                      '39e04303bf300366a675dd90d33fdb26d131c' +
                      '17b278725d36d728e00'
    msgReq.data.signerPath[2] = constants.HARDENED_OFFSET + 1;
    try {
      const res = await helpers.execute(client, 'sign', msgReq);
      const sig = `${res.sig.r}${res.sig.s}${parseInt(res.sig.v.toString('hex'), 16)} - 27`
      expect(sig).to.equal(expected)
    } catch (err) {
      expect(err).to.equal(null)
    }
  })
  it('Should validate signature from addr8', async () => {
    const expected =  '6e7e9bfc4773291713bb5cdc483057d43a95a' +
                      '5082920bdd1dd3470caf6f111556c163b7d48' +
                      '9f37ffcecfd20dab2de6a8a04f79af7e265b2' +
                      '49db9b4973e75c7d100'
    msgReq.data.signerPath[2] = constants.HARDENED_OFFSET + 8;
    try {
      const res = await helpers.execute(client, 'sign', msgReq);
      const sig = `${res.sig.r}${res.sig.s}${parseInt(res.sig.v.toString('hex'), 16)} - 27`
      expect(sig).to.equal(expected)
    } catch (err) {
      expect(err).to.equal(null)
    }
  })
})

describe('Teardown Test', () => {
    beforeEach(() => {
    expect(continueTests).to.equal(true, 'Unauthorized or critical failure. Aborting');
  })

  it('Should remove the seed', async () => {
    jobType = helpers.jobTypes.WALLET_JOB_DELETE_SEED;
    jobData = {
      iface: 1,
    };
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    }
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  })

  it('Should load the seed', async () => {
    _setupJob(helpers.jobTypes.WALLET_JOB_LOAD_SEED, {seed: latticeSeed})  
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  });

  it('Should wait for the user to remove and re-insert the card (triggering SafeCard wallet sync)', () => {
    question(
      '\nPlease remove, re-insert, and unlock your SafeCard.\n' +
      'Press any key to continue after addresses have fully synced.'
    );
  })

  it('Should re-connect to the Lattice and update the walletUID.', async () => {
    expect(process.env.DEVICE_ID).to.not.equal(null);
    await helpers.connect(client, process.env.DEVICE_ID);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);
    activeWalletUID = helpers.copyBuffer(client.getActiveWallet().uid)
  });

  it('Should ensure export seed matches the seed we just loaded', async () => {
    // Export the seed and make sure it matches!
    _setupJob(helpers.jobTypes.WALLET_JOB_EXPORT_SEED)
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeExportSeedJobResult(_res.result);
    const exportedSeed = helpers.copyBuffer(res.seed);
    expect(exportedSeed.toString('hex')).to.equal(latticeSeed.toString('hex'));
    // Abort if this fails
    if (exportedSeed.toString('hex') !== latticeSeed.toString('hex'))
      continueTests = false;
  })

})
