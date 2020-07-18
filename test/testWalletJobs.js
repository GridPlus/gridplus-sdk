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
const bip32 = require('bip32')
const crypto = require('crypto');
const expect = require('chai').expect;
const ethutil = require('ethereumjs-util');
const cli = require('cli-interact');
const helpers = require('./testUtil/helpers');
let client, activeWalletUID, jobType, jobData, jobReq, activeWalletSeed=null, rmSeedAuth=false;

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
    // Make sure we have cached the first ETH address (for later tests)
    jobData.parent.coin = helpers.harden(60);
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    // Confirm there is only one address
    expect(res.count).to.equal(jobData.count);
    // Confirm it is an Ethereum address
    expect(res.addresses[0].slice(0, 2)).to.equal('0x');
    expect(res.addresses[0].length).to.equal(42);
    // Confirm we can derive the same address from the previously exported seed
    const wallet = bip32.fromSeed(activeWalletSeed);
    jobData.parent.pathDepth = 5;
    jobData.parent.addr = 0;
    const priv = wallet.derivePath(helpers.stringifyPath(jobData.parent)).privateKey;
    const addr = `0x${ethutil.privateToAddress(priv).toString('hex')}`;
    expect(addr).to.equal(res.addresses[0]);
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
    rmSeedAuth = cli.getYesNo(t);
    expect(rmSeedAuth).to.equal(true);
  })
})

describe('deleteSeed', () => {
  beforeEach (() => {
    expect(activeWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
    expect(rmSeedAuth).to.equal(true, 'Unauthorized. Aborting');
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
    expect(rmSeedAuth).to.equal(true, 'Unauthorized. Aborting');
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

  it('Should wait for the user to remove and re-insert the card', () => {
    const newQ = cli.getYesNo;
    const t = '\n\nPlease remove your SafeCard, then re-insert and unlock it.\nWait for addresses to sync!\n'+
              'Press Y when the card is re-inserted and addresses have finished syncing.';
    const answer = newQ(t);
    expect(answer).to.equal(true, 'You must remove, re-insert, and unlock your SafeCard to run this test.');
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
  })

  // Test both safecard and a90
  it('Should get GP_EOVERFLOW if interface already has a seed', async () => {
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EOVERFLOW);
  });

  // Wait for user to remove safecard
  it('Should get GP_EAGAIN when trying to load seed into SafeCard when none exists', async () => {
    const newQ = cli.getYesNo;
    const answer = newQ('Please remove your SafeCard to run this last test. Press Y when you have done so.');
    expect(answer).to.equal(true, 'You must remove your SafeCard when prompted to complete this test.');
    jobReq.payload = helpers.serializeJobData(jobType, activeWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EAGAIN);
  });  

})
