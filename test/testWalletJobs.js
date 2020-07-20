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
const bip32 = require('bip32');
const crypto = require('crypto');
const expect = require('chai').expect;
const ethutil = require('ethereumjs-util');
const cli = require('cli-interact');
const helpers = require('./testUtil/helpers');
let client, activeWalletUID, jobType, jobData, jobReq, activeWalletSeed=null, continueTests=false, validSeed=false;

async function runTestCase(expectedCode) {
    const res = await helpers.test(client, jobReq);
    const parsedRes = helpers.parseWalletJobResp(res);
    expect(parsedRes.resultStatus).to.equal(0);
    expect(helpers.jobResErrCode(parsedRes)).to.equal(expectedCode);
    return parsedRes;
}

describe('Test Wallet Jobs', () => {

  before(() => {
    client = helpers.setupTestClient(process.env);
  });

  it('Should connect to a Lattice and make sure it is already paired.', async () => {
    // Again, we assume that if an `id` has already been set, we are paired
    // with the hardcoded privkey above.
    expect(process.env.DEVICE_ID).to.not.equal(null);
    const connectErr = await helpers.connect(client, process.env.DEVICE_ID);
    expect(connectErr).to.equal(null);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);

    activeWalletUID = helpers.copyBuffer(client.getActiveWallet().uid)
  });

})

describe('exportSeed', () => {
  beforeEach(() => {
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
    expect(activeWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
    jobType = helpers.jobTypes.WALLET_JOB_GET_ADDRESSES;
    jobData = {
      parent: {
        pathDepth: 4,
        purpose: helpers.harden(44),
        coin: helpers.harden(0),
        account: helpers.harden(0),
        change: 0,
        addr: 0, // Not used for pathDepth=4
      },
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

  it('Should get GP_EINVAL when `pathDepth` is not 4', async () => {
    jobData.parent.pathDepth = 3;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
    jobData.parent.pathDepth = 5;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
    jobData.parent.pathDepth = 4;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  })

  it('Should get GP_ENODATA for unknown (random) wallet', async () => {
    const dummyWalletUID = crypto.randomBytes(32);
    jobReq.payload = helpers.serializeJobData(jobType, dummyWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_ENODATA);
  })

  it('Should get GP_ENODATA if `first` < num cached, but the `first` + `count` - 1 address is > num cached', async () => {
    jobData.parent.coin = helpers.harden(60); // We only cache 1 ETH address at a time
    jobData.count = 10;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_ENODATA);
  })

  it('Should get GP_ENODATA if `first` is > num cached', async () => {
    jobData.parent.coin = helpers.harden(60); // We only cache 1 ETH address at a time
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
    jobData.parent.coin = helpers.harden(60);
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateETHAddress(res, jobData, activeWalletSeed);
  })

  it('Should validate BTC addresses', async () => {
    // Request the first 5 BTC addresses. At least 20 should be cached on the device.
    jobData.count = 5;
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should validate first BTC_CHANGE address', async () => {
    jobData.parent.coin = helpers.harden(1);
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

})

describe('signTx', () => {
  beforeEach (() => {
    expect(activeWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
    jobType = helpers.jobTypes.WALLET_JOB_SIGN_TX;
    jobData = {
      numRequests: 1,
      sigReq: [{
        data: crypto.randomBytes(32),
        signerPath: {
          pathDepth: 5,
          purpose: helpers.harden(44),
          coin: helpers.harden(0),
          account: helpers.harden(0),
          change: 0,
          addr: 0,
        },
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

  it('Should return GP_EINVAL when a signer `pathDepth` is not 5 (full BIP44 depth)', async () => {
    jobData.sigReq[0].signerPath.pathDepth = 4;
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
    expect(continueTests).to.equal(true, 'Unauthorized. Aborting');
    jobType = helpers.jobTypes.WALLET_JOB_DELETE_SEED;
    jobData = {};
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    }
  })

  it('Should get GP_ENODEV for unknown (random) wallet', async () => {
    const dummyWalletUID = crypto.randomBytes(32);
    jobReq.payload = helpers.serializeJobData(jobType, dummyWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_ENODEV);
  })

  it('Should get GP_SUCCESS for a known, connected wallet.', async () => {
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  })
})

describe('loadSeed', () => {
  beforeEach (() => {
    expect(activeWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
    expect(continueTests).to.equal(true, 'Unauthorized. Aborting');
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
    validSeed = currentSeed.toString('hex') === activeWalletSeed.toString('hex')
    expect(currentSeed.toString('hex')).to.equal(activeWalletSeed.toString('hex'))
  })

})

describe('Wallet sync tests (starting with newly synced wallet)', () => {
  const ADDR_SYNC_TIMEOUT = 2000;

  beforeEach ((done) => {
    expect(activeWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
    expect(continueTests).to.equal(true, 'Unauthorized. Aborting');
    jobType = helpers.jobTypes.WALLET_JOB_GET_ADDRESSES;
    jobData = {
      parent: {
        pathDepth: 4,
        purpose: helpers.harden(44),
        coin: helpers.harden(0),
        account: helpers.harden(0),
        change: 0,
        addr: 0, // Not used for pathDepth=4
      },
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

  it('Should fail to fetch ETH address 1', async () => {
    await makeRequest(helpers.harden(60), 0, 1, 1, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fail to fetch BTC address 17-23', async () => {
    await makeRequest(helpers.harden(0), 0, 17, 23, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fail to fetch BTC address 20', async () => {
    await makeRequest(helpers.harden(0), 0, 20, 20, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fail to fetch BTC change address 1', async () => {
    await makeRequest(helpers.harden(0), 1, 1, 1, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fail to fetch BTC_TESTNET address 17-23', async () => {
    await makeRequest(helpers.harden(1), 0, 17, 23, helpers.gpErrors.GP_ENODATA); 
  })
  
  it('Should fail to fetch BTC_TESTNET address 20', async () => {
    await makeRequest(helpers.harden(1), 0, 20, 20, helpers.gpErrors.GP_ENODATA); 
  })
  
  it('Should fail to fetch BTC_TESTNET change address 1', async () => {
    await makeRequest(helpers.harden(1), 1, 17, 23, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fetch and validate ETH address 0', async () => {
    const res = await makeRequest(helpers.harden(60), 0, 0, 0);
    helpers.validateETHAddress(res, jobData, activeWalletSeed); 
  })

  it('Should fetch and validate BTC addresses 9-19', async () => {
    const res = await makeRequest(helpers.harden(0), 0, 9, 19);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed); 
  })

  it('Should wait while the wallet syncs new addresses', async () => {
    setTimeout(() => { expect(true).to.equal(true); }, 20 * ADDR_SYNC_TIMEOUT);
  })

  it('Should fetch and validate BTC change address 0', async () => {
    const res = await makeRequest(helpers.harden(0), 1, 0, 0);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed); 
  })

  it('Should fetch and validate BTC_TESTNET addresses 9-19', async () => {
    const res = await makeRequest(helpers.harden(1), 0, 9, 19);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true); 
  })

  it('Should wait while the wallet syncs new addresses', async () => {
    setTimeout(() => { expect(true).to.equal(true); }, 20 * ADDR_SYNC_TIMEOUT);
  })

  it('Should fetch and validate BTC_TESTNET change address 0', async () => {
    const res = await makeRequest(helpers.harden(1), 1, 0, 0);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should still fail to fetch ETH address 1 (because GAP_LIMIT=0)', async () => {
    await makeRequest(helpers.harden(60), 0, 1, 1, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fetch and validate BTC addresses 17-23', async () => {
    const res = await makeRequest(helpers.harden(0), 0, 17, 23);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should fetch and validate BTC address 30-38', async () => {
    const res = await makeRequest(helpers.harden(0), 0, 30, 38);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should fetch and validate BTC change address 1', async () => {
    const res = await makeRequest(helpers.harden(0), 1, 1, 1);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should fetch and validate BTC_TESTNET addresses 17-23', async () => {
    const res = await makeRequest(helpers.harden(1), 0, 17, 23);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should fetch and validate BTC_TESTNET address 30-38', async () => {
    const res = await makeRequest(helpers.harden(1), 0, 30, 38);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should fetch and validate BTC_TESTNET change address 1', async () => {
    const res = await makeRequest(helpers.harden(1), 1, 1, 1);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should fail to fetch BTC addresses 36-45', async () => {
    await makeRequest(helpers.harden(0), 0, 36, 45, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC address 40', async () => {
    await makeRequest(helpers.harden(0), 0, 40, 40, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC addresses 40-49', async () => {
    await makeRequest(helpers.harden(0), 0, 40, 49, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC change address 3', async () => {
    await makeRequest(helpers.harden(0), 1, 3, 3, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC_TESTNET addresses 36-45', async () => {
    await makeRequest(helpers.harden(1), 0, 36, 45, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC_TESTNET address 40', async () => {
    await makeRequest(helpers.harden(1), 0, 40, 40, true);
  })

  it('Should fail to fetch BTC_TESTNET addresses 40-49', async () => {
    await makeRequest(helpers.harden(1), 0, 40, 49, true);
  })

  it('Should fail to fetch BTC_TESTNET change address 3', async () => {
    await makeRequest(helpers.harden(1), 1, 3, 3, true);
  })

  it('Should fetch and validate BTC address 39', async () => {
    const res = await makeRequest(helpers.harden(0), 0, 39, 39);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should wait while the wallet syncs new addresses', async () => {
    setTimeout(() => { expect(true).to.equal(true); }, 20 * ADDR_SYNC_TIMEOUT);
  })
  
  it('Should fetch and validate BTC_TESTNET address 39', async () => {
    const res = await makeRequest(helpers.harden(1), 0, 39, 39);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should wait while the wallet syncs new addresses', async () => {
    setTimeout(() => { expect(true).to.equal(true); }, 20 * ADDR_SYNC_TIMEOUT);
  })

  it('Should fetch and validate BTC address 36-45', async () => {
    const res = await makeRequest(helpers.harden(0), 0, 36, 45);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should fetch and validate BTC address 50-59', async () => {
    const res = await makeRequest(helpers.harden(0), 0, 50, 59);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should wait while the wallet syncs new addresses', async () => {
    setTimeout(() => { expect(true).to.equal(true); }, 20 * ADDR_SYNC_TIMEOUT);
  })

  it('Should fetch and validate BTC_TESTNET address 36-45', async () => {
    const res = await makeRequest(helpers.harden(1), 0, 36, 45);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })
  
  it('Should fetch and validate BTC_TESTNET address 50-59', async () => {
    const res = await makeRequest(helpers.harden(1), 0, 50, 59);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should wait while the wallet syncs new addresses', async () => {
    setTimeout(() => { expect(true).to.equal(true); }, 20 * ADDR_SYNC_TIMEOUT);
  })

  it('Should fail to fetch BTC change address 3', async () => {
    await makeRequest(helpers.harden(0), 1, 3, 3, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC_TESTNET change address 3', async () => {
    await makeRequest(helpers.harden(1), 1, 3, 3);
  })

  it('Should fetch and validate BTC change address 2', async () => {
    const res = await makeRequest(helpers.harden(0), 1, 2, 2);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should fetch and validate BTC change address 3', async () => {
    const res = await makeRequest(helpers.harden(0), 1, 3, 3);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should fetch and validate BTC_TESTNET change address 2', async () => {
    const res = await makeRequest(helpers.harden(1), 1, 2, 2);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should fetch and validate BTC_TESTNET change address 3', async () => {
    const res = await makeRequest(helpers.harden(1), 1, 3, 3);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should fetch and validate BTC address 0-9', async () => {
    const res = await makeRequest(helpers.harden(0), 0, 0, 9);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  });

  it('Should fetch and validate BTC change address 0', async () => {
    const res = await makeRequest(helpers.harden(0), 1, 0, 0);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  });

  it('Should fetch and validate BTC_TESTNET address 0-9', async () => {
    const res = await makeRequest(helpers.harden(1), 0, 0, 9);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  });

  it('Should fetch and validate BTC_TESTNET address 0', async () => {
    const res = await makeRequest(helpers.harden(1), 1, 0, 0);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  });

  // Switch to wallet seed
  it('Should wait for the user to remove the card and should export the Lattice wallet seed', async () => {
    activeWalletSeed = null;
    activeWalletUID = null;
    const newQ = cli.getYesNo;
    const answer = newQ('\n\nPlease remove your SafeCard to continue. Press Y when you are done.');
    expect(answer).to.equal(true, 'You must remove your SafeCard when prompted to complete this test.');
    jobType = helpers.jobTypes.WALLET_JOB_EXPORT_SEED;
    jobData = {};
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeExportSeedJobResult(_res.result);
    activeWalletSeed = helpers.copyBuffer(res.seed);
    activeWalletUID = helpers.copyBuffer(client.getActiveWallet().uid)
  })

  it('Should delete the Lattice wallet seed', async () => {
    jobType = helpers.jobTypes.WALLET_JOB_DELETE_SEED;
    jobData = {};
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    }
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  })

  it('Should load the seed back into the Lattice wallet', async () => {
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
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  })

  it('Should wait for the user to insert and remove a card (triggering Lattice wallet cache)', async () => {
    const newQ = cli.getYesNo;
    const t = '\n\nPlease remove your SafeCard, then re-insert and unlock it.\nWait for addresses to sync!\n'+
              'Press Y when the card is re-inserted and addresses have finished syncing.';
    continueTests = newQ(t);
    expect(continueTests).to.equal(true, 'You must remove, re-insert, and unlock your SafeCard to run this test.');
  })

  it('Should fetch the Lattice wallet seed and ensure it matches', async () => {
    jobType = helpers.jobTypes.WALLET_JOB_EXPORT_SEED;
    jobData = {};
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeExportSeedJobResult(_res.result);
    const exportedSeed = helpers.copyBuffer(res.seed);
    expect(exportedSeed.toString('hex')).to.equal(activeWalletSeed.toString('hex'));
    if (exportedSeed.toString('hex') !== activeWalletSeed.toString('hex'))
      continueTests = false;
  })

  it('Should fail to fetch ETH address 1', async () => {
    await makeRequest(helpers.harden(60), 0, 1, 1, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fail to fetch BTC address 17-23', async () => {
    await makeRequest(helpers.harden(0), 0, 17, 23, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fail to fetch BTC address 20', async () => {
    await makeRequest(helpers.harden(0), 0, 20, 20, helpers.gpErrors.GP_ENODATA); 
  })
  
  it('Should fail to fetch BTC change address 1', async () => {
    await makeRequest(helpers.harden(0), 1, 1, 1, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fail to fetch BTC_TESTNET address 17-23', async () => {
    await makeRequest(helpers.harden(1), 0, 17, 23, helpers.gpErrors.GP_ENODATA); 
  })
  
  it('Should fail to fetch BTC_TESTNET address 20', async () => {
    await makeRequest(helpers.harden(1), 0, 20, 20, helpers.gpErrors.GP_ENODATA); 
  })
  
  it('Should fail to fetch BTC_TESTNET change address 1', async () => {
    await makeRequest(helpers.harden(1), 1, 17, 23, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fetch and validate ETH address 0', async () => {
    const res = await makeRequest(helpers.harden(60), 0, 0, 0);
    helpers.validateETHAddress(res, jobData, activeWalletSeed); 
  })

  it('Should fetch and validate BTC addresses 9-19', async () => {
    const res = await makeRequest(helpers.harden(0), 0, 9, 19);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed); 
  })

  it('Should wait while the wallet syncs new addresses', async () => {
    setTimeout(() => { expect(true).to.equal(true); }, 20 * ADDR_SYNC_TIMEOUT);
  })

  it('Should fetch and validate BTC change address 0', async () => {
    const res = await makeRequest(helpers.harden(0), 1, 0, 0);
    helpers.validateETHAddress(res, jobData, activeWalletSeed); 
  })

  it('Should fetch and validate BTC_TESTNET addresses 9-19', async () => {
    const res = await makeRequest(helpers.harden(1), 0, 9, 19);
    helpers.validateETHAddress(res, jobData, activeWalletSeed, true); 
  })

  it('Should wait while the wallet syncs new addresses', async () => {
    setTimeout(() => { expect(true).to.equal(true); }, 20 * ADDR_SYNC_TIMEOUT);
  })

  it('Should fetch and validate BTC_TESTNET change address 0', async () => {
    const res = await makeRequest(helpers.harden(1), 1, 0, 0);
    helpers.validateETHAddress(res, jobData, activeWalletSeed, true); 
  })

  it('Should still fail to fetch ETH address 1 (because GAP_LIMIT=0)', async () => {
    await makeRequest(helpers.harden(60), 0, 1, 1, helpers.gpErrors.GP_ENODATA); 
  })

  it('Should fetch and validate BTC addresses 17-23', async () => {
    const res = await makeRequest(helpers.harden(0), 0, 17, 23);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should fetch and validate BTC address 30-38', async () => {
    const res = await makeRequest(helpers.harden(0), 0, 30, 38);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should fetch and validate BTC change address 1', async () => {
    const res = await makeRequest(helpers.harden(0), 1, 1, 1);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed);
  })

  it('Should fetch and validate BTC_TESTNET addresses 17-23', async () => {
    const res = await makeRequest(helpers.harden(1), 0, 17, 23);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should fetch and validate BTC_TESTNET address 30-38', async () => {
    const res = await makeRequest(helpers.harden(1), 0, 30, 38);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should fetch and validate BTC_TESTNET change address 1', async () => {
    const res = await makeRequest(helpers.harden(1), 1, 1, 1);
    helpers.validateBTCAddresses(res, jobData, activeWalletSeed, true);
  })

  it('Should fail to fetch BTC addresses 36-45', async () => {
    await makeRequest(helpers.harden(0), 0, 36, 45, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC address 40', async () => {
    await makeRequest(helpers.harden(0), 0, 40, 40, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC addresses 40-49', async () => {
    await makeRequest(helpers.harden(0), 0, 40, 49, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC change address 3', async () => {
    await makeRequest(helpers.harden(0), 1, 3, 3, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC_TESTNET addresses 36-45', async () => {
    await makeRequest(helpers.harden(1), 0, 36, 45, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC_TESTNET address 40', async () => {
    await makeRequest(helpers.harden(1), 0, 40, 40, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC_TESTNET addresses 40-49', async () => {
    await makeRequest(helpers.harden(1), 0, 40, 49, helpers.gpErrors.GP_ENODATA);
  })

  it('Should fail to fetch BTC_TESTNET change address 3', async () => {
    await makeRequest(helpers.harden(1), 1, 3, 3, helpers.gpErrors.GP_ENODATA);
  })

})