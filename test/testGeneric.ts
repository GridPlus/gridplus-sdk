/**
Test generic signing, which allows a signature on the secp256k1 or ed25519 curve.
We seek to validate:
1. Signature on data can be reproduced locally with the derived key
2. Signature on data representing ETH tx matches the ETH route itself
3. Many random signatures can be validated

You must have `FEATURE_TEST_RUNNER=0` enabled in firmware to run these tests.
 */
import bip32 from 'bip32';
import { expect } from 'chai';
import seedrandom from 'seedrandom';
import helpers from './testUtil/helpers';
import { getFwVersionConst, HARDENED_OFFSET } from '../src/constants'

let client, req, seed, continueTests = true;
// const prng = new seedrandom(process.env.SEED || 'myrandomseed');
// let numRandom = process.env.N || 20;
const DEFAULT_SIGNER = [
  helpers.BTC_PURPOSE_P2PKH,
  helpers.ETH_COIN,
  HARDENED_OFFSET,
  0,
  0,
];

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
    const fwConstants = getFwVersionConst(client.fwVersion);
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

describe('Test generic signing limits', () => {
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

  it('Should validate SECP256K1/KECCAK signature against dervied key', async () => {
    // Make generic signing request

    // TODO: FIGURE OUT HOW TO HANDLE 33 BYTE SIG COMPONENTS
    // req.data.payload = 'test2'; // PRODUCES 33 BYTE R COMPONENT IN SIG???
    
    req.data.payload = 'test'
    const resp = await helpers.execute(client, 'sign', req);
    expect(!!resp.err).to.equal(false, resp.err);
    helpers.validateGenericSig(seed, resp.sig, req.data);
  })
/*
  it('Should validate ED25519/NULL signature against dervied key', async () => {
    // Make generic signing request
    req.data.payload = 'test';
    req.data.curveType = 'ED25519';
    req.data.hashType = 'NONE';
    const resp = await helpers.execute(client, 'sign', req);
    console.log(resp)
  })
*/
  it('Should validate SECP256K1/KECCAK signature against native ETH request');
})

