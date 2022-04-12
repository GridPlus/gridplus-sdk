/**
 * Tests against the wallet_jobs module in Lattice firmware. These tests use
 * the `test` hook, which is not available in production firmware. Most of these
 * tests are automatic, but a few signing requests are also included.
 * 
 * The main purpose of these tests is to validation derivations for a known
 * seed in Lattice firmware.
 * 
 * To run these tests you will need a dev Lattice with: `FEATURE_TEST_RUNNER=1`
 */

import Common, { Chain, Hardfork } from '@ethereumjs/common';
import { TransactionFactory as EthTxFactory } from '@ethereumjs/tx';
import bip32 from 'bip32';
import { mnemonicToSeedSync } from 'bip39';
import { expect } from 'chai';
import { question } from 'readline-sync';
import { privateToAddress, privateToPublic } from 'ethereumjs-util';
import seedrandom from 'seedrandom';
import { getFwVersionConst, HARDENED_OFFSET } from '../src/constants';
import { randomBytes } from '../src/util'
import { Constants } from '../src/index'
import helpers from './testUtil/helpers';

//---------------------------------------
// STATE DATA
//---------------------------------------
let client,
  currentWalletUID,
  jobType,
  jobData,
  jobReq,
  origWalletSeed = null,
  continueTests = true;
// Define the default parent path. We use BTC as the default
const BTC_PARENT_PATH = {
  pathDepth: 4,
  purpose: helpers.BTC_PURPOSE_P2SH_P2WPKH,
  coin: helpers.BTC_COIN,
  account: helpers.BTC_COIN,
  change: 0,
  addr: 0, // Not used for pathDepth=4
};
// For testing leading zero sigs
let parentPathStr = 'm/44\'/60\'/0\'/0';
let basePath = [ helpers.BTC_PURPOSE_P2PKH, helpers.ETH_COIN, HARDENED_OFFSET, 0, 0 ];
const mnemonic =
  'erosion loan violin drip laundry harsh social mercy leaf original habit buffalo';
const KNOWN_SEED = mnemonicToSeedSync(mnemonic);
const wallet = bip32.fromSeed(KNOWN_SEED);
//---------------------------------------
// TESTS
//---------------------------------------
describe('Test Wallet Jobs', () => {
  before(() => {
    client = helpers.setupTestClient(process.env);
  });

  beforeEach(() => {
    expect(continueTests).to.equal(
      true, 
      'Error in previous test. Aborting.'
    );
    continueTests = false;
  })

  it('Should connect to a Lattice and make sure it is already paired.', async () => {
    expect(process.env.DEVICE_ID).to.not.equal(null);
    await client.connect(process.env.DEVICE_ID);
    expect(client.isPaired).to.equal(true);
    const EMPTY_WALLET_UID = Buffer.alloc(32);
    const internalUID = client.activeWallets.internal.uid;
    const externalUID = client.activeWallets.external.uid;
    const checkOne = !EMPTY_WALLET_UID.equals(internalUID);
    const checkTwo = !EMPTY_WALLET_UID.equals(externalUID);
    const checkThree = !!client.hasActiveWallet();
    const checkFour = !!client.getActiveWallet().uid.equals(externalUID);
    continueTests = checkOne && checkTwo && checkThree && checkFour;
    expect(checkOne).to.equal(true, 'Internal A90 must be enabled.');
    expect(checkTwo).to.equal(
      true,
      'P60 with exportable seed must be inserted.'
    );
    expect(checkThree).to.equal(true, 'No active wallet discovered');
    expect(checkFour).to.equal(
      true,
      'P60 should be active wallet but is not registered as it.'
    );
    currentWalletUID = getCurrentWalletUID();
    const fwConstants = getFwVersionConst(client.fwVersion);
    if (fwConstants) {
      // If firmware supports bech32 segwit addresses, they are the default address
      BTC_PARENT_PATH.purpose = fwConstants.allowBtcLegacyAndSegwitAddrs
        ? helpers.BTC_PURPOSE_P2WPKH
        : helpers.BTC_PURPOSE_P2SH_P2WPKH;
    }
    // Make sure firmware works with signing requests
    if (client.fwVersion.major === 0 && client.fwVersion.minor < 15) {
      throw new Error('Please update Lattice firmware.');
    }
    continueTests = true;
  });
});

describe('exportSeed', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(
      true,
      'Unauthorized or critical failure. Aborting'
    );
    continueTests = false;
    jobType = helpers.jobTypes.WALLET_JOB_EXPORT_SEED;
    jobData = {};
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    };
  });

  it('Should get GP_SUCCESS for a known, connected wallet', async () => {
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeExportSeedJobResult(_res.result);
    origWalletSeed = helpers.copyBuffer(res.seed);
    continueTests = true;
  });

  it('Should get GP_ENODEV for unknown (random) wallet', async () => {
    // Note: `randomBytes` returns a buffer from the `buffer/` module,
    // which fails on node's Buffer.isBuffer, so recast here
    const dummyWalletUID = Buffer.from(randomBytes(32));
    jobReq.payload = helpers.serializeJobData(jobType, dummyWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_ENODEV);
    continueTests = true;
  });
});

describe('getAddresses', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(
      true,
      'Unauthorized or critical failure. Aborting'
    );
    continueTests = false;
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
    };
  });

  it('Should get GP_SUCCESS for active wallet', async () => {
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
    continueTests = true;
  });

  it('Should get GP_EWALLET for unknown (random) wallet', async () => {
    const dummyWalletUID = Buffer.from(randomBytes(32));
    jobReq.payload = helpers.serializeJobData(jobType, dummyWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EWALLET);
    continueTests = true;
  });

  it('Should get GP_EINVAL if `count` exceeds the max request size', async () => {
    jobData.count = 11;
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    await runTestCase(helpers.gpErrors.GP_EINVAL);
    continueTests = true;
  });

  it('Should validate first ETH', async () => {
    jobData.parent.purpose = helpers.BTC_PURPOSE_P2PKH;
    jobData.parent.coin = helpers.ETH_COIN;
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateETHAddresses(res, jobData, origWalletSeed);
    continueTests = true;
  });

  it('Should validate an ETH address from a different EVM coin type', async () => {
    jobData.parent.purpose = helpers.BTC_PURPOSE_P2PKH;
    jobData.parent.coin = HARDENED_OFFSET + 1007; // Fantom coin_type via SLIP44
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateETHAddresses(res, jobData, origWalletSeed);
    continueTests = true;
  });

  it('Should validate the first BTC address', async () => {
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateBTCAddresses(res, jobData, origWalletSeed);
    continueTests = true;
  });

  it('Should validate first BTC change address', async () => {
    jobData.parent.change = 1;
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateBTCAddresses(res, jobData, origWalletSeed);
    continueTests = true;
  });

  it('Should validate the first BTC address (testnet)', async () => {
    jobData.parent.coin = helpers.BTC_TESTNET_COIN;
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateBTCAddresses(res, jobData, origWalletSeed, true);
    continueTests = true;
  });

  it('Should validate first BTC change address (testnet)', async () => {
    jobData.parent.change = 1;
    jobData.parent.coin = helpers.BTC_TESTNET_COIN;
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeGetAddressesJobResult(_res.result);
    helpers.validateBTCAddresses(res, jobData, origWalletSeed, true);
    continueTests = true;
  });

  it('Should fetch a set of BTC addresses', async () => {
    const req = {
      startPath: [
        helpers.BTC_PURPOSE_P2SH_P2WPKH,
        helpers.BTC_COIN,
        helpers.BTC_COIN,
        0,
        28802208,
      ],
      n: 3,
    };
    const addrs = await client.getAddresses(req);
    const resp = {
      count: addrs.length,
      addresses: addrs,
    };
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
    };
    helpers.validateBTCAddresses(resp, jobData, origWalletSeed);
    continueTests = true;
  });

  it('Should fetch a set of BTC addresses (bech32)', async () => {
    const req = {
      startPath: [
        helpers.BTC_PURPOSE_P2WPKH,
        helpers.BTC_COIN,
        helpers.BTC_COIN,
        0,
        28802208,
      ],
      n: 3,
    };
    const addrs = await client.getAddresses(req);
    const resp = {
      count: addrs.length,
      addresses: addrs,
    };
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
    };
    helpers.validateBTCAddresses(resp, jobData, origWalletSeed);
    continueTests = true;
  });

  it('Should fetch a set of BTC addresses (legacy)', async () => {
    const req = {
      startPath: [
        helpers.BTC_PURPOSE_P2PKH,
        helpers.BTC_COIN,
        helpers.BTC_COIN,
        0,
        28802208,
      ],
      n: 3,
    };
    const addrs = await client.getAddresses(req);
    const resp = {
      count: addrs.length,
      addresses: addrs,
    };
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
    };
    helpers.validateBTCAddresses(resp, jobData, origWalletSeed);
    continueTests = true;
  });

  it('Should fetch address with nonstandard path', async () => {
    const req = {
      startPath: [
        helpers.BTC_PURPOSE_P2SH_P2WPKH,
        helpers.BTC_COIN,
        2532356,
        5828,
        28802208,
      ],
      n: 3,
    };
    const addrs: any = await client.getAddresses(req);
    const resp = {
      count: addrs.length,
      addresses: addrs,
    };
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
    };
    // Let the validator know this is a nonstandard purpose
    helpers.validateBTCAddresses(resp, jobData, origWalletSeed);
    continueTests = true;
  });

  it('Should fail to fetch from path with an unknown currency type', async () => {
    const req = {
      startPath: [
        helpers.BTC_PURPOSE_P2SH_P2WPKH,
        helpers.BTC_COIN + 2,
        2532356,
        5828,
        28802208,
      ],
      n: 3,
    };
    try {
      await client.getAddresses(req);
    } catch (err) {
      continueTests = true;
    }
  });

  it('Should validate address with pathDepth=4', async () => {
    const req = {
      startPath: [
        helpers.BTC_PURPOSE_P2SH_P2WPKH,
        helpers.ETH_COIN,
        2532356,
        7,
      ],
      n: 3,
    };
    const addrs: any = await client.getAddresses(req);
    const resp = {
      count: addrs.length,
      addresses: addrs,
    };
    const jobData = {
      parent: {
        pathDepth: 3,
        purpose: req.startPath[0],
        coin: req.startPath[1],
        account: req.startPath[2],
      },
      count: req.n,
      first: req.startPath[3],
    };
    helpers.validateETHAddresses(resp, jobData, origWalletSeed);
    continueTests = true;
  });

  it('Should validate address with pathDepth=3', async () => {
    const req = {
      startPath: [helpers.BTC_PURPOSE_P2SH_P2WPKH, helpers.ETH_COIN, 2532356],
      n: 3,
    };
    const addrs: any = await client.getAddresses(req);
    const resp = {
      count: addrs.length,
      addresses: addrs,
    };
    const jobData = {
      parent: {
        pathDepth: 2,
        purpose: req.startPath[0],
        coin: req.startPath[1],
      },
      count: req.n,
      first: req.startPath[2],
    };
    helpers.validateETHAddresses(resp, jobData, origWalletSeed);
    continueTests = true;
  });

  it('Should validate random Bitcoin addresses of all types', async () => {
    const prng = new seedrandom('btctestseed');
    async function testRandomBtcAddrs(purpose) {
      const account = Math.floor(
        (HARDENED_OFFSET + 100000) * prng.quick()
      );
      const addr = Math.floor(
        (HARDENED_OFFSET + 100000) * prng.quick()
      );
      const req = {
        startPath: [purpose, helpers.BTC_COIN, account, 0, addr],
        n: 1,
      };
      const addrs: any = await client.getAddresses(req);
      const resp = {
        count: addrs.length,
        addresses: addrs,
      };
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
      };
      helpers.validateBTCAddresses(resp, jobData, origWalletSeed);
    }

    // Wrapped Segwit (x3)
    await testRandomBtcAddrs(helpers.BTC_PURPOSE_P2WPKH);
    await testRandomBtcAddrs(helpers.BTC_PURPOSE_P2WPKH);
    await testRandomBtcAddrs(helpers.BTC_PURPOSE_P2WPKH);
    // Legacy (x3)
    await testRandomBtcAddrs(helpers.BTC_PURPOSE_P2PKH);
    await testRandomBtcAddrs(helpers.BTC_PURPOSE_P2PKH);
    await testRandomBtcAddrs(helpers.BTC_PURPOSE_P2PKH);
    // Segwit (x3)
    await testRandomBtcAddrs(helpers.BTC_PURPOSE_P2WPKH);
    await testRandomBtcAddrs(helpers.BTC_PURPOSE_P2WPKH);
    await testRandomBtcAddrs(helpers.BTC_PURPOSE_P2WPKH);
    continueTests = true;
  });

  it('Should test export of SECP256K1 public keys', async () => {
    const req = {
      // Test with random coin_type to ensure we can export pubkeys for
      // any derivation path
      startPath: [helpers.BTC_PURPOSE_P2SH_P2WPKH, 19497, HARDENED_OFFSET, 0, 0],
      n: 3,
      flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
    };
    // Should fail to export keys from a path with unhardened indices
    const pubkeys = await client.getAddresses(req);
    helpers.validateDerivedPublicKeys(pubkeys, req.startPath, origWalletSeed, req.flag);
    continueTests = true;
  })

  it('Should test export of ED25519 public keys', async () => {
    const req = {
      startPath: [helpers.BTC_PURPOSE_P2SH_P2WPKH, helpers.ETH_COIN, 0],
      n: 3,
      flag: Constants.GET_ADDR_FLAGS.ED25519_PUB,
    };
    try {
      // Should fail to export keys from a path with unhardened indices
      await client.getAddresses(req);
    } catch (err) {
      // Convert to all hardened indices and expect success
      req.startPath[2] = HARDENED_OFFSET;
      const pubkeys = await client.getAddresses(req);
      helpers.validateDerivedPublicKeys(pubkeys, req.startPath, origWalletSeed, req.flag);
      continueTests = true;
    }
  })
});

describe('signTx', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(
      true,
      'Unauthorized or critical failure. Aborting'
    );
    continueTests = false;
    expect(origWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
    jobType = helpers.jobTypes.WALLET_JOB_SIGN_TX;
    const path = JSON.parse(JSON.stringify(BTC_PARENT_PATH));
    path.pathDepth = 5;
    jobData = {
      numRequests: 1,
      sigReq: [
        {
          data: Buffer.from(randomBytes(32)),
          signerPath: path,
        },
      ],
    };
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    };
  });

  it('Should get GP_SUCCESS for active wallet', async () => {
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeSignTxJobResult(_res.result);
    // Ensure correct number of outputs returned
    expect(res.numOutputs).to.equal(jobData.numRequests);
    // Ensure signatures validate against provided pubkey
    const outputKey = res.outputs[0].pubkey;
    const outputPubStr = outputKey.getPublic().encode('hex');
    expect(
      outputKey.verify(jobData.sigReq[0].data, res.outputs[0].sig)
    ).to.equal(true);
    // Ensure pubkey is correctly derived
    const wallet = bip32.fromSeed(origWalletSeed);
    const derivedKey = wallet.derivePath(
      helpers.stringifyPath(jobData.sigReq[0].signerPath)
    );
    const derivedPubStr = `04${privateToPublic(derivedKey.privateKey)
      .toString('hex')}`;
    expect(outputPubStr).to.equal(derivedPubStr);
    continueTests = true;
  });

  it('Should get GP_SUCCESS for signing out of shorter (but allowed) paths', async () => {
    jobData.sigReq[0].signerPath = {
      pathDepth: 3,
      purpose: helpers.BTC_PURPOSE_P2PKH,
      coin: helpers.ETH_COIN,
      account: 1572,
      change: 0, // Not used for pathDepth=3
      addr: 0, // Not used for pathDepth=4
    };
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeSignTxJobResult(_res.result);
    // Ensure correct number of outputs returned
    expect(res.numOutputs).to.equal(jobData.numRequests);
    // Ensure signatures validate against provided pubkey
    const outputKey = res.outputs[0].pubkey;
    const outputPubStr = outputKey.getPublic().encode('hex');
    expect(
      outputKey.verify(jobData.sigReq[0].data, res.outputs[0].sig)
    ).to.equal(true);
    // Ensure pubkey is correctly derived
    const wallet = bip32.fromSeed(origWalletSeed);
    const derivedKey = wallet.derivePath(
      helpers.stringifyPath(jobData.sigReq[0].signerPath)
    );
    const derivedPubStr = `04${privateToPublic(derivedKey.privateKey)
      .toString('hex')}`;
    expect(outputPubStr).to.equal(derivedPubStr);
    continueTests = true;
  });

  it('Should get GP_EWALLET for unknown (random) wallet', async () => {
    const dummyWalletUID = Buffer.from(randomBytes(32));
    jobReq.payload = helpers.serializeJobData(jobType, dummyWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EWALLET);
    continueTests = true;
  });

  it('Should get GP_EWALLET for known wallet that is inactive', async () => {
    const EMPTY_WALLET_UID = Buffer.alloc(32);
    const wallets = client.activeWallets;

    // This test requires a wallet on each interface, which means the active wallet needs
    // to be external and the internal wallet needs to exist.
    const ERR_MSG =
      'ERROR: This test requires an enabled Lattice wallet and active SafeCard wallet!';
    expect(helpers.copyBuffer(wallets.external.uid).toString('hex')).to.equal(
      currentWalletUID.toString('hex'),
      ERR_MSG
    );
    expect(
      helpers.copyBuffer(wallets.internal.uid).toString('hex')
    ).to.not.equal(EMPTY_WALLET_UID.toString('hex'), ERR_MSG);
    const incurrentWalletUID = helpers.copyBuffer(wallets.internal.uid);
    jobReq.payload = helpers.serializeJobData(
      jobType,
      incurrentWalletUID,
      jobData
    );
    await runTestCase(helpers.gpErrors.GP_EWALLET);
    continueTests = true;
  });

  it('Should get GP_EINVAL when `numRequests` is 0', async () => {
    jobData.numRequests = 0;
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    await runTestCase(helpers.gpErrors.GP_EINVAL);
    continueTests = true;
  });

  it('Should get GP_EINVAL when `numRequests` exceeds the max allowed', async () => {
    jobData.numRequests = 11;
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    await runTestCase(helpers.gpErrors.GP_EINVAL);
    continueTests = true;
  });

  it('Should return GP_EINVAL when a signer `pathDepth` is of invalid size', async () => {
    jobData.sigReq[0].signerPath.pathDepth = 1;
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    await runTestCase(helpers.gpErrors.GP_EINVAL);
    jobData.sigReq[0].signerPath.pathDepth = 6;
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    await runTestCase(helpers.gpErrors.GP_EINVAL);
    jobData.sigReq[0].signerPath.pathDepth = 5;
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
    continueTests = true;
  });

  it('Should get GP_SUCCESS when signing from a non-ETH EVM path', async () => {
    jobData.sigReq[0].signerPath.coin = HARDENED_OFFSET + 1007;
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
    continueTests = true;
  });
});

describe('Get delete permission', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Error in previous test. Aborting.');
  })

  it('Should get permission to remove seed.', () => {
    question(
      '\nThe following tests will remove your seed.\n' +
      'It should be added back in a later test, but these tests could fail!\n' +
      'Press enter to continue.'
    );
  });
});

describe('Test leading zeros', () => {
  beforeEach(() => {
    expect(origWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
    expect(continueTests).to.equal(
      true,
      'Unauthorized or critical failure. Aborting'
    );
    continueTests = false;
  });

  it('Should remove the current seed', async () => {
    jobType = helpers.jobTypes.WALLET_JOB_DELETE_SEED;
    jobData = {
      iface: 1,
    };
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    };
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
    continueTests = true;
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
    };
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
    continueTests = true;
  });

  it('Should wait for the user to remove and re-insert the card (triggering SafeCard wallet sync)', () => {
    question(
      '\nPlease remove your SafeCard, then re-insert and unlock it.\n' +
      'Press enter to continue.'
    );
    continueTests = true;
  });

  it('Should reconnect to update the wallet UIDs', async () => {
    await client.connect(process.env.DEVICE_ID);
    currentWalletUID = getCurrentWalletUID();
    continueTests = true;
  });

  it('Should make sure the first address is correct', async () => {
    const ref = `0x${privateToAddress(wallet.derivePath(`${parentPathStr}/0`).privateKey)
      .toString('hex')
      .toLowerCase()}`;
    const addrs = await client.getAddresses({ startPath: basePath, n: 1 });
    if (addrs[0].toLowerCase() !== ref) {
      continueTests = false;
      expect(addrs[0].toLowerCase()).to.equal(
        ref,
        'Failed to derive correct address for known seed'
      );
    }
    continueTests = true;
  });

  // One leading privKey zero -> P(1/256)
  it('Should test address m/44\'/60\'/0\'/0/396 (1 leading zero byte)', async () => {
    await runZerosTest(396, 1);
    continueTests = true;
  });
  it('Should test address m/44\'/60\'/0\'/0/406 (1 leading zero byte)', async () => {
    await runZerosTest(406, 1);
    continueTests = true;
  });
  it('Should test address m/44\'/60\'/0\'/0/668 (1 leading zero byte)', async () => {
    await runZerosTest(668, 1);
    continueTests = true;
  });

  // Two leading privKey zeros -> P(1/65536)
  it('Should test address m/44\'/60\'/0\'/0/71068 (2 leading zero bytes)', async () => {
    await runZerosTest(71068, 2);
    continueTests = true;
  });
  it('Should test address m/44\'/60\'/0\'/0/82173 (2 leading zero bytes)', async () => {
    await runZerosTest(82173, 2);
    continueTests = true;
  });

  // Three leading privKey zeros -> P(1/16777216)
  // Unlikely any user ever runs into these but I wanted to derive the addrs for funsies
  it('Should test address m/44\'/60\'/0\'/0/11981831 (3 leading zero bytes)', async () => {
    await runZerosTest(11981831, 3);
    continueTests = true;
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
    basePath = basePath.slice(0, 4);
    continueTests = true;
  });

  // There should be no problems with the parent path here because the result
  // is the leading-zero pubkey directly. Since we do not do a further derivation
  // with that leading-zero pubkey, there should never be any issues.
  it('Should test address m/44\'/60\'/0\'/153', async () => {
    await runZerosTest(153, 1, true);
    continueTests = true;
  });

  it('Should prepare for one more derivation step', async () => {
    parentPathStr = 'm/44\'/60\'/0\'/153';
    basePath.push(0);
    continueTests = true;
  });

  // Now we will derive one more step with the leading zero pubkey feeding
  // into the derivation. This tests an edge case in firmware.
  it('Should test address m/44\'/60\'/0\'/153/0', async () => {
    await runZerosTest(0, 0);
    continueTests = true;
  });

  it('Should test address m/44\'/60\'/0\'/153/1', async () => {
    await runZerosTest(1, 0);
    continueTests = true;
  });

  it('Should test address m/44\'/60\'/0\'/153/5', async () => {
    await runZerosTest(5, 0);
    continueTests = true;
  });

  it('Should test address m/44\'/60\'/0\'/153/10000', async () => {
    await runZerosTest(10000, 0);
    continueTests = true;
  });

  it('Should test address m/44\'/60\'/0\'/153/9876543', async () => {
    await runZerosTest(9876543, 0);
    continueTests = true;
  });
});

describe('deleteSeed', () => {
  beforeEach(() => {
    expect(origWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
    expect(continueTests).to.equal(
      true,
      'Unauthorized or critical failure. Aborting'
    );
    continueTests = false;
    jobType = helpers.jobTypes.WALLET_JOB_DELETE_SEED;
    jobData = {
      iface: 1,
    };
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    };
  });

  it('Should get GP_EINVAL for unknown (random) wallet', async () => {
    const dummyWalletUID = Buffer.from(randomBytes(32));
    jobReq.payload = helpers.serializeJobData(jobType, dummyWalletUID, jobData);
    await runTestCase(helpers.gpErrors.GP_EINVAL);
    continueTests = true;
  });

  it('Should get GP_SUCCESS for a known, connected wallet.', async () => {
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
    continueTests = true;
  });
});

describe('Load Original Seed Back', () => {
  beforeEach(() => {
    expect(origWalletSeed).to.not.equal(null, 'Prior test failed. Aborting.');
    expect(continueTests).to.equal(
      true,
      'Unauthorized or critical failure. Aborting'
    );
    continueTests = false;
    jobType = helpers.jobTypes.WALLET_JOB_LOAD_SEED;
    jobData = {
      iface: 1, // external SafeCard interface
      seed: origWalletSeed,
      exportability: 2, // always exportable
    };
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    };
  });

  it('Should get GP_EINVAL if `exportability` option is invalid', async () => {
    jobData.exportability = 3; // past range
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    await runTestCase(helpers.gpErrors.GP_EINVAL);
    continueTests = true;
  });

  it('Should get GP_SUCCESS when valid seed is provided to valid interface', async () => {
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
    continueTests = true;
  });

  it('Should wait for the user to remove and re-insert the card (triggering SafeCard wallet sync)', () => {
    question(
      '\n\nPlease remove your SafeCard, then re-insert and unlock it.\n' +
      'Press enter to continue.'
    );
    continueTests = true;
  });

  it('Should reconnect to update the wallet UIDs', async () => {
    await client.connect(process.env.DEVICE_ID);
    currentWalletUID = getCurrentWalletUID();
    continueTests = true;
  });

  it('Should ensure export seed matches the seed we just loaded', async () => {
    // Export the seed and make sure it matches!
    jobType = helpers.jobTypes.WALLET_JOB_EXPORT_SEED;
    jobData = {};
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeExportSeedJobResult(_res.result);
    const exportedSeed = helpers.copyBuffer(res.seed);
    expect(exportedSeed.toString('hex')).to.equal(
      origWalletSeed.toString('hex')
    );
    continueTests = true;
  });

  // Test both safecard and a90
  it('Should get GP_FAILURE if interface already has a seed', async () => {
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    await runTestCase(helpers.gpErrors.GP_FAILURE);
    continueTests = true;
  });

  // Wait for user to remove safecard
  it('Should get GP_EAGAIN when trying to load seed into SafeCard when none exists', async () => {
    question(
      'Please remove your SafeCard to run this test.\n' +
      'Press enter to continue.'
    );
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    await runTestCase(helpers.gpErrors.GP_EAGAIN);
    continueTests = true;
  });

  it('Should wait for the card to be re-inserted', async () => {
    question(
      '\nPlease re-insert and unlock your SafeCard to continue.\n' +
      'Press enter to continue.'
    );
    jobType = helpers.jobTypes.WALLET_JOB_EXPORT_SEED;
    jobData = {};
    jobReq.payload = helpers.serializeJobData(
      jobType,
      currentWalletUID,
      jobData
    );
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeExportSeedJobResult(_res.result);
    const currentSeed = helpers.copyBuffer(res.seed);
    expect(currentSeed.toString('hex')).to.equal(
      origWalletSeed.toString('hex')
    );
    continueTests = true;
  });
});

//---------------------------------------
// HELPERS
//---------------------------------------
async function runTestCase(expectedCode) {
  continueTests = false;
  const res = await client.test(jobReq);
  const parsedRes = helpers.parseWalletJobResp(res, client.fwVersion);
  continueTests = parsedRes.resultStatus === expectedCode;
  expect(parsedRes.resultStatus).to.equal(
    expectedCode,
    helpers.getCodeMsg(parsedRes.resultStatus, expectedCode)
  );
  continueTests = true;
  return parsedRes;
}

function getCurrentWalletUID() {
  return helpers.copyBuffer(client.getActiveWallet().uid);
}

async function runZerosTest(idx, numZeros, testPub = false) {
  const w = wallet.derivePath(`${parentPathStr}/${idx}`);
  const refPriv = w.privateKey;
  const refPub = privateToPublic(refPriv);
  for (let i = 0; i < numZeros; i++) {
    if (testPub) {
      expect(refPub[i]).to.equal(
        0,
        `Should be ${numZeros} leading pubKey zeros but got ${i}.`
      );
    } else {
      expect(refPriv[i]).to.equal(
        0,
        `Should be ${numZeros} leading privKey zeros but got ${i}.`
      );
    }
  }
  // Validate the exported address
  const path = basePath;
  path[path.length - 1] = idx;
  const ref = `0x${privateToAddress(refPriv).toString('hex').toLowerCase()}`;
  const addrs = await client.getAddresses({ startPath: path, n: 1 });
  if (addrs[0].toLowerCase() !== ref) {
    continueTests = false;
    expect(addrs[0].toLowerCase()).to.equal(
      ref,
      'Failed to derive correct address for known seed'
    );
  }
  // Validate the signer coming back from the sign request
  const tx = EthTxFactory.fromTxData({
    type: 1,
    gasPrice: 1200000000,
    nonce: 0,
    gasLimit: 50000,
    to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
    value: 1000000000000,
    data: '0x17e914679b7e160613be4f8c2d3203d236286d74eb9192f6d6f71b9118a42bb033ccd8e8',
  }, { 
    common: new Common({ 
      chain: Chain.Mainnet, hardfork: Hardfork.London 
    }) 
  });
  const txReq = {
    data: {
      signerPath: path,
      curveType: Constants.SIGNING.CURVES.SECP256K1,
      hashType: Constants.SIGNING.HASHES.KECCAK256,
      encodingType: Constants.SIGNING.ENCODINGS.EVM,
      payload: tx.getMessageToSign(false),
    }
  }
  const resp = await client.sign(txReq);
  // Make sure the exported signer matches expected
  expect(resp.pubkey.slice(1).toString('hex')).to.equal(
    refPub.toString('hex'), 
    'Incorrect signer'
  );
  // Make sure we can recover the same signer from the sig.
  // `getV` will only return non-null if it can successfully
  // ecrecover a pubkey that matches the one provided.
  expect(helpers.getV(tx, resp)).to.not.equal(
    null, 
    'Incorrect signer'
  );
}