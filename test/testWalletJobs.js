// Tests for internal Lattice Wallet Jobs
// NOTE: You must run the following BEFORE executing these tests:
//
// 1. Pair with the device once. This will ask you for your deviceID, which will
//    act as a salt for your pairing:
//
//    env REUSE_KEY=1 npm run test
//
// 2. Connect with the same deviceID you specfied in 1:
//
//    env DEVICE_ID='<your_device_id>' npm test
//
// After you do the above, you can run this test with `env DEVICE_ID='<your_device_id>' npm run test-wallet-jobs`
//
// To run these tests you will need a dev Lattice with: `FEATURE_TEST_RUNNER=1`
const ethjsBN = require('bn.js')
const bip32 = require('bip32');
const bip39 = require('bip39');
const crypto = require('crypto');
const expect = require('chai').expect;
const ethutil = require('ethereumjs-util');
const cli = require('cli-interact');
const rlp = require('rlp');
const constants = require('./../src/constants');
const seedrandom = require('seedrandom');
const keccak256 = require('js-sha3').keccak256;
const helpers = require('./testUtil/helpers');
let client, currentWalletUID, jobType, jobData, jobReq, origWalletSeed=null, continueTests=true;
// Define the default parent path. We use BTC as the default
const BTC_PARENT_PATH = {
  pathDepth: 4,
  purpose: helpers.BTC_PURPOSE_P2SH_P2WPKH,
  coin: helpers.BTC_COIN,
  account: helpers.BTC_COIN,
  change: 0,
  addr: 0, // Not used for pathDepth=4
}

async function runTestCase(expectedCode) {
    const res = await helpers.execute(client, 'test', jobReq);
    const parsedRes = helpers.parseWalletJobResp(res, client.fwVersion);
    continueTests = parsedRes.resultStatus === expectedCode;
    expect(parsedRes.resultStatus).to.equal(expectedCode, 
      helpers.getCodeMsg(parsedRes.resultStatus, expectedCode));
    return parsedRes;
}

function getCurrentWalletUID() {
  return helpers.copyBuffer(client.getActiveWallet().uid)
}

describe('Test Wallet Jobs', () => {

  before(() => {
    client = helpers.setupTestClient(process.env);
    expect(continueTests).to.equal(true, 'Unauthorized or critical failure. Aborting');
  });

  it('Should connect to a Lattice and make sure it is already paired.', async () => {
    expect(process.env.DEVICE_ID).to.not.equal(null);
    await helpers.connect(client, process.env.DEVICE_ID);
    expect(client.isPaired).to.equal(true);
    const EMPTY_WALLET_UID = Buffer.alloc(32);
    const internalUID = client.activeWallets.internal.uid;
    const externalUID = client.activeWallets.external.uid;
    const checkOne = !EMPTY_WALLET_UID.equals(internalUID);
    const checkTwo = !EMPTY_WALLET_UID.equals(externalUID);
    const checkThree = !!client.hasActiveWallet();
    const checkFour = !!client.getActiveWallet().uid.equals(externalUID);
    continueTests = (checkOne && checkTwo && checkThree && checkFour);
    expect(checkOne).to.equal(true, 'Internal A90 must be enabled.');
    expect(checkTwo).to.equal(true, 'P60 with exportable seed must be inserted.');    
    expect(checkThree).to.equal(true, 'No active wallet discovered');
    expect(checkFour).to.equal(true, 'P60 should be active wallet but is not registered as it.')
    currentWalletUID = getCurrentWalletUID();
    const fwConstants = constants.getFwVersionConst(client.fwVersion);
    if (fwConstants) {
      // If firmware supports bech32 segwit addresses, they are the default address
      BTC_PARENT_PATH.purpose = fwConstants.allowBtcLegacyAndSegwitAddrs ?
                                helpers.BTC_PURPOSE_P2WPKH :
                                helpers.BTC_PURPOSE_P2SH_P2WPKH;
    }
  });
})

describe('exportSeed', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Unauthorized or critical failure. Aborting');
    jobType = helpers.jobTypes.WALLET_JOB_EXPORT_SEED;
    jobData = {};
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    }
  })

  it('Should get GP_SUCCESS for a known, connected wallet', async () => {
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeExportSeedJobResult(_res.result);
    origWalletSeed = helpers.copyBuffer(res.seed);
  })

  it('Should get GP_ENODEV for unknown (random) wallet', async () => {
    const dummyWalletUID = crypto.randomBytes(32);
    jobReq.payload = helpers.serializeJobData(jobType, dummyWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_ENODEV);
  })
})

describe('getAddresses', () => {
  beforeEach (() => {
    expect(continueTests).to.equal(true, 'Unauthorized or critical failure. Aborting');
    expect(origWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
    jobType = helpers.jobTypes.WALLET_JOB_GET_ADDRESSES;
    jobData = {
      parent: JSON.parse(JSON.stringify(BTC_PARENT_PATH)),
      first: 0,
      count: 1,
    };
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    }
  });

  it('Should get GP_SUCCESS for active wallet', async () => {
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  })

  it('Should get GP_EINVAL when `pathDepth` is out of range', async () => {
    // Parent too large
    jobData.parent.pathDepth = 5;
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
    // Parent is too small
    jobData.parent.pathDepth = 0;
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
  })

  it('Should get GP_FAILURE for unknown (random) wallet', async () => {
    const dummyWalletUID = crypto.randomBytes(32);
    jobReq.payload = helpers.serializeJobData(jobType, dummyWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_FAILURE);
  })

  it('Should get GP_EOVERFLOW if `count` exceeds the max request size', async () => {
    jobData.count = 11;
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EOVERFLOW);
  })

  it('Should validate an ETH address from a different EVM coin type', async () => {
    jobData.parent.purpose = helpers.BTC_LEGACY_PURPOSE;
    jobData.parent.coin = helpers.HARDENED_OFFSET + 1007; // Fantom coin_type via SLIP44
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateETHAddresses(res, jobData, origWalletSeed);
  })

  it('Should validate first ETH', async () => {
    jobData.parent.purpose = helpers.BTC_LEGACY_PURPOSE;
    jobData.parent.coin = helpers.ETH_COIN;
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateETHAddresses(res, jobData, origWalletSeed);
  })

  it('Should validate the first BTC address', async () => {
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateBTCAddresses(res, jobData, origWalletSeed);
  })

  it('Should validate first BTC change address', async () => {
    jobData.parent.change = 1;
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateBTCAddresses(res, jobData, origWalletSeed);
  })

  it('Should validate the first BTC address (testnet)', async () => {
    jobData.parent.coin = helpers.BTC_TESTNET_COIN;
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateBTCAddresses(res, jobData, origWalletSeed, true);
  })

  it('Should validate first BTC change address (testnet)', async () => {
    jobData.parent.change = 1;
    jobData.parent.coin = helpers.BTC_TESTNET_COIN;
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateBTCAddresses(res, jobData, origWalletSeed, true);
  })

  it('Should fetch a set of BTC addresses', async () => {
    const req = { 
      startPath: [helpers.BTC_PURPOSE_P2SH_P2WPKH, helpers.BTC_COIN, helpers.BTC_COIN, 0, 28802208], 
      n: 3,
    }
    const addrs = await helpers.execute(client, 'getAddresses', req, 2000);
    const resp = {
      count: addrs.length,
      addresses: addrs,
    }
    const jobData = {
      parent: {
        pathDepth: 4,
        purpose: req.startPath[0],
        coin: req.startPath[1],
        account: req.startPath[2],
        change: req.startPath[3],
      },
      count: req.n,
      first: req.startPath[4],
    }
    helpers.validateBTCAddresses(resp, jobData, origWalletSeed);
  })

  it('Should fetch a set of BTC addresses (bech32)', async () => {
    const req = { 
      startPath: [helpers.BTC_PURPOSE_P2WPKH, helpers.BTC_COIN, helpers.BTC_COIN, 0, 28802208], 
      n: 3,
    }
    const addrs = await helpers.execute(client, 'getAddresses', req, 2000);
    const resp = {
      count: addrs.length,
      addresses: addrs,
    }
    const jobData = {
      parent: {
        pathDepth: 4,
        purpose: req.startPath[0],
        coin: req.startPath[1],
        account: req.startPath[2],
        change: req.startPath[3],
      },
      count: req.n,
      first: req.startPath[4],
    }
    helpers.validateBTCAddresses(resp, jobData, origWalletSeed);
  })

  it('Should fetch a set of BTC addresses (legacy)', async () => {
    const req = { 
      startPath: [helpers.BTC_PURPOSE_P2PKH, helpers.BTC_COIN, helpers.BTC_COIN, 0, 28802208], 
      n: 3,
    }
    const addrs = await helpers.execute(client, 'getAddresses', req, 2000);
    const resp = {
      count: addrs.length,
      addresses: addrs,
    }
    const jobData = {
      parent: {
        pathDepth: 4,
        purpose: req.startPath[0],
        coin: req.startPath[1],
        account: req.startPath[2],
        change: req.startPath[3],
      },
      count: req.n,
      first: req.startPath[4],
    }
    helpers.validateBTCAddresses(resp, jobData, origWalletSeed);
  })

  it('Should fetch address with nonstandard path', async () => {
    const req = { 
      startPath: [helpers.BTC_PURPOSE_P2SH_P2WPKH, helpers.BTC_COIN, 2532356, 5828, 28802208], 
      n: 3,
    }
    const addrs = await helpers.execute(client, 'getAddresses', req, 2000);
    const resp = {
      count: addrs.length,
      addresses: addrs,
    }
    const jobData = {
      parent: {
        pathDepth: 4,
        purpose: req.startPath[0],
        coin: req.startPath[1],
        account: req.startPath[2],
        change: req.startPath[3],
      },
      count: req.n,
      first: req.startPath[4],
    }
    // Let the validator know this is a nonstandard purpose
    helpers.validateBTCAddresses(resp, jobData, origWalletSeed);
  })

  it('Should fail to fetch from path with an unknown currency type', async () => {
    const req = { 
      startPath: [helpers.BTC_PURPOSE_P2SH_P2WPKH, helpers.BTC_COIN + 2, 2532356, 5828, 28802208],
      n: 3,
    }
    try {
      await helpers.execute(client, 'getAddresses', req, 2000);
    } catch (err) {
      expect(err).to.not.equal(null)
    }
  })

  it('Should validate address with pathDepth=4', async () => {
    const req = { 
      startPath: [helpers.BTC_PURPOSE_P2SH_P2WPKH, helpers.ETH_COIN, 2532356, 7], 
      n: 3,
    }
    const addrs = await helpers.execute(client, 'getAddresses', req, 2000);
    const resp = {
      count: addrs.length,
      addresses: addrs,
    }
    const jobData = {
      parent: {
        pathDepth: 3,
        purpose: req.startPath[0],
        coin: req.startPath[1],
        account: req.startPath[2],
      },
      count: req.n,
      first: req.startPath[3],
    }
    helpers.validateETHAddresses(resp, jobData, origWalletSeed);
  })

  it('Should validate address with pathDepth=3', async () => {
    const req = { 
      startPath: [helpers.BTC_PURPOSE_P2SH_P2WPKH, helpers.ETH_COIN, 2532356], 
      n: 3,
    }
    const addrs = await helpers.execute(client, 'getAddresses', req, 2000);
    const resp = {
      count: addrs.length,
      addresses: addrs,
    }
    const jobData = {
      parent: {
        pathDepth: 2,
        purpose: req.startPath[0],
        coin: req.startPath[1],
      },
      count: req.n,
      first: req.startPath[2],
    }
    helpers.validateETHAddresses(resp, jobData, origWalletSeed);
  })

  it('Should validate random Bitcoin addresses of all types', async () => {
    const prng = new seedrandom('btctestseed');
    async function testRandomBtcAddrs(purpose) {
      const account = Math.floor((constants.HARDENED_OFFSET + 100000) * prng.quick());
      const addr = Math.floor((constants.HARDENED_OFFSET + 100000) * prng.quick());
      const req = { 
        startPath: [purpose, helpers.BTC_COIN, account, 0, addr], 
        n: 1,
      }
      const addrs = await helpers.execute(client, 'getAddresses', req, 2000);
      const resp = {
        count: addrs.length,
        addresses: addrs,
      }
      const jobData = {
        parent: {
          pathDepth: 4,
          purpose: req.startPath[0],
          coin: req.startPath[1],
          account: req.startPath[2],
          change: req.startPath[3],
        },
        count: req.n,
        first: req.startPath[4],
      }
      helpers.validateBTCAddresses(resp, jobData, origWalletSeed);
    }

    // Wrapped Segwit (x3)
    await testRandomBtcAddrs(helpers.BTC_PURPOSE_P2WPKH);
    await testRandomBtcAddrs(helpers.BTC_PURPOSE_P2WPKH);
    await testRandomBtcAddrs(helpers.BTC_PURPOSE_P2WPKH);
    // Legacy (x3)
    await testRandomBtcAddrs(helpers.BTC_LEGACY_PURPOSE);
    await testRandomBtcAddrs(helpers.BTC_LEGACY_PURPOSE);
    await testRandomBtcAddrs(helpers.BTC_LEGACY_PURPOSE);
    // Segwit (x3)
    await testRandomBtcAddrs(helpers.BTC_PURPOSE_P2WPKH);
    await testRandomBtcAddrs(helpers.BTC_PURPOSE_P2WPKH);
    await testRandomBtcAddrs(helpers.BTC_PURPOSE_P2WPKH);
  })

})

describe('signTx', () => {
  beforeEach (() => {
    expect(continueTests).to.equal(true, 'Unauthorized or critical failure. Aborting');
    expect(origWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
    jobType = helpers.jobTypes.WALLET_JOB_SIGN_TX;
    const path = JSON.parse(JSON.stringify(BTC_PARENT_PATH));
    path.pathDepth = 5;
    jobData = {
      numRequests: 1,
      sigReq: [{
        data: crypto.randomBytes(32),
        signerPath: path,
      }]
    };
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    }
  });

  it('Should get GP_SUCCESS for active wallet', async () => {
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeSignTxJobResult(_res.result);
    // Ensure correct number of outputs returned
    expect(res.numOutputs).to.equal(jobData.numRequests);
    // Ensure signatures validate against provided pubkey
    const outputKey = res.outputs[0].pubkey;
    const outputPubStr = helpers.getPubStr(outputKey);
    expect(outputKey.verify(jobData.sigReq[0].data, res.outputs[0].sig)).to.equal(true);
    // Ensure pubkey is correctly derived
    const wallet = bip32.fromSeed(origWalletSeed);
    const derivedKey = wallet.derivePath(helpers.stringifyPath(jobData.sigReq[0].signerPath));
    const derivedPubStr = `04${ethutil.privateToPublic(derivedKey.privateKey).toString('hex')}`;
    expect(outputPubStr).to.equal(derivedPubStr)
  })

  it('Should get GP_SUCCESS for signing out of shorter (but allowed) paths', async () => {
    jobData.sigReq[0].signerPath =   {
      pathDepth: 3,
      purpose: helpers.BTC_LEGACY_PURPOSE,
      coin: helpers.ETH_COIN,
      account: 1572,
      change: 0, // Not used for pathDepth=3
      addr: 0, // Not used for pathDepth=4
    };
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeSignTxJobResult(_res.result);
    // Ensure correct number of outputs returned
    expect(res.numOutputs).to.equal(jobData.numRequests);
    // Ensure signatures validate against provided pubkey
    const outputKey = res.outputs[0].pubkey;
    const outputPubStr = helpers.getPubStr(outputKey);
    expect(outputKey.verify(jobData.sigReq[0].data, res.outputs[0].sig)).to.equal(true);
    // Ensure pubkey is correctly derived
    const wallet = bip32.fromSeed(origWalletSeed);
    const derivedKey = wallet.derivePath(helpers.stringifyPath(jobData.sigReq[0].signerPath));
    const derivedPubStr = `04${ethutil.privateToPublic(derivedKey.privateKey).toString('hex')}`;
    expect(outputPubStr).to.equal(derivedPubStr)
  })

  it('Should get GP_ENODEV for unknown (random) wallet', async () => {
    const dummyWalletUID = crypto.randomBytes(32);
    jobReq.payload = helpers.serializeJobData(jobType, dummyWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_ENODEV);
  })

  it('Should get GP_ENODEV for known wallet that is inactive', async () => {
    const EMPTY_WALLET_UID = Buffer.alloc(32);
    const wallets = client.activeWallets;

    // This test requires a wallet on each interface, which means the active wallet needs
    // to be external and the internal wallet needs to exist.
    const ERR_MSG = 'ERROR: This test requires an enabled Lattice wallet and active SafeCard wallet!';
    expect(helpers.copyBuffer(wallets.external.uid).toString('hex')).to.equal(currentWalletUID.toString('hex'), ERR_MSG);
    expect(helpers.copyBuffer(wallets.internal.uid).toString('hex')).to.not.equal(EMPTY_WALLET_UID.toString('hex'), ERR_MSG);
    const incurrentWalletUID = helpers.copyBuffer(wallets.internal.uid)
    jobReq.payload = helpers.serializeJobData(jobType, incurrentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_ENODEV);
  })

  it('Should get GP_EINVAL when `numRequests` is 0', async () => {
    jobData.numRequests = 0;
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
  })

  it('Should get GP_EINVAL when `numRequests` exceeds the max allowed', async () => {
    jobData.numRequests = 11;
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
  })

  it('Should return GP_EINVAL when a signer `pathDepth` is of invalid size', async () => {
    jobData.sigReq[0].signerPath.pathDepth = 1;
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
    jobData.sigReq[0].signerPath.pathDepth = 6;
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
    jobData.sigReq[0].signerPath.pathDepth = 5;
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  })

  it('Should get GP_SUCCESS when signing from a non-ETH EVM path', async () => {
    jobData.sigReq[0].signerPath.coin = helpers.HARDENED_OFFSET + 1007;
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  })
})

describe('Get delete permission', () => {
  it('Should get permission to remove seed.', () => {
    expect(continueTests).to.equal(true, 'Unauthorized or critical failure. Aborting');
    const t = '\n\nThe following tests will remove your seed.\n' +
              'It should be added back in a later test, but these tests could fail!\n' +
              'Do you want to proceed?';
    continueTests = cli.getYesNo(t);
    expect(continueTests).to.equal(true);
  })
})

describe('Test leading zeros', () => {
  // Use a known seed to derive private keys with leading zeros to test firmware derivation
  const mnemonic = 'erosion loan violin drip laundry harsh social mercy leaf original habit buffalo';
  const KNOWN_SEED = bip39.mnemonicToSeedSync(mnemonic);
  const wallet = bip32.fromSeed(KNOWN_SEED);
  let basePath = [helpers.BTC_LEGACY_PURPOSE, helpers.ETH_COIN, helpers.HARDENED_OFFSET, 0, 0];
  let parentPathStr = 'm/44\'/60\'/0\'/0';
  let addrReq, txReq;

  async function runZerosTest(idx, numZeros, testPub=false) {
    const w = wallet.derivePath(`${parentPathStr}/${idx}`);
    const refPriv = w.privateKey;
    const refPub = w.publicKey;
    for (let i = 0; i < numZeros; i++) {
      if (testPub) {
        // We expect the first byte to be 2 or 3. We need to inspect the bytes after that
        expect(refPub[1+i]).to.equal(0, `Should be ${numZeros} leading pubKey zeros but got ${i}.`);
      } else {
        expect(refPriv[i]).to.equal(0, `Should be ${numZeros} leading privKey zeros but got ${i}.`);
      }
    }
    // Validate the exported address
    const ref = `0x${ethutil.privateToAddress(refPriv).toString('hex').toLowerCase()}`;
    addrReq.startPath[addrReq.startPath.length - 1] = idx;
    txReq.data.signerPath[txReq.data.signerPath.length - 1] = idx;
    const addrs = await helpers.execute(client, 'getAddresses', addrReq);
    if (addrs[0].toLowerCase() !== ref) {
      continueTests = false;
      expect(addrs[0].toLowerCase()).to.equal(ref, 'Failed to derive correct address for known seed');
    }
    // Validate the signer coming back from the sign request
    const tx = await helpers.execute(client, 'sign', txReq);
    if (`0x${tx.signer.toString('hex').toLowerCase()}` !== ref) {
      continueTests = false;
      expect(addrs[0].toLowerCase()).to.equal(ref, 'Failed to sign from correct address for known seed');
    }

    // Validate the signature itself against the expected signer
    const rlpData = rlp.decode(tx.tx)
    // The returned data contains the signature, which we need to clear out
    // Note that all requests coming in here must be legacy ETH txs
    rlpData[6] = Buffer.from('01', 'hex'); // chainID must be 1
    rlpData[7] = Buffer.alloc(0);
    rlpData[8] = Buffer.alloc(0);
    const rlpEnc = rlp.encode(rlpData);
    const txHashLessSig = Buffer.from(keccak256(rlpEnc), 'hex');
    // Rebuild sig
    // Subtract 37 to account for EIP155 (all requests here must have chainID=1)
    const _v = parseInt(tx.sig.v.toString('hex'), 16) - 37;
    const v = new ethjsBN(_v + 27);
    const r = Buffer.from(tx.sig.r, 'hex')
    const s = Buffer.from(tx.sig.s, 'hex')
    const recoveredAddr = ethutil.publicToAddress(ethutil.ecrecover(txHashLessSig, v, r, s));
    // Ensure recovered address is consistent with the one that got returned in the tx obj
    expect( recoveredAddr.toString('hex')).to.equal(tx.signer.toString('hex'), 
            'Returned signer inconsistend with sig');
    // Ensure returned address matches derived address
    expect(`0x${recoveredAddr.toString('hex')}`).to.equal(ref)
  }

  beforeEach (() => {
    expect(origWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
    expect(continueTests).to.equal(true, 'Unauthorized or critical failure. Aborting');
    addrReq = { 
      startPath: basePath,
      n: 1,
    };
    txReq = {
      currency: 'ETH',
      data: {
        signerPath: basePath,
        nonce: '0x02',
        gasPrice: '0x1fe5d61a00',
        gasLimit: '0x034e97',
        to: '0x1af768c0a217804cfe1a0fb739230b546a566cd6',
        value: '0x100000',
        data: null,
        chainId: 1,
      }
    }
  })

  it('Should remove the current seed', async () => {
    jobType = helpers.jobTypes.WALLET_JOB_DELETE_SEED;
    jobData = {
      iface: 1,
    };
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    }
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  });

  it('Should load the new seed', async () => {
    jobType = helpers.jobTypes.WALLET_JOB_LOAD_SEED;
    jobData = {
      iface: 1, // external SafeCard interface
      seed: KNOWN_SEED,
      exportability: 2, // always exportable
    };
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    }
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  });

  it('Should wait for the user to remove and re-insert the card (triggering SafeCard wallet sync)', () => {
    const newQ = cli.getYesNo;
    const t = '\n\nPlease remove your SafeCard, then re-insert and unlock it.\n'+
              'Press Y when the card is re-inserted and its wallet has finished syncing.';
    continueTests = newQ(t);
    expect(continueTests).to.equal(true, 'You must remove, re-insert, and unlock your SafeCard to run this test.');
  })

  it('Should reconnect to update the wallet UIDs', async () => {
    await helpers.connect(client, process.env.DEVICE_ID);
    currentWalletUID = getCurrentWalletUID();
  })

  it('Should make sure the first address is correct', async () => {
    const ref = `0x${ethutil.privateToAddress(wallet.derivePath(`${parentPathStr}/0`).privateKey).toString('hex').toLowerCase()}`;
    const addrs = await helpers.execute(client, 'getAddresses', addrReq);
    if (addrs[0].toLowerCase() !== ref) {
      continueTests = false;
      expect(addrs[0].toLowerCase()).to.equal(ref, 'Failed to derive correct address for known seed');
    }
  })

  // One leading privKey zero -> P(1/256)
  it('Should test address m/44\'/60\'/0\'/0/396 (1 leading zero byte)', async () => {
    await runZerosTest(396, 1);
  });
  it('Should test address m/44\'/60\'/0\'/0/406 (1 leading zero byte)', async () => {
    await runZerosTest(406, 1);
  });
  it('Should test address m/44\'/60\'/0\'/0/668 (1 leading zero byte)', async () => {
    await runZerosTest(668, 1);
  });

  // Two leading privKey zeros -> P(1/65536)
  it('Should test address m/44\'/60\'/0\'/0/71068 (2 leading zero bytes)', async () => {
    await runZerosTest(71068, 2);
  });
  it('Should test address m/44\'/60\'/0\'/0/82173 (2 leading zero bytes)', async () => {
    await runZerosTest(82173, 2);
  });

  // Three leading privKey zeros -> P(1/16777216)
  // Unlikely any user ever runs into these but I wanted to derive the addrs for funsies
  it('Should test address m/44\'/60\'/0\'/0/11981831 (3 leading zero bytes)', async () => {
    await runZerosTest(11981831, 3);
  });

  // Pubkeys are also used in the signature process, so we need to test paths with
  // leading zeros in the X component of the pubkey (compressed pubkeys are used)
  // We will test with a modification to the base path, which will produce a pubkey
  // with a leading zero byte.
  // We want this leading-zero pubkey to be a parent derivation path to then
  // test all further derivations
  it('Should switch to testing public keys', async () => {
    parentPathStr = 'm/44\'/60\'/0\'';
    basePath[3] = 153;
    basePath = basePath.slice(0, 4)
  })

  // There should be no problems with the parent path here because the result
  // is the leading-zero pubkey directly. Since we do not do a further derivation
  // with that leading-zero pubkey, there should never be any issues.
  it('Should test address m/44\'/60\'/0\'/153', async () => {
    await runZerosTest(153, 1, true);
  });

  it('Should prepare for one more derivation step', async () => {
    parentPathStr = 'm/44\'/60\'/0\'/153';
    basePath.push(0);
  })

  // Now we will derive one more step with the leading zero pubkey feeding
  // into the derivation. This tests an edge case in firmware.
  it('Should test address m/44\'/60\'/0\'/153/0', async () => {
    await runZerosTest(0, 0);
  })

  it('Should test address m/44\'/60\'/0\'/153/1', async () => {
    await runZerosTest(1, 0);
  })

  it('Should test address m/44\'/60\'/0\'/153/5', async () => {
    await runZerosTest(5, 0);
  })

  it('Should test address m/44\'/60\'/0\'/153/10000', async () => {
    await runZerosTest(10000, 0);
  })

  it('Should test address m/44\'/60\'/0\'/153/9876543', async () => {
    await runZerosTest(9876543, 0);
  })
})

describe('deleteSeed', () => {
  beforeEach (() => {
    expect(origWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
    expect(continueTests).to.equal(true, 'Unauthorized or critical failure. Aborting');
    jobType = helpers.jobTypes.WALLET_JOB_DELETE_SEED;
    jobData = {
      iface: 1,
    };
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    }
  })

  it('Should get GP_EINVAL for unknown (random) wallet', async () => {
    const dummyWalletUID = crypto.randomBytes(32);
    jobReq.payload = helpers.serializeJobData(jobType, dummyWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
  })

  it('Should get GP_SUCCESS for a known, connected wallet.', async () => {
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  })
})

describe('Load Original Seed Back', () => {
  beforeEach (() => {
    expect(origWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
    expect(continueTests).to.equal(true, 'Unauthorized or critical failure. Aborting');
    jobType = helpers.jobTypes.WALLET_JOB_LOAD_SEED;
    jobData = {
      iface: 1, // external SafeCard interface
      seed: origWalletSeed,
      exportability: 2, // always exportable
    };
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    }
  })

  it('Should get GP_EINVAL if `exportability` option is invalid', async () => {
    jobData.exportability = 3; // past range
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
  });

  it('Should get GP_SUCCESS when valid seed is provided to valid interface', async () => {
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  });

  it('Should wait for the user to remove and re-insert the card (triggering SafeCard wallet sync)', () => {
    const newQ = cli.getYesNo;
    const t = '\n\nPlease remove your SafeCard, then re-insert and unlock it.\n'+
              'Press Y when the card is re-inserted and the wallet has finished syncing.';
    continueTests = newQ(t);
    expect(continueTests).to.equal(true, 'You must remove, re-insert, and unlock your SafeCard to run this test.');
  })

  it('Should reconnect to update the wallet UIDs', async () => {
    await helpers.connect(client, process.env.DEVICE_ID);
    currentWalletUID = getCurrentWalletUID();
  })

  it('Should ensure export seed matches the seed we just loaded', async () => {
    // Export the seed and make sure it matches!
    jobType = helpers.jobTypes.WALLET_JOB_EXPORT_SEED;
    jobData = {};
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeExportSeedJobResult(_res.result);
    const exportedSeed = helpers.copyBuffer(res.seed);
    expect(exportedSeed.toString('hex')).to.equal(origWalletSeed.toString('hex'));
    // Abort if this fails
    if (exportedSeed.toString('hex') !== origWalletSeed.toString('hex'))
      continueTests = false;
  })

  // Test both safecard and a90
  it('Should get GP_FAILURE if interface already has a seed', async () => {
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_FAILURE);
  });

  // Wait for user to remove safecard
  it('Should get GP_EAGAIN when trying to load seed into SafeCard when none exists', async () => {
    const newQ = cli.getYesNo;
    continueTests = newQ('Please remove your SafeCard to run this test. Press Y when you have done so.');
    expect(continueTests).to.equal(true, 'You must remove your SafeCard when prompted to complete this test.');
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EAGAIN);
  });

  it('Should wait for the card to be re-inserted', async () => {
    const newQ = cli.getYesNo;
    continueTests = newQ('\n\nPlease re-insert and unlock your SafeCard to continue.\nWait for wallet to sync.\nPress Y when you have done so.');
    expect(continueTests).to.equal(true, 'You must re-insert and unlock your SafeCard when prompted to complete this test.');
    jobType = helpers.jobTypes.WALLET_JOB_EXPORT_SEED;
    jobData = {};
    jobReq.payload = helpers.serializeJobData(jobType, currentWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeExportSeedJobResult(_res.result);
    const currentSeed = helpers.copyBuffer(res.seed);
    expect(currentSeed.toString('hex')).to.equal(origWalletSeed.toString('hex'))
    if (currentSeed.toString('hex') !== origWalletSeed.toString('hex'))
      continueTests = false;
  })

})