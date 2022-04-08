/**
* Test generic signing. We will validate signatures using unformatted message types
* (i.e. `encodingType=null`) and then we will validate signatures using firmware
* decoders. As new decoders are added, we will add more test files in this directory.
* 
* We will keep some stuff in global state so that it can be easily reused by the
* individual test files. This is accessible via `global.test`.
*
* You must have `FEATURE_TEST_RUNNER=0` enabled in firmware to run these tests.
*/
import helpers from '../testUtil/helpers';
import { expect } from 'chai';
import seedrandom from 'seedrandom';
import { getFwVersionConst } from '../../src/constants';
import { getEncodedPayload } from '../../src/genericSigning'

async function runGeneric(req, test, expectedErr=undefined) {
  test.continue = false;
  try {
    const resp = await test.client.sign(req);
    // If no encoding type is specified we encode in hex or ascii
    const encodingType = req.data.encodingType || null; 
    const allowedEncodings = test.fwConstants.genericSigning.encodingTypes;
    const { payloadBuf } = getEncodedPayload(req.data.payload, encodingType, allowedEncodings);
    test.helpers.validateGenericSig(test.seed, resp.sig, payloadBuf, req.data);
  } catch (err) {
    if (expectedErr) {
      test.continue = true;
    }
    throw new Error(err);
  }
  test.continue = true;
  return resp;
}

describe('Test General Signing', () => {
  before(() => {
    global.test = {
      continue: true,
      client: helpers.setupTestClient(process.env),
      seed: null,
      fwConstants: null,
      expect,
      helpers,
      runGeneric,
      prng: new seedrandom(process.env.SEED || Math.random().toString()),
      numIter: process.env.N || 5,
      etherscanKey: process.env.ETHERSCAN_KEY,
    };
    expect(global.test.client).to.not.equal(null);
  })

  beforeEach(() => {
    expect(global.test.continue).to.equal(true, 'Error in previous test.');
    global.test.continue = false;
  })

  it('Should connect to a Lattice and make sure it is already paired.', async () => {
    // Again, we assume that if an `id` has already been set, we are paired
    // with the hardcoded privkey above.
    global.test.continue = false;
    expect(process.env.DEVICE_ID).to.not.equal(null);
    const isPaired = await global.test.client.connect(process.env.DEVICE_ID);
    expect(isPaired).to.equal(true);
    expect(global.test.client.isPaired).to.equal(true);
    expect(global.test.client.hasActiveWallet()).to.equal(true);
    // Set the correct max gas price based on firmware version
    global.test.fwConstants = getFwVersionConst(global.test.client.fwVersion);
    if (!global.test.fwConstants.genericSigning) {
      global.test.continue = false;
      expect(true).to.equal(false, 'Firmware must be updated to run this test.')
    }
    global.test.continue = true;
  })

  it('Should export the seed', async () => {
    const activeWalletUID = helpers.copyBuffer(global.test.client.getActiveWallet().uid);
    const jobType = helpers.jobTypes.WALLET_JOB_EXPORT_SEED;
    const jobData = {};
    const jobReq = {
      testID: 0, // wallet_job test ID
      payload: helpers.serializeJobData(jobType, activeWalletUID, jobData),
    };
    const res = await global.test.client.test(jobReq);
    const _res = helpers.parseWalletJobResp(res, global.test.client.fwVersion);
    global.test.continue = _res.resultStatus === 0;
    expect(_res.resultStatus).to.equal(0);
    const data = helpers.deserializeExportSeedJobResult(_res.result);
    global.test.seed = helpers.copyBuffer(data.seed);
    global.test.activeWalletUID = activeWalletUID;
    global.test.continue = true;
  })

  it('Should load determinism tests', async () => {
    require('./determinism');
    global.test.continue = true;
  })

  it('Should load unformatted tests', async () => {
    require('./unformatted');
    global.test.continue = true;
  })

  it('Should load Solana tests', async () => {
    require('./solana');
    global.test.continue = true;
  })

  it('Should load Terra tests' , async () => {
    require('./terra');
    global.test.continue = true;
  })

  it('Should load EVM tests' , async () => {
    require('./evm');
    global.test.continue = true;
  })
})