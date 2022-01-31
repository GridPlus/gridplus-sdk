// You must have `FEATURE_TEST_RUNNER=1` enabled in firmware to run these tests.
require('it-each')({ testPerIteration: true });
import bip32 from 'bip32';
import { mnemonicToSeedSync } from 'bip39';
import { expect } from 'chai';
import crypto from 'crypto';
import { ecsign, privateToAddress } from 'ethereumjs-util';
import { keccak256 } from 'js-sha3';
import { question } from 'readline-sync';
import seedrandom from 'seedrandom';
import { HARDENED_OFFSET } from '../src/constants';
import helpers from './testUtil/helpers';

//---------
// Constants
//---------
const TEST_MNEMONIC =
  'nose elder baby marriage frequent list ' +
  'cargo swallow memory universe smooth involve ' +
  'iron purity throw vintage crew artefact ' +
  'pyramid dash split announce trend grain';
const TEST_SEED = mnemonicToSeedSync(TEST_MNEMONIC);
let client, activeWalletUID, jobType, jobData, jobReq, txReq, msgReq;
let latticeSeed = null,
  continueTests = true,
  skipSeedLoading = false,
  skipSeedRestore = false,
  skipNonExportableSeed = false;
const LEDGER_ROOT_PATH = [
  helpers.BTC_PURPOSE_P2PKH,
  helpers.ETH_COIN,
  HARDENED_OFFSET,
  0,
  0,
];
let numIter = 20;
if (process.env.N) numIter = parseInt(process.env.N);
const PRNG = new seedrandom(process.env.SEED || 'myrandomseed');

// Generate a bunch of random test vectors using the PRNG
const RANDOM_VEC = [];
const RANDOM_VEC_LABELS = [];
for (let i = 0; i < numIter; i++) {
  RANDOM_VEC.push(Math.floor(1000000000 * PRNG.quick()).toString(16));
  RANDOM_VEC_LABELS.push({ label: `${i + 1}/${numIter}`, number: i });
}

//---------
// Helpers
//---------
async function runTestCase(expectedCode) {
  const res: any = await helpers.execute(client, 'test', jobReq);
  const parsedRes = helpers.parseWalletJobResp(res, client.fwVersion);
  expect(parsedRes.resultStatus).to.equal(expectedCode);
  if (parsedRes.resultStatus !== expectedCode) continueTests = false;
  return parsedRes;
}

function getPathStr(path) {
  let pathStr = 'm';
  path.forEach((idx) => {
    if (idx >= HARDENED_OFFSET) {
      pathStr += `/${idx - HARDENED_OFFSET}'`;
    } else {
      pathStr += `/${idx}`;
    }
  });
  return pathStr;
}

function deriveAddress(seed, path) {
  const wallet = bip32.fromSeed(seed);
  const priv = wallet.derivePath(getPathStr(path)).privateKey;
  return `0x${privateToAddress(priv).toString('hex')}`;
}

function signPersonalJS(_msg, path) {
  const wallet = bip32.fromSeed(TEST_SEED);
  const priv = wallet.derivePath(getPathStr(path)).privateKey;
  const PERSONAL_SIGN_PREFIX = '\u0019Ethereum Signed Message:\n';
  const msg = PERSONAL_SIGN_PREFIX + String(_msg.length) + _msg;
  const hash: any = new Uint8Array(Buffer.from(keccak256(msg), 'hex'));
  const sig = ecsign(hash, priv);
  const v = (sig.v - 27).toString(16).padStart(2, '0');
  return `${sig.r.toString('hex')}${sig.s.toString('hex')}${v}`;
}

function getSigStr(sig) {
  const v = (parseInt(sig.v.toString('hex'), 16) - 27)
    .toString(16)
    .padStart(2, '0');
  return `${sig.r}${sig.s}${v}`;
}

function _setupJob (type, opts: any = {}) {
  if (type === helpers.jobTypes.WALLET_JOB_EXPORT_SEED) {
    jobType = type;
    jobData = {};
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    };
    jobReq.payload = helpers.serializeJobData(
      jobType,
      activeWalletUID,
      jobData
    );
    return;
  } else if (type === helpers.jobTypes.WALLET_JOB_DELETE_SEED) {
    jobType = type;
    jobData = {
      iface: 1,
    };
    jobReq = {
      testID: 0, // wallet_job test ID
      payload: null,
    };
    jobReq.payload = helpers.serializeJobData(
      jobType,
      activeWalletUID,
      jobData
    );
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
    };
    jobReq.payload = helpers.serializeJobData(
      jobType,
      activeWalletUID,
      jobData
    );
  }
}

//---------
// Tests
//---------
describe('Connect', () => {
  before(() => {
    // Setup the SDK client
    client = helpers.setupTestClient(process.env);
  });

  it('Should connect to a Lattice and make sure it is already paired.', async () => {
    expect(process.env.DEVICE_ID).to.not.equal(null);
    await helpers.connect(client, process.env.DEVICE_ID);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);
    activeWalletUID = helpers.copyBuffer(client.getActiveWallet().uid);
  });
});

describe('Test non-exportable seed on SafeCard (if available)', () => {
  // This needs to be done before tests that use the `test` API route because
  // there is some sort of bug related to directly submitting wallet jobs
  // and then switching EMV interfaces.
  // This bug does not affect any users of production devices since
  // the test route is commented out.
  // TODO: Remove this comment when bug is fixed in firmware.
  it('Should ask if the user wants to test a card with a non-exportable seed', async () => {
    // NOTE: non-exportable seeds were deprecated from the normal setup pathway in firmware v0.12.0
    const result = question(
      '\nIf you have a SafeCard with a NON-EXPORTABLE seed loaded, please insert and unlock it now.' +
        '\nDo you have a non-exportable SafeCard seed loaded and wish to continue? (Y/N) '
    );
    if (result.toLowerCase() !== 'y') {
      skipNonExportableSeed = true;
    }
  });
  it('Should validate non-exportable seed sigs all differ (from each other and from deterministic sigs)', async () => {
    if (skipNonExportableSeed) return;
    txReq = {
      currency: 'ETH',
      chainId: 1,
      data: {
        signerPath: LEDGER_ROOT_PATH,
        type: 2,
        maxFeePerGas: 1200000000,
        maxPriorityFeePerGas: 1200000000,
        nonce: 0,
        gasLimit: 50000,
        to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
        value: 100,
        data: '0xdeadbeef',
      },
    };
    // Validate that tx sigs are non-uniform
    txReq.data.signerPath[2] = HARDENED_OFFSET;
    const tx1_addr0: any = await helpers.execute(client, 'sign', txReq);
    const tx2_addr0: any = await helpers.execute(client, 'sign', txReq);
    const tx3_addr0: any = await helpers.execute(client, 'sign', txReq);
    const tx4_addr0: any = await helpers.execute(client, 'sign', txReq);
    const tx5_addr0: any = await helpers.execute(client, 'sign', txReq);
    expect(getSigStr(tx1_addr0.sig)).to.not.equal(getSigStr(tx2_addr0.sig));
    expect(getSigStr(tx1_addr0.sig)).to.not.equal(getSigStr(tx3_addr0.sig));
    expect(getSigStr(tx1_addr0.sig)).to.not.equal(getSigStr(tx4_addr0.sig));
    expect(getSigStr(tx1_addr0.sig)).to.not.equal(getSigStr(tx5_addr0.sig));

    // Validate that signPersonal message sigs are non-uniform and do not match deterministic ones
    let res, res2, jsSig, sig, sig2;
    const req = {
      currency: 'ETH_MSG',
      data: {
        signerPath: LEDGER_ROOT_PATH,
        protocol: 'signPersonal',
        payload: 'test message',
      },
    };
    // Address index 0
    req.data.signerPath[2] = HARDENED_OFFSET;
    jsSig = signPersonalJS(req.data.payload, req.data.signerPath);
    res = await helpers.execute(client, 'sign', req);
    sig = getSigStr(res.sig);
    expect(sig).to.not.equal(jsSig, 'Addr0 sig was not random');
    res2 = await helpers.execute(client, 'sign', req);
    sig2 = getSigStr(res2.sig);
    expect(sig2).to.not.equal(jsSig, 'Addr0 sig was not random');
    expect(sig2).to.not.equal(sig, 'Addr0 sig was not random');
    // Address index 1
    req.data.signerPath[2] = HARDENED_OFFSET + 1;
    jsSig = signPersonalJS(req.data.payload, req.data.signerPath);
    res = await helpers.execute(client, 'sign', req);
    sig = getSigStr(res.sig);
    expect(sig).to.not.equal(jsSig, 'Addr1 sig was not random');
    res2 = await helpers.execute(client, 'sign', req);
    sig2 = getSigStr(res2.sig);
    expect(sig2).to.not.equal(jsSig, 'Addr1 sig was not random');
    expect(sig2).to.not.equal(sig, 'Addr1 sig was not random');
    // Address index 8
    req.data.signerPath[2] = HARDENED_OFFSET + 8;
    jsSig = signPersonalJS(req.data.payload, req.data.signerPath);
    res = await helpers.execute(client, 'sign', req);
    sig = getSigStr(res.sig);
    expect(sig).to.not.equal(jsSig, 'Addr8 sig was not random');
    res2 = await helpers.execute(client, 'sign', req);
    sig2 = getSigStr(res2.sig);
    expect(sig2).to.not.equal(jsSig, 'Addr8 sig was not random');
    expect(sig2).to.not.equal(sig, 'Addr8 sig was not random');
  });
});

describe('Setup Test', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(
      true,
      'Unauthorized or critical failure. Aborting'
    );
  });

  it('Should find out if we need to load the seed', async () => {
    // Determine if we should skip the process of loading the test seed.
    // This should only be selected if the user has previously chosen not
    // to re-load the original seed at the end of this test script.
    const result = question(
      'Please insert and unlock a normal SafeCard (with an exportable seed).' +
        '\nDo you have the test seed loaded on this card already? (Y/N) '
    );
    if (result.toLowerCase() !== 'n') {
      skipSeedLoading = true;
    } else {
      // TODO: Remove this once firmware is fixed
      console.log(
        'WARNING: if you ran the non-exportable seed tests and also are trying ' +
          'to load a seed here, your tests will fail. This has to do with some ' +
          'edge case in the firmware test runner and EMV applet. We are looking into ' +
          'it but for now please do not use this combination. This issue only ' +
          'affects the test runner which is why it is not higher priority'
      );
    }
  });

  it('Should fetch the seed', async () => {
    if (skipSeedLoading) return;
    _setupJob(helpers.jobTypes.WALLET_JOB_EXPORT_SEED);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeExportSeedJobResult(_res.result);
    latticeSeed = helpers.copyBuffer(res.seed);
  });

  it('Should remove the seed', async () => {
    if (skipSeedLoading) return;
    _setupJob(helpers.jobTypes.WALLET_JOB_DELETE_SEED);
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  });

  it('Should load the known test seed', async () => {
    if (skipSeedLoading) return;
    _setupJob(helpers.jobTypes.WALLET_JOB_LOAD_SEED, { seed: TEST_SEED });
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  });

  it('Should wait for the user to remove and re-insert the card (triggering SafeCard wallet sync)', () => {
    if (skipSeedLoading) return;
    question(
      '\nPlease remove, re-insert, and unlock your SafeCard.\n' +
        'Press enter to continue after addresses have fully synced.'
    );
  });

  it('Should re-connect to the Lattice and update the walletUID.', async () => {
    expect(process.env.DEVICE_ID).to.not.equal(null);
    await helpers.connect(client, process.env.DEVICE_ID);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);
    activeWalletUID = helpers.copyBuffer(client.getActiveWallet().uid);
  });

  it('Should ensure export seed matches the test seed', async () => {
    _setupJob(helpers.jobTypes.WALLET_JOB_EXPORT_SEED);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeExportSeedJobResult(_res.result);
    const exportedSeed = helpers.copyBuffer(res.seed);
    expect(exportedSeed.toString('hex')).to.equal(
      TEST_SEED.toString('hex'),
      'Seeds did not match'
    );
    // Abort if this fails
    if (exportedSeed.toString('hex') !== TEST_SEED.toString('hex'))
      continueTests = false;
  });

  it('Should validate some Ledger addresses derived from the test seed', async () => {
    // These addresses were all fetched using MetaMask with a real ledger loaded with TEST_MNEOMNIC
    // NOTE: These are 0-indexed indices whereas MetaMask shows 1-indexed (addr0 -> metamask1)
    const path0 = [
      helpers.BTC_PURPOSE_P2PKH,
      helpers.ETH_COIN,
      HARDENED_OFFSET,
      0,
      0,
    ];
    const addr0 = '0x17E43083812d45040E4826D2f214601bc730F60C';
    const path1 = [
      helpers.BTC_PURPOSE_P2PKH,
      helpers.ETH_COIN,
      HARDENED_OFFSET + 1,
      0,
      0,
    ];
    const addr1 = '0xfb25a9D4472A55083042672e42309056763B667E';
    const path8 = [
      helpers.BTC_PURPOSE_P2PKH,
      helpers.ETH_COIN,
      HARDENED_OFFSET + 8,
      0,
      0,
    ];
    const addr8 = '0x8A520d7f70906Ebe00F40131791eFF414230Ea5c';
    // Derive these from the seed as a sanity check
    expect(deriveAddress(TEST_SEED, path0).toLowerCase()).to.equal(
      addr0.toLowerCase(),
      'Incorrect address 0 derived.'
    );
    expect(deriveAddress(TEST_SEED, path1).toLowerCase()).to.equal(
      addr1.toLowerCase(),
      'Incorrect address 1 derived.'
    );
    expect(deriveAddress(TEST_SEED, path8).toLowerCase()).to.equal(
      addr8.toLowerCase(),
      'Incorrect address 8 derived.'
    );
    // Fetch these addresses from the Lattice and validate

    const req = {
      currency: 'ETH',
      startPath: path0,
      n: 1,
    };
    const latAddr0 = await helpers.execute(client, 'getAddresses', req);
    expect(latAddr0[0].toLowerCase()).to.equal(
      addr0.toLowerCase(),
      'Incorrect address 0 fetched.'
    );
    req.startPath = path1;
    const latAddr1 = await helpers.execute(client, 'getAddresses', req);
    expect(latAddr1[0].toLowerCase()).to.equal(
      addr1.toLowerCase(),
      'Incorrect address 1 fetched.'
    );
    req.startPath = path8;
    const latAddr8 = await helpers.execute(client, 'getAddresses', req);
    expect(latAddr8[0].toLowerCase()).to.equal(
      addr8.toLowerCase(),
      'Incorrect address 8 fetched.'
    );
  });
});

describe('Test uniformity of Ethereum transaction sigs', () => {
  beforeEach(() => {
    txReq = {
      currency: 'ETH',
      chainId: 1,
      data: {
        signerPath: LEDGER_ROOT_PATH,
        type: 2,
        maxFeePerGas: 1200000000,
        maxPriorityFeePerGas: 1200000000,
        nonce: 0,
        gasLimit: 50000,
        to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
        value: 100,
        data: '0xdeadbeef',
      },
    };
  });

  it('Should validate uniformity of 5 consecutive tx signatures', async () => {
    try {
      txReq.data.signerPath[2] = HARDENED_OFFSET;
      const tx1_addr0: any = await helpers.execute(client, 'sign', txReq);
      const tx2_addr0: any = await helpers.execute(client, 'sign', txReq);
      const tx3_addr0: any = await helpers.execute(client, 'sign', txReq);
      const tx4_addr0: any = await helpers.execute(client, 'sign', txReq);
      const tx5_addr0: any = await helpers.execute(client, 'sign', txReq);
      expect(getSigStr(tx1_addr0.sig)).to.equal(
        getSigStr(tx2_addr0.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr0.sig)).to.equal(
        getSigStr(tx3_addr0.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr0.sig)).to.equal(
        getSigStr(tx4_addr0.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr0.sig)).to.equal(
        getSigStr(tx5_addr0.sig),
        'Txs not uniform:'
      );
      txReq.data.signerPath[2] = HARDENED_OFFSET + 1;
      const tx1_addr1: any = await helpers.execute(client, 'sign', txReq);
      const tx2_addr1: any = await helpers.execute(client, 'sign', txReq);
      const tx3_addr1: any = await helpers.execute(client, 'sign', txReq);
      const tx4_addr1: any = await helpers.execute(client, 'sign', txReq);
      const tx5_addr1: any = await helpers.execute(client, 'sign', txReq);
      expect(getSigStr(tx1_addr1.sig)).to.equal(
        getSigStr(tx2_addr1.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr1.sig)).to.equal(
        getSigStr(tx3_addr1.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr1.sig)).to.equal(
        getSigStr(tx4_addr1.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr1.sig)).to.equal(
        getSigStr(tx5_addr1.sig),
        'Txs not uniform:'
      );
      txReq.data.signerPath[2] = HARDENED_OFFSET + 8;
      const tx1_addr8: any = await helpers.execute(client, 'sign', txReq);
      const tx2_addr8: any = await helpers.execute(client, 'sign', txReq);
      const tx3_addr8: any = await helpers.execute(client, 'sign', txReq);
      const tx4_addr8: any = await helpers.execute(client, 'sign', txReq);
      const tx5_addr8: any = await helpers.execute(client, 'sign', txReq);
      expect(getSigStr(tx1_addr8.sig)).to.equal(
        getSigStr(tx2_addr8.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr8.sig)).to.equal(
        getSigStr(tx3_addr8.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr8.sig)).to.equal(
        getSigStr(tx4_addr8.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr8.sig)).to.equal(
        getSigStr(tx5_addr8.sig)
      );
    } catch (err) {
      expect(err.message).to.equal(null, 'Caught error: ');
    }
  });

  it('Should validate uniformity of 5 consecutive tx signatures (with oversized data)', async () => {
    try {
      txReq.data.data = `0x${crypto.randomBytes(4000).toString('hex')}`;
      txReq.data.signerPath[2] = HARDENED_OFFSET;
      const tx1_addr0: any = await helpers.execute(client, 'sign', txReq);
      const tx2_addr0: any = await helpers.execute(client, 'sign', txReq);
      const tx3_addr0: any = await helpers.execute(client, 'sign', txReq);
      const tx4_addr0: any = await helpers.execute(client, 'sign', txReq);
      const tx5_addr0: any = await helpers.execute(client, 'sign', txReq);
      expect(getSigStr(tx1_addr0.sig)).to.equal(
        getSigStr(tx2_addr0.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr0.sig)).to.equal(
        getSigStr(tx3_addr0.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr0.sig)).to.equal(
        getSigStr(tx4_addr0.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr0.sig)).to.equal(
        getSigStr(tx5_addr0.sig),
        'Txs not uniform:'
      );
      txReq.data.signerPath[2] = HARDENED_OFFSET + 1;
      const tx1_addr1: any = await helpers.execute(client, 'sign', txReq);
      const tx2_addr1: any = await helpers.execute(client, 'sign', txReq);
      const tx3_addr1: any = await helpers.execute(client, 'sign', txReq);
      const tx4_addr1: any = await helpers.execute(client, 'sign', txReq);
      const tx5_addr1: any = await helpers.execute(client, 'sign', txReq);
      expect(getSigStr(tx1_addr1.sig)).to.equal(
        getSigStr(tx2_addr1.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr1.sig)).to.equal(
        getSigStr(tx3_addr1.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr1.sig)).to.equal(
        getSigStr(tx4_addr1.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr1.sig)).to.equal(
        getSigStr(tx5_addr1.sig),
        'Txs not uniform:'
      );
      txReq.data.signerPath[2] = HARDENED_OFFSET + 8;
      const tx1_addr8: any = await helpers.execute(client, 'sign', txReq);
      const tx2_addr8: any = await helpers.execute(client, 'sign', txReq);
      const tx3_addr8: any = await helpers.execute(client, 'sign', txReq);
      const tx4_addr8: any = await helpers.execute(client, 'sign', txReq);
      const tx5_addr8: any = await helpers.execute(client, 'sign', txReq);
      expect(getSigStr(tx1_addr8.sig)).to.equal(
        getSigStr(tx2_addr8.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr8.sig)).to.equal(
        getSigStr(tx3_addr8.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr8.sig)).to.equal(
        getSigStr(tx4_addr8.sig),
        'Txs not uniform:'
      );
      expect(getSigStr(tx1_addr8.sig)).to.equal(
        getSigStr(tx5_addr8.sig),
        'Txs not uniform:'
      );
    } catch (err) {
      expect(err.message).to.equal(null, 'Caught error: ');
    }
  });
});

describe('Compare personal_sign signatures vs Ledger vectors (1)', () => {
  beforeEach(() => {
    msgReq = {
      currency: 'ETH_MSG',
      data: {
        signerPath: LEDGER_ROOT_PATH,
        protocol: 'signPersonal',
        payload: 'hello ethereum',
      },
    };
  });

  it('Should validate signature from addr0', async () => {
    const expected =
      '4820a558ab69907c90141f4857f54a7d71e7791f84478fef7b9a3e5b200ee242' + // r
      '529cc19a58ed8fa017510d24a443b757018834b3e3585a7199168d3af4b3837e' + // s
      '01'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath);
      expect(sig).to.equal(jsSig, 'JS sig does not match');
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });

  it('Should validate signature from addr1', async () => {
    const expected =
      'c292c988b26ae24a06a8270f2794c259ec5742168ed77cd635cba041f767a569' + // r
      '2e4d218a02ba0b5f82b80488ccc519b67fb37a9f4cbb1d35d9ce4b99e8afcc18' + // s
      '01'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET + 1;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath);
      expect(sig).to.equal(jsSig, 'JS sig does not match');
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });
  it('Should validate signature from addr8', async () => {
    const expected =
      '60cadafdbb7cba590a37eeff854d2598af71904077312875ef7b4f525d4dcb52' + // r
      '5903ae9e4b7e61f6f24abfe9a1d5fb1375347ef6a48f7abe2319c89f426eb27c' + // s
      '00'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET + 8;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath);
      expect(sig).to.equal(jsSig, 'JS sig does not match');
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });
});

describe('Compare personal_sign signatures vs Ledger vectors (2)', () => {
  beforeEach(() => {
    msgReq = {
      currency: 'ETH_MSG',
      data: {
        signerPath: LEDGER_ROOT_PATH,
        protocol: 'signPersonal',
        payload: 'hello ethereum this is another message',
      },
    };
  });

  it('Should validate signature from addr0', async () => {
    const expected =
      'b4fb4e0db168de42781ee1a27a1e907d5ec39aaccf24733846739f94f5b4542f' + // r
      '65639d4aa368a5510c64e758732de419ac6489efeaf9e3cb29a616a2c624c2c7' + // s
      '01'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath);
      expect(sig).to.equal(jsSig, 'JS sig does not match');
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });

  it('Should validate signature from addr1', async () => {
    const expected =
      '1318229681d8fcdf6db12819c8859501186a3c792543d38a38643c6f185dd252' + // r
      '6a7655b7ff8b5a2bdfa5023abd91e04c7c7a8f8ee491122da17e13dd85ede531' + // s
      '01'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET + 1;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath);
      expect(sig).to.equal(jsSig, 'JS sig does not match');
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });
  it('Should validate signature from addr8', async () => {
    const expected =
      'c748f3fbf9f517fbd33462a858b40615ab6747295c27b4a46568d7d08c1d9d32' + // r
      '0e14363c2885feaee0e4393454292be1ee3a1f32fb95571231db09a2b3bd8737' + // s
      '00'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET + 8;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath);
      expect(sig).to.equal(jsSig, 'JS sig does not match');
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });
});

describe('Compare personal_sign signatures vs Ledger vectors (3)', () => {
  beforeEach(() => {
    msgReq = {
      currency: 'ETH_MSG',
      data: {
        signerPath: LEDGER_ROOT_PATH,
        protocol: 'signPersonal',
        payload: 'third vector yo',
      },
    };
  });

  it('Should validate signature from addr0', async () => {
    const expected =
      'f245100f07a6c695140fda7e29097034b3c97be94910639d20efdff5c96387fd' + // r
      '6703f40f53647528ed93ac929a256ed1f09eba316a5e94daac2a464356b14058' + // s
      '00'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath);
      expect(sig).to.equal(jsSig, 'JS sig does not match');
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });

  it('Should validate signature from addr1', async () => {
    const expected =
      '3a42c4955e4fb7ee2c4ee58df79c4be5f62839e691c169b74f90eafd371e2065' + // r
      '51c7fc3da33dff2d2961ac7909244b4c32deee70abf7fac0e088184853cdff4a' + // s
      '01'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET + 1;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath);
      expect(sig).to.equal(jsSig, 'JS sig does not match');
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });
  it('Should validate signature from addr8', async () => {
    const expected =
      '3e55dbb101880960cb32c17237d3ceb9d5846cf2f68c5c4c504cb827ea6a2e73' + // r
      '22254bb6f6464c95dd743c506e7bc71eb90ceab17d2fd3b02e6636c508b14cc7' + // s
      '00'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET + 8;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath);
      expect(sig).to.equal(jsSig, 'JS sig does not match');
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });
});

describe('Compare EIP712 signatures vs Ledger vectors (1)', () => {
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
                type: 'string',
              },
              {
                name: 'target',
                type: 'string',
              },
              {
                name: 'born',
                type: 'int32',
              },
            ],
            EIP712Domain: [
              {
                name: 'chainId',
                type: 'uint256',
              },
            ],
          },
          domain: {
            chainId: 1,
          },
          primaryType: 'Greeting',
          message: {
            salutation: 'Hello',
            target: 'Ethereum',
            born: '2015',
          },
        },
      },
    };
  });

  it('Should validate signature from addr0', async () => {
    const expected =
      'dbf9a493935770f97a1f0886f370345508398ac76fbf31ccf1c30d8846d3febf' + // r
      '047e8ae03e146044e7857f1e485921a9d978b1ead93bdd0de6be619dfb72f0b5' + // s
      '01'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected);
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });
  it('Should validate signature from addr1', async () => {
    const expected =
      '9e784c6388f6f938f94239c67dc764909b86f34ec29312f4c623138fd7192115' + // r
      '5efbc9af2339e04303bf300366a675dd90d33fdb26d131c17b278725d36d728e' + // s
      '00'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET + 1;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected);
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });
  it('Should validate signature from addr8', async () => {
    const expected =
      '6e7e9bfc4773291713bb5cdc483057d43a95a5082920bdd1dd3470caf6f11155' + // r
      '6c163b7d489f37ffcecfd20dab2de6a8a04f79af7e265b249db9b4973e75c7d1' + // s
      '00'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET + 8;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected);
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });
});

describe('Compare EIP712 signatures vs Ledger vectors (2)', () => {
  beforeEach(() => {
    msgReq = {
      currency: 'ETH_MSG',
      data: {
        signerPath: LEDGER_ROOT_PATH,
        protocol: 'eip712',
        payload: {
          types: {
            MuhType: [
              {
                name: 'thing',
                type: 'string',
              },
            ],
            EIP712Domain: [
              {
                name: 'chainId',
                type: 'uint256',
              },
            ],
          },
          domain: {
            chainId: 1,
          },
          primaryType: 'MuhType',
          message: {
            thing: 'I am a string',
          },
        },
      },
    };
  });

  it('Should validate signature from addr0', async () => {
    const expected =
      '0a1843ee1be7bf1ddd8bb32230ee3842b47022b8ba8795d3522db8a7341a9b85' + // r
      '72d0e38463b5a7e1f1d1acd09acb8db936af52bdcab6374abb7013842b6840b8' + // s
      '01'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected);
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });
  it('Should validate signature from addr1', async () => {
    const expected =
      'f5284359479eb32eefe88bd24de59e4fd656d82238c7752e7a576b7a875eb5ae' + // r
      '6ef7b021f5bed2122161de6b373d5ee0aa9a3e4d3f499b3bb95ad5b9ed9f7bd9' + // s
      '00'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET + 1;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected);
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });
  it('Should validate signature from addr8', async () => {
    const expected =
      'f7a94b7ba7e0fbab88472cb77c5c255ba36e60e9f90bf4073960082bb5ef17cf' + // r
      '2e3b79ebad1f0ee96e0d3fe862372a1e586dba1bee309adf8c338b5e42d3424e' + // s
      '00'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET + 8;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected);
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });
});

describe('Compare EIP712 signatures vs Ledger vectors (3)', () => {
  beforeEach(() => {
    msgReq = {
      currency: 'ETH_MSG',
      data: {
        signerPath: LEDGER_ROOT_PATH,
        protocol: 'eip712',
        payload: {
          types: {
            MuhType: [
              {
                name: 'numbawang',
                type: 'uint32',
              },
            ],
            EIP712Domain: [
              {
                name: 'chainId',
                type: 'uint256',
              },
            ],
          },
          domain: {
            chainId: 1,
          },
          primaryType: 'MuhType',
          message: {
            numbawang: 999,
          },
        },
      },
    };
  });

  it('Should validate signature from addr0', async () => {
    const expected =
      'c693714421acbba9fb8fdcd825295b6042802b06a55ae17a65db510dd5a348e0' + // r
      '2ffed1a8dbaf63919727c0b5e52978e9dce3638b0385fda45e022a50bab510eb' + // s
      '01'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected);
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });
  it('Should validate signature from addr1', async () => {
    const expected =
      '4a32a478f6f772b37d8cfffabe8ee7c7956d45fd098035163c92b06564ead034' + // r
      '2eb54cde42f636f63f72615b53510e970a9f7ff2c4527b753ef0eb8ce1ee4a44' + // s
      '00'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET + 1;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected);
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });
  it('Should validate signature from addr8', async () => {
    const expected =
      '7a9f4e67309efb733fc4092f69f95583e06ccf4b25a364d9a9dc51b921edb464' + // r
      '22c310c83fd61936618b8f1caaa0b82ac492822e6a5d1a65cd5fb3f0bc0126bf' + // s
      '00'; // v
    msgReq.data.signerPath[2] = HARDENED_OFFSET + 8;
    try {
      const res: any = await helpers.execute(client, 'sign', msgReq);
      const sig = getSigStr(res.sig);
      expect(sig).to.equal(expected);
    } catch (err) {
      expect(err).to.equal(null, err.message);
    }
  });
});

describe('Test random personal_sign messages against JS signatures', () => {
  // By now we know that Ledger signatures match JS signatures
  // so we can generate a bunch of random test vectors and
  // compare Lattice sigs vs the JS implementation.
  //@ts-expect-error - it.each is not included in @types/mocha
  it.each(
    RANDOM_VEC_LABELS,
    'Random sign_personal vector',
    ['label'],
    async (n, next) => {
      try {
        let res, jsSig, sig;
        const req = {
          currency: 'ETH_MSG',
          data: {
            signerPath: LEDGER_ROOT_PATH,
            protocol: 'signPersonal',
            payload: RANDOM_VEC[n.number],
          },
        };
        // Address index 0
        req.data.signerPath[2] = HARDENED_OFFSET;
        jsSig = signPersonalJS(req.data.payload, req.data.signerPath);
        res = await helpers.execute(client, 'sign', req);
        sig = getSigStr(res.sig);
        expect(sig).to.equal(jsSig, 'Addr0 sig failed');
        // Address index 1
        req.data.signerPath[2] = HARDENED_OFFSET + 1;
        jsSig = signPersonalJS(req.data.payload, req.data.signerPath);
        res = await helpers.execute(client, 'sign', req);
        sig = getSigStr(res.sig);
        expect(sig).to.equal(jsSig, 'Addr1 sig failed');
        // Address index 8
        req.data.signerPath[2] = HARDENED_OFFSET + 8;
        jsSig = signPersonalJS(req.data.payload, req.data.signerPath);
        res = await helpers.execute(client, 'sign', req);
        sig = getSigStr(res.sig);
        expect(sig).to.equal(jsSig, 'Addr8 sig failed');
        setTimeout(() => {
          next();
        }, 1000);
      } catch (err) {
        setTimeout(() => {
          next(err);
        }, 1000);
      }
    }
  );
});

describe('Teardown Test', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(
      true,
      'Unauthorized or critical failure. Aborting'
    );
  });

  it('Should find out if we should reload the seed', async () => {
    if (skipSeedLoading) {
      skipSeedRestore = true;
      return;
    }
    // Determine if we should skip the process of restoring the original seed.
    // A user might choose Y here if they want to debug the signing requests
    // here more quickly, but please be aware that you will lose your original seed.
    const result = question(
      '\nWARNING: If you choose `N` you will no longer be able to restore your original seed from these tests.' +
        '\nDo you want to reload your original seed? (Y/N) '
    );
    if (result.toLowerCase() !== 'y') {
      skipSeedRestore = true;
    }
  });

  it('Should remove the seed', async () => {
    if (skipSeedRestore) return;
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
      activeWalletUID,
      jobData
    );
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  });

  it('Should load the seed', async () => {
    if (skipSeedRestore) return;
    _setupJob(helpers.jobTypes.WALLET_JOB_LOAD_SEED, { seed: latticeSeed });
    await runTestCase(helpers.gpErrors.GP_SUCCESS);
  });

  it('Should wait for the user to remove and re-insert the card (triggering SafeCard wallet sync)', () => {
    if (skipSeedRestore) return;
    question(
      '\nPlease remove, re-insert, and unlock your SafeCard.\n' +
        'Press enter to continue after addresses have fully synced.'
    );
  });

  it('Should re-connect to the Lattice and update the walletUID.', async () => {
    if (skipSeedRestore) return;
    expect(process.env.DEVICE_ID).to.not.equal(null);
    await helpers.connect(client, process.env.DEVICE_ID);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);
    activeWalletUID = helpers.copyBuffer(client.getActiveWallet().uid);
  });

  it('Should ensure export seed matches the seed we just loaded', async () => {
    if (skipSeedRestore) return;
    // Export the seed and make sure it matches!
    _setupJob(helpers.jobTypes.WALLET_JOB_EXPORT_SEED);
    const _res = await runTestCase(helpers.gpErrors.GP_SUCCESS);
    const res = helpers.deserializeExportSeedJobResult(_res.result);
    const exportedSeed = helpers.copyBuffer(res.seed);
    expect(exportedSeed.toString('hex')).to.equal(latticeSeed.toString('hex'));
    // Abort if this fails
    if (exportedSeed.toString('hex') !== latticeSeed.toString('hex'))
      continueTests = false;
  });
});
