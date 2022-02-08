/**
Test generic signing, which allows a signature on the secp256k1 or ed25519 curve.
We seek to validate:
1. Signature on data can be reproduced locally with the derived key
2. Signature on data representing ETH tx matches the ETH route itself
3. Many random signatures can be validated

You must have `FEATURE_TEST_RUNNER=0` enabled in firmware to run these tests.
 */
import bip32 from 'bip32';
import { randomBytes } from 'crypto';
import { expect } from 'chai';
import seedrandom from 'seedrandom';
import helpers from './testUtil/helpers';
import { getFwVersionConst, HARDENED_OFFSET } from '../src/constants'
const prng = new seedrandom(process.env.SEED || Math.random().toString())

let client, req, seed, fwConstants, continueTests = true;
const DEFAULT_SIGNER = [
  helpers.BTC_PURPOSE_P2PKH,
  helpers.ETH_COIN,
  HARDENED_OFFSET,
  0,
  0,
];

async function run(req, expectedErr=undefined) {
  const resp = await helpers.execute(client, 'sign', req);
  expect(resp.err).to.equal(expectedErr, resp.err);
  helpers.validateGenericSig(seed, resp.sig, req.data);
  return resp;
}

describe('Setup client', () => {
  it('Should setup the test client', () => {
    client = helpers.setupTestClient(process.env);
    expect(client).to.not.equal(null);
  });

  it('Should connect to a Lattice and make sure it is already paired.', async () => {
    // Again, we assume that if an `id` has already been set, we are paired
    // with the hardcoded privkey above.
    expect(process.env.DEVICE_ID).to.not.equal(null);
    const connectErr = await helpers.connect(client, process.env.DEVICE_ID);
    expect(connectErr).to.equal(null);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);
    // Set the correct max gas price based on firmware version
    fwConstants = getFwVersionConst(client.fwVersion);
    if (!fwConstants.genericSigning) {
      continueTests = false;
      expect(true).to.equal(false, 'Firmware must be updated to run this test.')
    }
  });
});

describe('Export seed', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Error in previous test.');
  });

  it('Should export the seed', async () => {
    const activeWalletUID = helpers.copyBuffer(client.getActiveWallet().uid);
    const jobType = helpers.jobTypes.WALLET_JOB_EXPORT_SEED;
    const jobData = {};
    const jobReq = {
      testID: 0, // wallet_job test ID
      payload: helpers.serializeJobData(jobType, activeWalletUID, jobData),
    };
    const res = await helpers.execute(client, 'test', jobReq);
    const _res = helpers.parseWalletJobResp(res, client.fwVersion);
    continueTests = _res.resultStatus === 0;
    expect(_res.resultStatus).to.equal(0);
    const data = helpers.deserializeExportSeedJobResult(_res.result);
    seed = helpers.copyBuffer(data.seed);
  });
})

describe('Generic signing', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Error in previous test.');
    req = {
      data: {
        signerPath: DEFAULT_SIGNER,
        curveType: 'SECP256K1',
        hashType: 'KECCAK256',
        payload: null,
      }
    };
  })

  it('Should test pre-hashed messages', async () => {
    const { extraDataFrameSz, extraDataMaxFrames, genericSigning } = fwConstants;
    const { baseDataSz } = genericSigning;
    // Max size that won't be prehashed
    const maxSz = baseDataSz + (extraDataMaxFrames * extraDataFrameSz);
    // Use extraData frames
    req.data.payload = `0x${randomBytes(maxSz).toString('hex')}`;
    await run(req);
    // Prehash
    req.data.payload = `0x${randomBytes(maxSz + 1).toString('hex')}`;
    await run(req);
  })

  it('Should test ASCII text formatting', async () => {
    try {
      // Build a payload that uses spaces and newlines
      req.data.payload = JSON.stringify({ 
        testPayload: 'json with spaces', 
        anotherThing: -1 
      }, null, 2);
      await run(req);
    } catch (err) {
      continueTests = false;
      expect(err).to.equal(null, err);
    } 
  })

  it('Should validate SECP256K1/KECCAK signature against dervied key', async () => {
    try {
      // ASCII message encoding
      req.data.payload = 'test'
      await run(req);
      // Hex message encoding
      req.data.payload = '0x123456'
      await run(req);
    } catch (err) {
      continueTests = false;
      expect(err).to.equal(null, err);
    }
  })

  it('Should validate ED25519/NULL signature against dervied key', async () => {
    // Make generic signing request
    req.data.payload = '0x123456';
    req.data.curveType = 'ED25519';
    req.data.hashType = 'NONE';
    // ED25519 derivation requires hardened indices
    req.data.signerPath = DEFAULT_SIGNER.slice(0, 3);
    try {
      await run(req);
    } catch (err) {
      continueTests = false;
      expect(err).to.equal(null, err);
    }
  })

  it('Should validate SECP256K1/KECCAK signature against ETH_MSG request (legacy)', async () => {
    // Generic request
    const msg = 'Testing personal_sign';
    const psMsg = helpers.ethPersonalSignMsg(msg);
    // NOTE: The request contains some non ASCII characters so it will get 
    // encoded as hex automatically.
    req.data.payload = psMsg;
    // Legacy request
    const legacyReq = {
      currency: 'ETH_MSG',
      data: {
        signerPath: req.data.signerPath,
        payload: msg,
        protocol: 'signPersonal'
      }
    };
    try {
      const respGeneric = await run(req);
      const respLegacy = await helpers.execute(client, 'sign', legacyReq);
      expect(!!respLegacy.err).to.equal(false, respLegacy.err);
      const genSig = `${respGeneric.sig.r.toString('hex')}${respGeneric.sig.s.toString('hex')}`;
      const legSig = `${respLegacy.sig.r.toString('hex')}${respLegacy.sig.s.toString('hex')}`;
      expect(genSig).to.equal(legSig, 'Legacy and generic requests produced different sigs.')
    } catch (err) {
      continueTests = false;
      expect(err).to.equal(null, err);
    }
  });

  it('Should test random payloads', async () => {
    const numRandomReq = process.env.N || 5;
    for (let i = 0; i < numRandomReq; i++) {
      // Build a random payload that can fit in the base request
      const sz = Math.floor(fwConstants.genericSigning.baseDataSz * prng.quick());
      const buf = Buffer.alloc(sz);
      for (let i = 0; i < sz; i++) {
        buf[i] = Math.floor(0xff * prng.quick());
      }
      req.data.payload = buf;
      // 1. Secp256k1/keccak256
      req.data.curveType = 'SECP256K1';
      req.data.hashType = 'KECCAK256';
      await run(req);
      // 2. Secp256k1/sha256
      req.data.hashType = 'SHA256';
      await run(req);
      // 3. Ed25519
      req.data.curveType = 'ED25519';
      req.data.hashType = 'NONE';
      req.data.signerPath = DEFAULT_SIGNER.slice(0, 3);
      await run(req);
    }
  })

})
