import { getDeviceId, getPrng } from '../utils/getters';
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

import bip32 from 'bip32';
import { mnemonicToSeedSync } from 'bip39';
import { privateToAddress, privateToPublic } from 'ethereumjs-util';
import { question } from 'readline-sync';
import { ecdsaRecover } from 'secp256k1';
import { Constants } from '../..';
import { HARDENED_OFFSET } from '../../constants';
import { parseDER, randomBytes } from '../../util';
import { DEFAULT_SIGNER } from '../utils/builders';
import {
  BTC_COIN,
  BTC_PURPOSE_P2PKH,
  BTC_PURPOSE_P2SH_P2WPKH,
  BTC_PURPOSE_P2WPKH,
  BTC_TESTNET_COIN,
  ETH_COIN,
  copyBuffer,
  deserializeExportSeedJobResult,
  deserializeGetAddressesJobResult,
  deserializeSignTxJobResult,
  getCodeMsg,
  gpErrors,
  jobTypes,
  parseWalletJobResp,
  serializeJobData,
  stringifyPath,
  validateBTCAddresses,
  validateDerivedPublicKeys,
  validateETHAddresses,
} from '../utils/helpers';
import { testRequest } from '../utils/testRequest';
import { setupClient } from '../utils/setup';

const id = getDeviceId();
//---------------------------------------
// STATE DATA
//---------------------------------------
let currentWalletUID: any,
  jobType: any,
  jobData: any,
  jobReq: any,
  origWalletSeed: any = null;

// Define the default parent path. We use BTC as the default
const BTC_PARENT_PATH = {
  pathDepth: 4,
  purpose: BTC_PURPOSE_P2SH_P2WPKH,
  coin: BTC_COIN,
  account: BTC_COIN,
  change: 0,
  addr: 0, // Not used for pathDepth=4
};
// For testing leading zero sigs
const KNOWN_MNEMONIC =
  'erosion loan violin drip laundry harsh social mercy leaf original habit buffalo';
const KNOWN_SEED = mnemonicToSeedSync(KNOWN_MNEMONIC);
const wallet = bip32.fromSeed(KNOWN_SEED);

describe('Test Wallet Jobs', () => {
  let client;

  test('pair', async () => {
    client = await setupClient();
  });

  it('Should make sure client has active wallets', async () => {
    expect(client.isPaired).toEqual(true);
    const EMPTY_WALLET_UID = Buffer.alloc(32);
    const internalUID = client.activeWallets.internal.uid;
    const externalUID = client.activeWallets.external.uid;
    expect(!EMPTY_WALLET_UID.equals(internalUID)).toEqualElseLog(
      true,
      'Internal A90 must be enabled.',
    );
    expect(!EMPTY_WALLET_UID.equals(externalUID)).toEqualElseLog(
      true,
      'P60 with exportable seed must be inserted.',
    );
    expect(!!client.getActiveWallet()).toEqualElseLog(
      true,
      'No active wallet discovered',
    );
    expect(!!client.getActiveWallet()?.uid.equals(externalUID)).toEqualElseLog(
      true,
      'P60 should be active wallet but is not registered as it.',
    );
    currentWalletUID = getCurrentWalletUID();
    const fwConstants = client.getFwConstants();
    if (fwConstants) {
      // If firmware supports bech32 segwit addresses, they are the default address
      BTC_PARENT_PATH.purpose = fwConstants.allowBtcLegacyAndSegwitAddrs
        ? BTC_PURPOSE_P2WPKH
        : BTC_PURPOSE_P2SH_P2WPKH;
    }
    // Make sure firmware works with signing requests
    if (client.getFwVersion().major === 0 && client.getFwVersion().minor < 15) {
      throw new Error('Please update Lattice firmware.');
    }
  });

  describe('exportSeed', () => {
    beforeEach(() => {
      jobType = jobTypes.WALLET_JOB_EXPORT_SEED;
      jobData = {};
      jobReq = {
        client,
        testID: 0, // wallet_job test ID
        payload: null,
      };
    });

    it('Should get GP_SUCCESS for a known, connected wallet', async () => {
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      const _res = await runTestCase(gpErrors.GP_SUCCESS);
      const res = deserializeExportSeedJobResult(_res.result);
      origWalletSeed = copyBuffer(res.seed);
    });

    it('Should get GP_ENODEV for unknown (random) wallet', async () => {
      const dummyWalletUID = randomBytes(32);
      jobReq.payload = serializeJobData(jobType, dummyWalletUID, jobData);
      await runTestCase(gpErrors.GP_ENODEV);
    });
  });

  describe('getAddresses', () => {
    beforeEach(() => {
      expect(origWalletSeed).not.toEqual(null);
      jobType = jobTypes.WALLET_JOB_GET_ADDRESSES;
      jobData = {
        path: {
          pathDepth: BTC_PARENT_PATH.pathDepth + 1,
          idx: [
            BTC_PARENT_PATH.purpose,
            BTC_PARENT_PATH.coin,
            BTC_PARENT_PATH.account,
            BTC_PARENT_PATH.change,
            BTC_PARENT_PATH.addr,
          ],
        },
        iterIdx: 4,
        count: 1,
      };
      jobReq = {
        client,
        testID: 0, // wallet_job test ID
        payload: null,
      };
    });

    it('Should get GP_SUCCESS for active wallet', async () => {
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      await runTestCase(gpErrors.GP_SUCCESS);
    });

    it('Should get GP_EWALLET for unknown (random) wallet', async () => {
      const dummyWalletUID = randomBytes(32);
      jobReq.payload = serializeJobData(jobType, dummyWalletUID, jobData);
      await runTestCase(gpErrors.GP_EWALLET);
    });

    it('Should get GP_EINVAL if `count` exceeds the max request size', async () => {
      jobData.count = 11;
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      await runTestCase(gpErrors.GP_EINVAL);
    });

    it('Should validate first ETH', async () => {
      jobData.path.idx[0] = BTC_PURPOSE_P2PKH;
      jobData.path.idx[1] = ETH_COIN;
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      const _res = await runTestCase(gpErrors.GP_SUCCESS);
      const res = deserializeGetAddressesJobResult(_res.result);
      validateETHAddresses(res, jobData, origWalletSeed);
    });

    it('Should validate an ETH address from a different EVM coin type', async () => {
      jobData.path.idx[0] = BTC_PURPOSE_P2PKH;
      jobData.path.idx[1] = HARDENED_OFFSET + 1007; // Fantom coin_type via SLIP44
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      const _res = await runTestCase(gpErrors.GP_SUCCESS);
      const res = deserializeGetAddressesJobResult(_res.result);
      validateETHAddresses(res, jobData, origWalletSeed);
    });

    it('Should validate the first BTC address', async () => {
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      const _res = await runTestCase(gpErrors.GP_SUCCESS);
      const res = deserializeGetAddressesJobResult(_res.result);
      validateBTCAddresses(res, jobData, origWalletSeed);
    });

    it('Should validate first BTC change address', async () => {
      jobData.path.idx[3] = 1;
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      const _res = await runTestCase(gpErrors.GP_SUCCESS);
      const res = deserializeGetAddressesJobResult(_res.result);
      validateBTCAddresses(res, jobData, origWalletSeed);
    });

    it('Should validate the first BTC address (testnet)', async () => {
      jobData.path.idx[1] = BTC_TESTNET_COIN;
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      const _res = await runTestCase(gpErrors.GP_SUCCESS);
      const res = deserializeGetAddressesJobResult(_res.result);
      validateBTCAddresses(res, jobData, origWalletSeed, true);
    });

    it('Should validate first BTC change address (testnet)', async () => {
      jobData.path.idx[3] = 1;
      jobData.path.idx[1] = BTC_TESTNET_COIN;
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      const _res = await runTestCase(gpErrors.GP_SUCCESS);
      const res = deserializeGetAddressesJobResult(_res.result);
      validateBTCAddresses(res, jobData, origWalletSeed, true);
    });

    it('Should fetch a set of BTC addresses', async () => {
      const req = {
        startPath: [BTC_PURPOSE_P2SH_P2WPKH, BTC_COIN, BTC_COIN, 0, 28802208],
        n: 3,
      };
      const addrs = await client.getAddresses(req);
      const resp = {
        count: addrs.length,
        addresses: addrs,
      };
      const jobData = {
        path: {
          pathDepth: 5,
          idx: req.startPath,
        },
        count: req.n,
        iterIdx: 4,
      };
      validateBTCAddresses(resp, jobData, origWalletSeed);
    });

    it('Should fetch a set of BTC addresses (bech32)', async () => {
      const req = {
        startPath: [BTC_PURPOSE_P2WPKH, BTC_COIN, BTC_COIN, 0, 28802208],
        n: 3,
      };
      const addrs = await client.getAddresses(req);
      const resp = {
        count: addrs.length,
        addresses: addrs,
      };
      const jobData = {
        path: {
          pathDepth: 5,
          idx: req.startPath,
        },
        count: req.n,
        iterIdx: 4,
      };
      validateBTCAddresses(resp, jobData, origWalletSeed);
    });

    it('Should fetch a set of BTC addresses (legacy)', async () => {
      const req = {
        startPath: [BTC_PURPOSE_P2PKH, BTC_COIN, BTC_COIN, 0, 28802208],
        n: 3,
      };
      const addrs = await client.getAddresses(req);
      const resp = {
        count: addrs.length,
        addresses: addrs,
      };
      const jobData = {
        path: {
          pathDepth: 5,
          idx: req.startPath,
        },
        count: req.n,
        iterIdx: 4,
      };
      validateBTCAddresses(resp, jobData, origWalletSeed);
    });

    it('Should fetch address with nonstandard path', async () => {
      const req = {
        startPath: [BTC_PURPOSE_P2SH_P2WPKH, BTC_COIN, 2532356, 5828, 28802208],
        n: 3,
      };
      const addrs: any = await client.getAddresses(req);
      const resp = {
        count: addrs.length,
        addresses: addrs,
      };
      const jobData = {
        path: {
          pathDepth: 5,
          idx: req.startPath,
        },
        count: req.n,
        iterIdx: 4,
      };
      // Let the validator know this is a nonstandard purpose
      validateBTCAddresses(resp, jobData, origWalletSeed);
    });

    it('Should fail to fetch from path with an unknown currency type', async () => {
      const req = {
        startPath: [
          BTC_PURPOSE_P2SH_P2WPKH,
          BTC_COIN + 2,
          2532356,
          5828,
          28802208,
        ],
        n: 3,
      };

      await expect(client.getAddresses(req)).rejects.toThrow();
    });

    it('Should validate address with pathDepth=4', async () => {
      const req = {
        startPath: [BTC_PURPOSE_P2PKH, ETH_COIN, 2532356, 7],
        n: 3,
      };
      const addrs: any = await client.getAddresses(req);
      const resp = {
        count: addrs.length,
        addresses: addrs,
      };
      const jobData = {
        path: {
          pathDepth: 4,
          idx: req.startPath,
        },
        count: req.n,
        iterIdx: 3,
      };
      validateETHAddresses(resp, jobData, origWalletSeed);
    });

    it('Should validate address with pathDepth=3', async () => {
      const req = {
        startPath: [BTC_PURPOSE_P2PKH, ETH_COIN, 2532356],
        n: 3,
      };
      const addrs: any = await client.getAddresses(req);
      const resp = {
        count: addrs.length,
        addresses: addrs,
      };
      const jobData = {
        path: {
          pathDepth: 3,
          idx: req.startPath,
        },
        count: req.n,
        iterIdx: 2,
      };
      validateETHAddresses(resp, jobData, origWalletSeed);
    });

    it('Should validate random Bitcoin addresses of all types', async () => {
      const prng = getPrng('btctestseed');
      async function testRandomBtcAddrs(purpose: number) {
        const account = Math.floor((HARDENED_OFFSET + 100000) * prng.quick());
        const addr = Math.floor((HARDENED_OFFSET + 100000) * prng.quick());
        const req = {
          startPath: [purpose, BTC_COIN, account, 0, addr],
          n: 1,
        };
        const addrs: any = await client.getAddresses(req);
        const resp = {
          count: addrs.length,
          addresses: addrs,
        };
        const jobData = {
          path: {
            pathDepth: 5,
            idx: req.startPath,
          },
          count: req.n,
          iterIdx: 4,
        };
        validateBTCAddresses(resp, jobData, origWalletSeed);
      }

      // Wrapped Segwit (x3)
      await testRandomBtcAddrs(BTC_PURPOSE_P2WPKH);
      await testRandomBtcAddrs(BTC_PURPOSE_P2WPKH);
      await testRandomBtcAddrs(BTC_PURPOSE_P2WPKH);
      // Legacy (x3)
      await testRandomBtcAddrs(BTC_PURPOSE_P2PKH);
      await testRandomBtcAddrs(BTC_PURPOSE_P2PKH);
      await testRandomBtcAddrs(BTC_PURPOSE_P2PKH);
      // Segwit (x3)
      await testRandomBtcAddrs(BTC_PURPOSE_P2WPKH);
      await testRandomBtcAddrs(BTC_PURPOSE_P2WPKH);
      await testRandomBtcAddrs(BTC_PURPOSE_P2WPKH);
    });

    it('Should test export of SECP256K1 public keys', async () => {
      const req = {
        // Test with random coin_type to ensure we can export pubkeys for
        // any derivation path
        startPath: [BTC_PURPOSE_P2SH_P2WPKH, 19497, HARDENED_OFFSET, 0, 0],
        n: 3,
        flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
      };
      // Should fail to export keys from a path with unhardened indices
      const pubkeys = await client.getAddresses(req);
      validateDerivedPublicKeys(
        pubkeys,
        req.startPath,
        origWalletSeed,
        req.flag,
      );
    });

    it('Should test export of ED25519 public keys', async () => {
      const req = {
        startPath: [BTC_PURPOSE_P2SH_P2WPKH, ETH_COIN, 0],
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
        validateDerivedPublicKeys(
          pubkeys,
          req.startPath,
          origWalletSeed,
          req.flag,
        );
      }
    });
  });

  describe('signTx', () => {
    beforeEach(() => {
      expect(origWalletSeed).not.toEqualElseLog(
        null,
        'Prior test failed. Aborting.',
      );
      jobType = jobTypes.WALLET_JOB_SIGN_TX;
      const path = JSON.parse(JSON.stringify(BTC_PARENT_PATH));
      path.pathDepth = 5;
      jobData = {
        numRequests: 1,
        sigReq: [
          {
            data: randomBytes(32),
            signerPath: path,
          },
        ],
      };
      jobReq = {
        client,
        testID: 0, // wallet_job test ID
        payload: null,
      };
    });

    it('Should get GP_SUCCESS for active wallet', async () => {
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      const _res = await runTestCase(gpErrors.GP_SUCCESS);
      const res = deserializeSignTxJobResult(_res.result);
      // Ensure correct number of outputs returned
      expect(res.numOutputs).toEqual(jobData.numRequests);
      // Ensure signatures validate against provided pubkey
      const outputKey = res.outputs[0]?.pubkey;
      const outputPubStr = outputKey.getPublic().encode('hex', false);
      expect(
        outputKey.verify(jobData.sigReq[0].data, res.outputs[0].sig),
      ).toEqual(true);
      // Ensure pubkey is correctly derived
      const wallet = bip32.fromSeed(origWalletSeed);
      const derivedKey = wallet.derivePath(
        stringifyPath(jobData.sigReq[0].signerPath),
      );
      const derivedPubStr = `04${privateToPublic(
        derivedKey.privateKey,
      ).toString('hex')}`;
      expect(outputPubStr).toEqual(derivedPubStr);
    });

    it('Should get GP_SUCCESS for signing out of shorter (but allowed) paths', async () => {
      jobData.sigReq[0].signerPath = {
        pathDepth: 3,
        purpose: BTC_PURPOSE_P2PKH,
        coin: ETH_COIN,
        account: 1572,
        change: 0, // Not used for pathDepth=3
        addr: 0, // Not used for pathDepth=4
      };
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      const _res = await runTestCase(gpErrors.GP_SUCCESS);
      const res = deserializeSignTxJobResult(_res.result);
      // Ensure correct number of outputs returned
      expect(res.numOutputs).toEqual(jobData.numRequests);
      // Ensure signatures validate against provided pubkey
      const outputKey = res.outputs[0].pubkey;
      const outputPubStr = outputKey.getPublic().encode('hex', false);
      expect(
        outputKey.verify(jobData.sigReq[0].data, res.outputs[0].sig),
      ).toEqual(true);
      // Ensure pubkey is correctly derived
      const wallet = bip32.fromSeed(origWalletSeed);
      const derivedKey = wallet.derivePath(
        stringifyPath(jobData.sigReq[0].signerPath),
      );
      const derivedPubStr = `04${privateToPublic(
        derivedKey.privateKey,
      ).toString('hex')}`;
      expect(outputPubStr).toEqual(derivedPubStr);
    });

    it('Should get GP_EWALLET for unknown (random) wallet', async () => {
      const dummyWalletUID = randomBytes(32);
      jobReq.payload = serializeJobData(jobType, dummyWalletUID, jobData);
      await runTestCase(gpErrors.GP_EWALLET);
    });

    it('Should get GP_EWALLET for known wallet that is inactive', async () => {
      const EMPTY_WALLET_UID = Buffer.alloc(32);
      const wallets = client.activeWallets;

      // This test requires a wallet on each interface, which means the active wallet needs
      // to be external and the internal wallet needs to exist.
      const ERR_MSG =
        'ERROR: This test requires an enabled Lattice wallet and active SafeCard wallet!';
      expect(copyBuffer(wallets.external.uid).toString('hex')).toEqualElseLog(
        currentWalletUID.toString('hex'),
        ERR_MSG,
      );
      expect(
        copyBuffer(wallets.internal.uid).toString('hex'),
      ).not.toEqualElseLog(EMPTY_WALLET_UID.toString('hex'), ERR_MSG);
      const incurrentWalletUID = copyBuffer(wallets.internal.uid);
      jobReq.payload = serializeJobData(jobType, incurrentWalletUID, jobData);
      await runTestCase(gpErrors.GP_EWALLET);
    });

    it('Should get GP_EINVAL when `numRequests` is 0', async () => {
      jobData.numRequests = 0;
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      await runTestCase(gpErrors.GP_EINVAL);
    });

    it('Should get GP_EINVAL when `numRequests` exceeds the max allowed', async () => {
      jobData.numRequests = 11;
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      await runTestCase(gpErrors.GP_EINVAL);
    });

    it('Should return GP_EINVAL when a signer `pathDepth` is of invalid size', async () => {
      jobData.sigReq[0].signerPath.pathDepth = 1;
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      await runTestCase(gpErrors.GP_EINVAL);
      jobData.sigReq[0].signerPath.pathDepth = 6;
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      await runTestCase(gpErrors.GP_EINVAL);
      jobData.sigReq[0].signerPath.pathDepth = 5;
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      await runTestCase(gpErrors.GP_SUCCESS);
    });

    it('Should get GP_SUCCESS when signing from a non-ETH EVM path', async () => {
      jobData.sigReq[0].signerPath.coin = HARDENED_OFFSET + 1007;
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      await runTestCase(gpErrors.GP_SUCCESS);
    });
  });

  // NOTE: These tests will only pass for SafeCard applets >=v2.3
  describe('SafeCard applet `extraData` operations', () => {
    const mnemonic_12 =
      'need flight merit nation wolf cannon leader convince law shift cotton crouch';
    const mnemonic_24 =
      'silly actress ice spot noise unlock adjust clog verify idle chicken venue arrest ' +
      'bitter output task file awesome language viable dolphin artist dismiss into';
    beforeEach(() => {
      expect(origWalletSeed).not.toEqualElseLog(
        null,
        'Prior test failed. Aborting.',
      );
      jobReq = {
        client,
        testID: 0, // wallet_job test ID
        payload: null,
      };
    });

    it('Should remove the current seed', async () => {
      jobReq.payload = serializeJobData(
        jobTypes.WALLET_JOB_DELETE_SEED,
        currentWalletUID,
        { iface: 1 },
      );
      await runTestCase(gpErrors.GP_SUCCESS);
    });

    it('Should load a 12 word mnemonic', async () => {
      jobReq.payload = serializeJobData(
        jobTypes.WALLET_JOB_LOAD_SEED,
        currentWalletUID,
        {
          iface: 1, // external SafeCard interface
          mnemonic: mnemonic_12,
          seed: mnemonicToSeedSync(mnemonic_12),
          exportability: 2, // always exportable
        },
      );
      await runTestCase(gpErrors.GP_SUCCESS);
    });

    it('Should reconnect to update the wallet UIDs', async () => {
      await client.connect(process.env.DEVICE_ID);
      currentWalletUID = getCurrentWalletUID();
    });

    it('Should export and validate the presence of the mnemonic', async () => {
      jobReq.payload = serializeJobData(
        jobTypes.WALLET_JOB_EXPORT_SEED,
        currentWalletUID,
        {},
      );
      const res = await runTestCase(gpErrors.GP_SUCCESS);
      const { mnemonic } = deserializeExportSeedJobResult(res.result);
      expect(mnemonic).to.equal(mnemonic_12);
    });

    it('Should remove the current seed', async () => {
      jobReq.payload = serializeJobData(
        jobTypes.WALLET_JOB_DELETE_SEED,
        currentWalletUID,
        { iface: 1 },
      );
      await runTestCase(gpErrors.GP_SUCCESS);
    });

    it('Should load a 24 word mnemonic', async () => {
      jobReq.payload = serializeJobData(
        jobTypes.WALLET_JOB_LOAD_SEED,
        currentWalletUID,
        {
          iface: 1, // external SafeCard interface
          mnemonic: mnemonic_24,
          seed: mnemonicToSeedSync(mnemonic_24),
          exportability: 2, // always exportable
        },
      );
      await runTestCase(gpErrors.GP_SUCCESS);
    });

    it('Should reconnect to update the wallet UIDs', async () => {
      await client.connect(process.env.DEVICE_ID);
      currentWalletUID = getCurrentWalletUID();
    });

    it('Should export and validate the presence of the mnemonic', async () => {
      jobReq.payload = serializeJobData(
        jobTypes.WALLET_JOB_EXPORT_SEED,
        currentWalletUID,
        {},
      );
      const res = await runTestCase(gpErrors.GP_SUCCESS);
      const { mnemonic } = deserializeExportSeedJobResult(res.result);
      expect(mnemonic).to.equal(mnemonic_24);
    });
  });

  describe('Test leading zeros', () => {
    beforeEach(() => {
      expect(origWalletSeed).not.toEqualElseLog(
        null,
        'Prior test failed. Aborting.',
      );
    });
    let basePath = DEFAULT_SIGNER;
    let parentPathStr = "m/44'/60'/0'/0";

    it('Should remove the current seed', async () => {
      jobType = jobTypes.WALLET_JOB_DELETE_SEED;
      jobData = {
        iface: 1,
      };
      jobReq = {
        client,
        testID: 0, // wallet_job test ID
        payload: null,
      };
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      await runTestCase(gpErrors.GP_SUCCESS);
    });

    it('Should load a known seed', async () => {
      jobType = jobTypes.WALLET_JOB_LOAD_SEED;
      jobData = {
        iface: 1, // external SafeCard interface
        seed: KNOWN_SEED,
        mnemonic: KNOWN_MNEMONIC,
        exportability: 2, // always exportable
      };
      jobReq = {
        client,
        testID: 0, // wallet_job test ID
        payload: null,
      };
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      await runTestCase(gpErrors.GP_SUCCESS);
    });

    it('Should reconnect to update the wallet UIDs', async () => {
      await client.connect(id);
      currentWalletUID = getCurrentWalletUID();
    });

    it('Should export and validate the presence of the mnemonic', async () => {
      jobReq.payload = serializeJobData(
        jobTypes.WALLET_JOB_EXPORT_SEED,
        currentWalletUID,
        {},
      );
      const res = await runTestCase(gpErrors.GP_SUCCESS);
      const { mnemonic } = deserializeExportSeedJobResult(res.result);
      expect(mnemonic).to.equal(KNOWN_MNEMONIC);
    });

    it('Should make sure the first address is correct', async () => {
      const ref = `0x${privateToAddress(
        wallet.derivePath(`${parentPathStr}/0`).privateKey,
      )
        .toString('hex')
        .toLowerCase()}`;
      const addrs = (await client.getAddresses({
        startPath: basePath,
        n: 1,
      })) as string[];
      if (addrs[0]?.toLowerCase() !== ref) {
        expect(addrs[0]?.toLowerCase()).toEqualElseLog(
          ref,
          'Failed to derive correct address for known seed',
        );
      }
    });

    // One leading privKey zero -> P(1/256)
    it("Should test address m/44'/60'/0'/0/396 (1 leading zero byte)", async () => {
      await runZerosTest(basePath, parentPathStr, 396, 1);
    });
    it("Should test address m/44'/60'/0'/0/406 (1 leading zero byte)", async () => {
      await runZerosTest(basePath, parentPathStr, 406, 1);
    });
    it("Should test address m/44'/60'/0'/0/668 (1 leading zero byte)", async () => {
      await runZerosTest(basePath, parentPathStr, 668, 1);
    });

    // Two leading privKey zeros -> P(1/65536)
    it("Should test address m/44'/60'/0'/0/71068 (2 leading zero bytes)", async () => {
      await runZerosTest(basePath, parentPathStr, 71068, 2);
    });
    it("Should test address m/44'/60'/0'/0/82173 (2 leading zero bytes)", async () => {
      await runZerosTest(basePath, parentPathStr, 82173, 2);
    });

    // Three leading privKey zeros -> P(1/16777216)
    // Unlikely any user ever runs into these but I wanted to derive the addrs for funsies
    it("Should test address m/44'/60'/0'/0/11981831 (3 leading zero bytes)", async () => {
      await runZerosTest(basePath, parentPathStr, 11981831, 3);
    });

    // Pubkeys are also used in the signature process, so we need to test paths with
    // leading zeros in the X component of the pubkey (compressed pubkeys are used)
    // We will test with a modification to the base path, which will produce a pubkey
    // with a leading zero byte.
    // We want this leading-zero pubkey to be a parent derivation path to then
    // test all further derivations
    it('Should switch to testing public keys', async () => {
      parentPathStr = "m/44'/60'/0'";
      basePath[3] = 153;
      basePath = basePath.slice(0, 4);
    });

    // There should be no problems with the parent path here because the result
    // is the leading-zero pubkey directly. Since we do not do a further derivation
    // with that leading-zero pubkey, there should never be any issues.
    it("Should test address m/44'/60'/0'/153", async () => {
      await runZerosTest(basePath, parentPathStr, 153, 1, true);
    });

    it('Should prepare for one more derivation step', async () => {
      parentPathStr = "m/44'/60'/0'/153";
      basePath.push(0);
    });

    // Now we will derive one more step with the leading zero pubkey feeding
    // into the derivation. This tests an edge case in firmware.
    it("Should test address m/44'/60'/0'/153/0", async () => {
      await runZerosTest(basePath, parentPathStr, 0, 0);
    });

    it("Should test address m/44'/60'/0'/153/1", async () => {
      await runZerosTest(basePath, parentPathStr, 1, 0);
    });

    it("Should test address m/44'/60'/0'/153/5", async () => {
      await runZerosTest(basePath, parentPathStr, 5, 0);
    });

    it("Should test address m/44'/60'/0'/153/10000", async () => {
      await runZerosTest(basePath, parentPathStr, 10000, 0);
    });

    it("Should test address m/44'/60'/0'/153/9876543", async () => {
      await runZerosTest(basePath, parentPathStr, 9876543, 0);
    });
  });

  describe('deleteSeed', () => {
    beforeEach(() => {
      expect(origWalletSeed).not.toEqualElseLog(
        null,
        'Prior test failed. Aborting.',
      );
      jobType = jobTypes.WALLET_JOB_DELETE_SEED;
      jobData = {
        iface: 1,
      };
      jobReq = {
        client,
        testID: 0, // wallet_job test ID
        payload: null,
      };
    });

    it('Should get GP_EINVAL for unknown (random) wallet', async () => {
      const dummyWalletUID = randomBytes(32);
      jobReq.payload = serializeJobData(jobType, dummyWalletUID, jobData);
      await runTestCase(gpErrors.GP_EINVAL);
    });

    it('Should get GP_SUCCESS for a known, connected wallet.', async () => {
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      await runTestCase(gpErrors.GP_SUCCESS);
    });
  });

  describe('Load Original Seed Back', () => {
    beforeEach(() => {
      expect(origWalletSeed).not.toEqualElseLog(
        null,
        'Prior test failed. Aborting.',
      );
      jobType = jobTypes.WALLET_JOB_LOAD_SEED;
      jobData = {
        iface: 1, // external SafeCard interface
        seed: origWalletSeed,
        exportability: 2, // always exportable
      };
      jobReq = {
        client,
        testID: 0, // wallet_job test ID
        payload: null,
      };
    });

    it('Should get GP_EINVAL if `exportability` option is invalid', async () => {
      jobData.exportability = 3; // past range
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      await runTestCase(gpErrors.GP_EINVAL);
    });

    it('Should get GP_SUCCESS when valid seed is provided to valid interface', async () => {
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      await runTestCase(gpErrors.GP_SUCCESS);
    });

    it('Should reconnect to update the wallet UIDs', async () => {
      await client.connect(id);
      currentWalletUID = getCurrentWalletUID();
    });

    it('Should ensure export seed matches the seed we just loaded', async () => {
      // Export the seed and make sure it matches!
      jobType = jobTypes.WALLET_JOB_EXPORT_SEED;
      jobData = {};
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      const _res = await runTestCase(gpErrors.GP_SUCCESS);
      const res = deserializeExportSeedJobResult(_res.result);
      const exportedSeed = copyBuffer(res.seed);
      expect(exportedSeed.toString('hex')).toEqual(
        origWalletSeed.toString('hex'),
      );
    });

    // Test both safecard and a90
    it('Should get GP_FAILURE if interface already has a seed', async () => {
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      await runTestCase(gpErrors.GP_FAILURE);
    });

    // Wait for user to remove safecard
    it('Should get GP_EAGAIN when trying to load seed into SafeCard when none exists', async () => {
      question(
        'Please remove your SafeCard to run this test.\n' +
          'Press enter to continue.',
      );
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      await runTestCase(gpErrors.GP_EAGAIN);
    });

    it('Should wait for the card to be re-inserted', async () => {
      question(
        '\nPlease re-insert and unlock your SafeCard to continue.\n' +
          'Press enter to continue.',
      );
      jobType = jobTypes.WALLET_JOB_EXPORT_SEED;
      jobData = {};
      jobReq.payload = serializeJobData(jobType, currentWalletUID, jobData);
      const _res = await runTestCase(gpErrors.GP_SUCCESS);
      const res = deserializeExportSeedJobResult(_res.result);
      const currentSeed = copyBuffer(res.seed);
      expect(currentSeed.toString('hex')).toEqual(
        origWalletSeed.toString('hex'),
      );
    });
  });

  //---------------------------------------
  // HELPERS
  //---------------------------------------
  async function runTestCase(expectedCode: any) {
    const res = await testRequest(jobReq);
    //@ts-expect-error - accessing private property
    const parsedRes = parseWalletJobResp(res, client.fwVersion);
    expect(parsedRes.resultStatus).toEqualElseLog(
      expectedCode,
      getCodeMsg(parsedRes.resultStatus, expectedCode),
    );
    return parsedRes;
  }

  function getCurrentWalletUID() {
    return copyBuffer(client.getActiveWallet()?.uid);
  }

  async function runZerosTest(
    path: Array,
    parentPathStr: string,
    idx: any,
    numZeros: number,
    testPub = false,
  ) {
    const w = wallet.derivePath(`${parentPathStr}/${idx}`);
    const refPriv = w.privateKey;
    const refPub = privateToPublic(refPriv);
    for (let i = 0; i < numZeros; i++) {
      if (testPub) {
        expect(refPub[i]).toEqualElseLog(
          0,
          `Should be ${numZeros} leading pubKey zeros but got ${i}.`,
        );
      } else {
        expect(refPriv[i]).toEqualElseLog(
          0,
          `Should be ${numZeros} leading privKey zeros but got ${i}.`,
        );
      }
    }
    const refPubStr = '04' + refPub.toString('hex');
    // Validate the exported address
    path[path.length - 1] = idx;
    const ref = `0x${privateToAddress(refPriv).toString('hex').toLowerCase()}`;
    const addrs = (await client.getAddresses({
      startPath: path,
      n: 1,
    })) as string[];
    if (addrs[0]?.toLowerCase() !== ref) {
      expect(addrs[0]?.toLowerCase()).toEqualElseLog(
        ref,
        'Failed to derive correct address for known seed',
      );
    }
    // Build the wallet job
    const signerPath = {
      pathDepth: path.length,
      purpose: path.length > 0 ? path[0] : 0,
      coin: path.length > 1 ? path[1] : 0,
      account: path.length > 2 ? path[2] : 0,
      change: path.length > 3 ? path[3] : 0,
      addr: path.length > 4 ? path[4] : 0,
    };
    const randomTxHash = Buffer.from(
      '704229f2128653abd86fbec078e4c50a28d1ce059bb26222c40a5cb0bc45733b',
      'hex',
    );
    jobType = jobTypes.WALLET_JOB_SIGN_TX;
    jobData = {
      numRequests: 1,
      sigReq: [
        {
          data: randomTxHash,
          signerPath,
        },
      ],
    };
    jobReq = {
      client,
      testID: 0, // wallet_job test ID
      payload: serializeJobData(jobType, currentWalletUID, jobData),
    };
    const _res = await runTestCase(gpErrors.GP_SUCCESS);
    const res = deserializeSignTxJobResult(_res.result);
    expect(res.numOutputs).to.equal(1);
    const signerPubStr = res.outputs[0].pubkey
      .getPublic()
      .encode('hex', false)
      .toString('hex');
    // Make sure the exported signer matches expected
    expect(signerPubStr).toEqualElseLog(refPubStr, 'Incorrect signer');
    // Make sure we can recover the same signer from the sig.
    const { r, s } = parseDER(res.outputs[0].sig);
    // Concatenate the R|S components. Note that sometimes these get
    // prefixed with a `00` byte which we need to slice off.
    const rs = Buffer.concat([r.slice(-32), s.slice(-32)]);
    const r0 = Buffer.from(ecdsaRecover(rs, 0, randomTxHash, false)).toString(
      'hex',
    );
    const r1 = Buffer.from(ecdsaRecover(rs, 1, randomTxHash, false)).toString(
      'hex',
    );
    const isR0 = r0 === signerPubStr && r0 === refPubStr;
    const isR1 = r1 === signerPubStr && r1 === refPubStr;
    expect(isR0 || isR1, 'Incorrect signer');
  }
});
