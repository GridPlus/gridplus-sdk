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
// NOTE: It is highly suggested that you set `AUTO_SIGN_DEV_ONLY=1` in the firmware
//        root CMakeLists.txt file (for dev units)
// To run these tests you will need a dev Lattice with: `FEATURE_TEST_RUNNER=1`
const bip32 = require('bip32');
const crypto = require('crypto');
const expect = require('chai').expect;
const ethutil = require('ethereumjs-util');
const cli = require('cli-interact');
const helpers = require('./testUtil/helpers');
let client, activeWalletUID, jobType, jobData, jobReq, activeWalletSeed=null, continueTests=false;
// For v1, all BTC addresses are derived via BIP49 (only p2sh-p2wpkh transactions are supported)
const USE_BIP49 = true;
// Define the default parent path. We use BTC as the default
const BTC_PARENT_PATH = {
  pathDepth: 4,
  purpose: USE_BIP49 === true ? helpers.BTC_PURPOSE_P2SH_P2WPKH : helpers.BTC_LEGACY_PURPOSE,
  coin: helpers.BTC_COIN,
  account: helpers.BTC_COIN,
  change: 0,
  addr: 0, // Not used for pathDepth=4
}

async function runTestCase(expectedCode) {
    const res = await helpers.execute(client, 'test', jobReq);
    const parsedRes = helpers.parseWalletJobResp(res, client.fwVersion);
    expect(parsedRes.resultStatus).to.equal(expectedCode);
    return parsedRes;
}

describe('Test setup', () => {
  it('Should ensure both Lattice and SafeCard wallets are available.', () => {
    const t = '\n\nDo you have an unlocked SafeCard with a wallet inserted? ';
    continueTests = cli.getYesNo(t);
    expect(continueTests).to.equal(true);
  })
})

describe('Test Wallet Jobs', () => {

  before(() => {
    client = helpers.setupTestClient(process.env);
    expect(continueTests).to.equal(true, 'Unauthorized or critical failure. Aborting');
  });

  it('Should connect to a Lattice and make sure it is already paired.', async () => {
    expect(process.env.DEVICE_ID).to.not.equal(null);
    await helpers.connect(client, process.env.DEVICE_ID);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);
    activeWalletUID = helpers.copyBuffer(client.getActiveWallet().uid)
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
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeExportSeedJobResult(_res.result);
    activeWalletSeed = helpers.copyBuffer(res.seed);
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
    expect(activeWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
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
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  })

  it('Should get GP_EINVAL when `pathDepth` is too large', async () => {
    // Parent too large
    jobData.parent.pathDepth = 5;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
    // Parent is too small
    jobData.parent.pathDepth = 1;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
  })

  it('Should get GP_ENODATA for unknown (random) wallet', async () => {
    const dummyWalletUID = crypto.randomBytes(32);
    jobReq.payload = helpers.serializeJobData(jobType, dummyWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_ENODATA);
  })

  it('Should get GP_ENODATA if `first` < num cached, but the `first` + `count` - 1 address is > num cached', async () => {
    jobData.parent.purpose = helpers.BTC_LEGACY_PURPOSE;
    jobData.parent.coin = helpers.ETH_COIN;
    jobData.count = 10;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_ENODATA);
  })

  it('Should get GP_ENODATA if `first` is > num cached', async () => {
    jobData.parent.purpose = helpers.BTC_LEGACY_PURPOSE;
    jobData.parent.coin = helpers.ETH_COIN;
    jobData.first = 1;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_ENODATA);
  })

  it('Should get GP_EOVERFLOW if `count` exceeds the max request size', async () => {
    jobData.count = 11;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EOVERFLOW);
  })

  it('Should validate first ETH', async () => {
    // Make sure we have cached the first ETH address (for later tests)
    jobData.parent.purpose = helpers.BTC_LEGACY_PURPOSE;
    jobData.parent.coin = helpers.ETH_COIN;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateETHAddresses(res, jobData, activeWalletSeed);
  })

  it('Should validate BTC address', async () => {
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should validate first BTC change address', async () => {
    jobData.parent.change = 1;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should validate BTC address (testnet)', async () => {
    jobData.parent.coin = helpers.BTC_TESTNET_COIN;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should validate first BTC change address (testnet)', async () => {
    jobData.parent.change = 1;
    jobData.parent.coin = helpers.BTC_TESTNET_COIN;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should fetch BTC addresses outside the cache with the proper flag set', async () => {
    const req = { 
      currency: 'BTC', 
      startPath: [helpers.BTC_PURPOSE_P2SH_P2WPKH, helpers.BTC_COIN, helpers.BTC_COIN, 0, 28802208], 
      n: 3,
      skipCache: true,
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
    helpers.validateBTCAddresses(resp, jobData, activeWalletSeed);
  })

  it('Should fetch nonstandard address with proper flag set', async () => {
    const req = { 
      currency: 'BTC', 
      startPath: [7842, helpers.BTC_COIN, 2532356, 0, 28802208], 
      n: 3,
      skipCache: true,
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
    helpers.validateBTCAddresses(resp, jobData, activeWalletSeed);
  })

  it('Should fail to fetch with nonstanard address with an unknown currency type', async () => {
    const req = { 
      currency: 'BTC', 
      startPath: [7842, helpers.BTC_COIN + 1, 2532356, 0, 28802208], 
      n: 3,
      skipCache: true,
    }
    try {
      await helpers.execute(client, 'getAddresses', req, 2000);
    } catch (err) {
      expect(err).to.not.equal(null)
    }
  })

  it('Should fetch with a shorter derivation path', async () => {
    const req = { 
      currency: 'ETH', 
      startPath: [7842, helpers.ETH_COIN, 2532356, 7], 
      n: 3,
      skipCache: true,
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
    helpers.validateETHAddresses(resp, jobData, activeWalletSeed);
  })

})

describe('signTx', () => {
  beforeEach (() => {
    expect(continueTests).to.equal(true, 'Unauthorized or critical failure. Aborting');
    expect(activeWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
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
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeSignTxJobResult(_res.result);
    // Ensure correct number of outputs returned
    expect(res.numOutputs).to.equal(jobData.numRequests);
    // Ensure signatures validate against provided pubkey
    const outputKey = res.outputs[0].pubkey;
    const outputPubStr = helpers.getPubStr(outputKey);
    expect(outputKey.verify(jobData.sigReq[0].data, res.outputs[0].sig)).to.equal(true);
    // Ensure pubkey is correctly derived
    const wallet = bip32.fromSeed(activeWalletSeed);
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
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeSignTxJobResult(_res.result);
    // Ensure correct number of outputs returned
    expect(res.numOutputs).to.equal(jobData.numRequests);
    // Ensure signatures validate against provided pubkey
    const outputKey = res.outputs[0].pubkey;
    const outputPubStr = helpers.getPubStr(outputKey);
    expect(outputKey.verify(jobData.sigReq[0].data, res.outputs[0].sig)).to.equal(true);
    // Ensure pubkey is correctly derived
    const wallet = bip32.fromSeed(activeWalletSeed);
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
    expect(helpers.copyBuffer(wallets.external.uid).toString('hex')).to.equal(activeWalletUID.toString('hex'), ERR_MSG);
    expect(helpers.copyBuffer(wallets.internal.uid).toString('hex')).to.not.equal(EMPTY_WALLET_UID.toString('hex'), ERR_MSG);
    const inactiveWalletUID = helpers.copyBuffer(wallets.internal.uid)
    jobReq.payload = helpers.serializeJobData(jobType, inactiveWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_ENODEV);
  })

  it('Should get GP_EINVAL when `numRequests` is 0', async () => {
    jobData.numRequests = 0;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
  })

  it('Should get GP_EINVAL when `numRequests` exceeds the max allowed', async () => {
    jobData.numRequests = 11;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
  })

  it('Should return GP_EINVAL when a signer `pathDepth` is of invalid size', async () => {
    jobData.sigReq[0].signerPath.pathDepth = 1;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
    jobData.sigReq[0].signerPath.pathDepth = 6;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
    jobData.sigReq[0].signerPath.pathDepth = 5;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  })
})

describe('Get delete permission', () => {
  it('Should get permission to remove seed.', () => {
    expect(continueTests).to.equal(true, 'Unauthorized or critical failure. Aborting');
    const t = '\n\nThe following test will remove your seed.\n' +
              'It should be added back in a later test, but these tests could fail!\n' +
              'Do you want to proceed?';
    continueTests = cli.getYesNo(t);
    expect(continueTests).to.equal(true);
  })
})

describe('deleteSeed', () => {
  beforeEach (() => {
    expect(activeWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
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
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  })
})

describe('loadSeed', () => {
  beforeEach (() => {
    expect(activeWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
    expect(continueTests).to.equal(true, 'Unauthorized or critical failure. Aborting');
    jobType = helpers.jobTypes.WALLET_JOB_LOAD_SEED;
    jobData = {
      iface: 1, // external SafeCard interface
      seed: activeWalletSeed,
      exportability: 2, // always exportable
    };
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    }
  })

  it('Should get GP_EINVAL if `exportability` option is invalid', async () => {
    jobData.exportability = 3; // past range
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
  });

  it('Should get GP_SUCCESS when valid seed is provided to valid interface', async () => {
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  });

  it('Should wait for the user to remove and re-insert the card (triggering SafeCard wallet sync)', () => {
    const newQ = cli.getYesNo;
    const t = '\n\nPlease remove your SafeCard, then re-insert and unlock it.\nWait for addresses to sync!\n'+
              'Press Y when the card is re-inserted and addresses have finished syncing.';
    continueTests = newQ(t);
    expect(continueTests).to.equal(true, 'You must remove, re-insert, and unlock your SafeCard to run this test.');
  })

  it('Should ensure export seed matches the seed we just loaded', async () => {
    // Export the seed and make sure it matches!
    jobType = helpers.jobTypes.WALLET_JOB_EXPORT_SEED;
    jobData = {};
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeExportSeedJobResult(_res.result);
    const exportedSeed = helpers.copyBuffer(res.seed);
    expect(exportedSeed.toString('hex')).to.equal(activeWalletSeed.toString('hex'));
    // Abort if this fails
    if (exportedSeed.toString('hex') !== activeWalletSeed.toString('hex'))
      continueTests = false;
  })

  // Test both safecard and a90
  it('Should get GP_EOVERFLOW if interface already has a seed', async () => {
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EOVERFLOW);
  });

  // Wait for user to remove safecard
  it('Should get GP_EAGAIN when trying to load seed into SafeCard when none exists', async () => {
    const newQ = cli.getYesNo;
    continueTests = newQ('Please remove your SafeCard to run this test. Press Y when you have done so.');
    expect(continueTests).to.equal(true, 'You must remove your SafeCard when prompted to complete this test.');
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EAGAIN);
  });

  it('Should wait for the card to be re-inserted', async () => {
    const newQ = cli.getYesNo;
    continueTests = newQ('\n\nPlease re-insert and unlock your SafeCard to continue.\nWait for wallet to sync.\nPress Y when you have done so.');
    expect(continueTests).to.equal(true, 'You must re-insert and unlock your SafeCard when prompted to complete this test.');
    jobType = helpers.jobTypes.WALLET_JOB_EXPORT_SEED;
    jobData = {};
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeExportSeedJobResult(_res.result);
    const currentSeed = helpers.copyBuffer(res.seed);
    expect(currentSeed.toString('hex')).to.equal(activeWalletSeed.toString('hex'))
    if (currentSeed.toString('hex') !== activeWalletSeed.toString('hex'))
      continueTests = false;
  })

})

// Test wallet sync behavior. Most of the complexity comes from BTC and BTC_TESTNET coins, as
// the wallet must sync up to the GAP_LIMIT past the highest requested address index, when that
// address index is in range of addresses already synced. GAP_LIMIT is 20 for BTC and BTC_TESTNET
// and is 1 for change of those currencies and 0 for ETH (i.e. we can only ever request ETH addr 0).
// We assume a starting point of addresses 0-19 synced. This is because when the seed is removed
// via the deleteSeed request, the wallet cache is also removed. When the seed is re-loaded and the
// interface comes up, the device automatically syncs the first GAP_LIMIT addresses for each currency.
// (NOTE: For ETH we do sync the first address, even though the gap limit is 0)
describe('Wallet sync tests (starting with newly synced wallet)', () => {

  // It takes about 2 seconds for the device to request and cache a new address
  const ADDR_SYNC_TIMEOUT = 2000;

  beforeEach ((done) => {
    expect(activeWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
    expect(continueTests).to.equal(true, 'Unauthorized or critical failure. Aborting');
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
    // Timeout between requests to give a bit more of a buffer.
    // In some cases, there will be one address syncing.
    // This also gives resliency regardless.
    setTimeout(() => { done(); }, ADDR_SYNC_TIMEOUT);
  });

  async function makeRequest(coin, change, first, last, expectedErr=helpers.gpErrors.GP_SUCCESS) {
    // If this is a non-BTC coin, determine the BIP path purpose
    switch (coin) {
      case helpers.ETH_COIN:
        jobData.parent.purpose = helpers.BTC_LEGACY_PURPOSE;
        break;
      default:
        break;
    }
    jobData.parent.coin = coin;
    jobData.parent.change = change;
    jobData.first = first;
    jobData.count = last - first + 1;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    if (expectedErr === helpers.gpErrors.GP_SUCCESS) {
      const _res = await runTestCase(expectedErr);
      return helpers.deserializeGetAddressesJobResult(_res.result);
    } else {
      await runTestCase(expectedErr);
    }
  }

  function waitForSync(numAddrs, done) {
    setTimeout(() => { 
      expect(true).to.equal(true); 
      done(); 
    }, numAddrs * ADDR_SYNC_TIMEOUT);
  }

  it('Should fail to fetch ETH address 1', async () => {
    await makeRequest(helpers.ETH_COIN, 0, 1, 1, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fail to fetch BTC address 17-23', async () => {
    await makeRequest(helpers.BTC_COIN, 0, 17, 23, helpers.gpErrors.GP_ENODATA); 
  })
  it('Should fail to fetch BTC address 20', async () => {
    await makeRequest(helpers.BTC_COIN, 0, 20, 20, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fail to fetch BTC change address 1', async () => {
    await makeRequest(helpers.BTC_COIN, 1, 1, 1, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fail to fetch BTC_TESTNET address 17-23', async () => {
    await makeRequest(helpers.BTC_TESTNET_COIN, 0, 17, 23, helpers.gpErrors.GP_ENODATA); 
  })
  
  it('Should fail to fetch BTC_TESTNET address 20', async () => {
    await makeRequest(helpers.BTC_TESTNET_COIN, 0, 20, 20, helpers.gpErrors.GP_ENODATA); 
  })
  
  it('Should fail to fetch BTC_TESTNET change address 1', async () => {
    await makeRequest(helpers.BTC_TESTNET_COIN, 1, 17, 23, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fetch and validate ETH address 0', async () => {
    const res = await makeRequest(helpers.ETH_COIN, 0, 0, 0);
    helpers.validateETHAddresses(res, jobData, activeWalletSeed); 
  })

  it('Should fetch and validate BTC addresses 10-19', async () => {
    const res = await makeRequest(helpers.BTC_COIN, 0, 10, 19);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed); 
  })

  it('Should wait while the wallet syncs new addresses (BTC->39)', (done) => {
    waitForSync(20, done);
  })

  it('Should fetch and validate BTC change address 0', async () => {
    const res = await makeRequest(helpers.BTC_COIN, 1, 0, 0);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed); 
  })

  it('Should wait while the wallet syncs new addresses (BTC(change)->1)', (done) => {
    waitForSync(1, done);
  })

  it('Should fetch and validate BTC_TESTNET addresses 10-19', async () => {
    const res = await makeRequest(helpers.BTC_TESTNET_COIN, 0, 10, 19);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true); 
  })

  it('Should wait while the wallet syncs new addresses (BTC_TESTNET->39)', (done) => {
    waitForSync(20, done);
  })

  it('Should fetch and validate BTC_TESTNET change address 0', async () => {
    const res = await makeRequest(helpers.BTC_TESTNET_COIN, 1, 0, 0);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should wait while the wallet syncs new addresses (BTC_TESTNET(change)->1)', (done) => {
    waitForSync(1, done);
  })

  it('Should still fail to fetch ETH address 1 (because GAP_LIMIT=0)', async () => {
    await makeRequest(helpers.ETH_COIN, 0, 1, 1, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fail to fetch BTC address 40', async () => {
    await makeRequest(helpers.BTC_COIN, 0, 40, 40, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fail to fetch BTC_TESTNET address 40', async () => {
    await makeRequest(helpers.BTC_TESTNET_COIN, 0, 40, 40, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fetch and validate BTC addresses 17-23', async () => {
    const res = await makeRequest(helpers.BTC_COIN, 0, 17, 23);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should wait while the wallet syncs new addresses (BTC->43)', (done) => {
    waitForSync(4, done);
  })

  it('Should fail to fetch BTC address 44', async () => {
    await makeRequest(helpers.BTC_COIN, 0, 44, 44, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fetch and validate BTC address 30-38', async () => {
    const res = await makeRequest(helpers.BTC_COIN, 0, 30, 38);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should wait while the wallet syncs new addresses (BTC->58)', (done) => {
    waitForSync(15, done);
  })

  it('Should fetch and validate BTC change address 1', async () => {
    const res = await makeRequest(helpers.BTC_COIN, 1, 1, 1);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should wait while the wallet syncs new addresses (BTC(change)->2)', (done) => {
    waitForSync(1, done);
  })

  it('Should fail to fetch BTC_TESTNET address 40', async () => {
    await makeRequest(helpers.BTC_TESTNET_COIN, 0, 40, 40, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fetch and validate BTC_TESTNET addresses 17-23', async () => {
    const res = await makeRequest(helpers.BTC_TESTNET_COIN, 0, 17, 23);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should wait while the wallet syncs new addresses (BTC_TESTNET->43)', (done) => {
    waitForSync(4, done);
  })

  it('Should fail to fetch BTC_TESTNET address 44', async () => {
    await makeRequest(helpers.BTC_TESTNET_COIN, 0, 44, 44, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fetch and validate BTC_TESTNET address 30-38', async () => {
    const res = await makeRequest(helpers.BTC_TESTNET_COIN, 0, 30, 38);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should wait while the wallet syncs new addresses (BTC_TESTNET->58)', (done) => {
    waitForSync(15, done);
  })

  it('Should fetch and validate BTC_TESTNET change address 1', async () => {
    const res = await makeRequest(helpers.BTC_TESTNET_COIN, 1, 1, 1);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should wait while the wallet syncs new addresses (BTC_TESTNET(change)->2)', (done) => {
    waitForSync(1, done);
  })

  it('Should fail to fetch BTC addresses 59-61', async () => {
    await makeRequest(helpers.BTC_COIN, 0, 59, 61, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC address 59', async () => {
    await makeRequest(helpers.BTC_COIN, 0, 59, 59, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC change address 3', async () => {
    await makeRequest(helpers.BTC_COIN, 1, 3, 3, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC_TESTNET addresses 59-61', async () => {
    await makeRequest(helpers.BTC_TESTNET_COIN, 0, 59, 61, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC_TESTNET address 59', async () => {
    await makeRequest(helpers.BTC_TESTNET_COIN, 0, 59, 59, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC_TESTNET change address 3', async () => {
    await makeRequest(helpers.BTC_TESTNET_COIN, 1, 3, 3, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fetch and validate BTC address 58', async () => {
    const res = await makeRequest(helpers.BTC_COIN, 0, 58, 58);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should wait while the wallet syncs new addresses (BTC->78)', (done) => {
    waitForSync(20, done);
  })
  
  it('Should fetch and validate BTC_TESTNET address 58', async () => {
    const res = await makeRequest(helpers.BTC_TESTNET_COIN, 0, 58, 58);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should wait while the wallet syncs new addresses (BTC_TESTNET->78)', (done) => {
    waitForSync(20, done);
  })

  it('Should fetch and validate BTC address 36-45', async () => {
    const res = await makeRequest(helpers.BTC_COIN, 0, 36, 45);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should fail to fetch BTC address 70-79', async () => {
    await makeRequest(helpers.BTC_COIN, 1, 70, 79, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fetch and validate BTC address 70-78', async () => {
    const res = await makeRequest(helpers.BTC_COIN, 0, 70, 78);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should wait while the wallet syncs new addresses (BTC->99)', (done) => {
    waitForSync(20, done);
  })

  it('Should fetch and validate BTC_TESTNET address 36-45', async () => {
    const res = await makeRequest(helpers.BTC_TESTNET_COIN, 0, 36, 45);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should fail to fetch BTC_TESTNET address 70-79', async () => {
    await makeRequest(helpers.BTC_TESTNET_COIN, 1, 70, 79, helpers.gpErrors.GP_ENODATA);
  })
  
  it('Should fetch and validate BTC_TESTNET address 70-78', async () => {
    const res = await makeRequest(helpers.BTC_TESTNET_COIN, 0, 70, 78);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should wait while the wallet syncs new addresses (BTC_TESTNET->99)', (done) => {
    waitForSync(20, done);
  })

  it('Should fail to fetch BTC change address 3', async () => {
    await makeRequest(helpers.BTC_COIN, 1, 3, 3, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC_TESTNET change address 3', async () => {
    await makeRequest(helpers.BTC_TESTNET_COIN, 1, 3, 3, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fetch and validate BTC change address 2', async () => {
    const res = await makeRequest(helpers.BTC_COIN, 1, 2, 2);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should wait while the wallet syncs new addresses (BTC(change)->3)', (done) => {
    waitForSync(1, done);
  })

  it('Should fetch and validate BTC change address 3', async () => {
    const res = await makeRequest(helpers.BTC_COIN, 1, 3, 3);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should wait while the wallet syncs new addresses (BTC(change)->4)', (done) => {
    waitForSync(1, done);
  })

  it('Should fetch and validate BTC_TESTNET change address 2', async () => {
    const res = await makeRequest(helpers.BTC_TESTNET_COIN, 1, 2, 2);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should wait while the wallet syncs new addresses (BTC_TESTNET(change)->3)', (done) => {
    waitForSync(1, done);
  })

  it('Should fetch and validate BTC_TESTNET change address 3', async () => {
    const res = await makeRequest(helpers.BTC_TESTNET_COIN, 1, 3, 3);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should wait while the wallet syncs new addresses (BTC_TESTNET(change)->3)', (done) => {
    waitForSync(1, done);
  })

  it('Should fetch and validate BTC address 0-9', async () => {
    const res = await makeRequest(helpers.BTC_COIN, 0, 0, 9);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  });

  it('Should fetch and validate BTC change address 0', async () => {
    const res = await makeRequest(helpers.BTC_COIN, 1, 0, 0);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  });

  it('Should fetch and validate BTC_TESTNET address 0-9', async () => {
    const res = await makeRequest(helpers.BTC_TESTNET_COIN, 0, 0, 9);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  });

  it('Should fetch and validate BTC_TESTNET address 0', async () => {
    const res = await makeRequest(helpers.BTC_TESTNET_COIN, 1, 0, 0);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  });

})
