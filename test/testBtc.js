// Tests for BTC transaction edge cases
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
// After you do the above, you can run this test with `env DEVICE_ID='<your_device_id>' npm run test-btc`
//
// NOTE: It is highly suggested that you set `AUTO_SIGN_DEV_ONLY=1` in the firmware
//        root CMakeLists.txt file (for dev units)
require('it-each')({ testPerIteration: true });
const expect = require('chai').expect;
const helpers = require('./testUtil/helpers');
const crypto = require('crypto');
let client, activeWalletUID, wallet = null;

const PURPOSE = helpers.BTC_PURPOSE_P2SH_P2WPKH;

// Bitcoin specific functionality/setup
// !!!! IMPORTANT NOTE: YOU MUST RUN THESE TESTS AGAINST A LATTICE WHOSE SEED WAS RECOVERED USING
//                      THE MNEMONIC SPECIFIED BELOW!!!!
// Set up the wallet:
const bip32 = require('bip32')

// Build the inputs. By default we will build 10. Note that there are `n` tests for
// *each category*, where `n` is the number of inputs.
const inputs = [];
const numInputs = [];
const count = process.env.N ? process.env.N : 10;
for (let i = 0; i < count; i++) {
  const hash = crypto.randomBytes(32).toString('hex');
  const value = Math.floor(Math.random() * 1000000 * 10**8); // Random value up to 1M BTC ;)
  const signerIdx = Math.floor(Math.random() * 19); // Random signer (keep it inside initial cache of 20)
  const idx = Math.floor(Math.random() * 25); // Random previous output index (keep it small)
  inputs.push({hash, value, signerIdx, idx });
  numInputs.push({ label: `${i+1}`, number: i+1 });
}

async function testSign(req, signingKeys, sigHashes) {
  const tx = await helpers.sign(client, req);
  expect(tx.sigs.length).to.equal(signingKeys.length);
  expect(tx.sigs.length).to.equal(sigHashes.length);
  for (let i = 0; i < tx.sigs.length; i++) {
    const sig = helpers.stripDER(tx.sigs[i]);
    expect(signingKeys[i].verify(sigHashes[i], sig)).to.equal(true, 'Signature validation failed');
  }
}

describe('Fetch wallet seed', () => {

  before(() => {
    client = helpers.setupTestClient(process.env);
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
  it('Should get GP_SUCCESS for a known, connected wallet', async () => {
    expect(activeWalletUID).to.not.equal(null, 'No wallet found')
    const jobType = helpers.jobTypes.WALLET_JOB_EXPORT_SEED;
    const jobData = {};
    const jobReq = {
      testID: 0, // wallet_job test ID
      payload: helpers.serializeJobData(jobType, activeWalletUID, jobData),
    }

    const res = await helpers.test(client, jobReq);
    const _res = helpers.parseWalletJobResp(res, client.fwVersion);
    expect(_res.resultStatus).to.equal(0);
    const data = helpers.deserializeExportSeedJobResult(_res.result);
    const activeWalletSeed = helpers.copyBuffer(data.seed);
    wallet = bip32.fromSeed(activeWalletSeed)
  })
})
// describe('legacy, testnet, change', function(){

//     it.each(numInputs, 'Testing with %s inputs', ['label'], async function(n, next) {
//       expect(wallet).to.not.equal(null, 'Wallet not available')
//       const inputsSlice = inputs.slice(0, n.number);
//       const isTestnet = true;
//       const isSegwit = false;
//       const useChange = true;
//       const p = helpers.setup_btc_sig_test(isTestnet, isSegwit, useChange, wallet, inputsSlice, PURPOSE);
//       try {
//         await testSign(p.txReq, p.signingKeys, p.sigHashes);
//         next();
//       } catch (err) {
//         next(err);
//       }
//     });

// });

// describe('legacy, mainnet, change', function(){

//     it.each(numInputs, 'Testing with %s inputs', ['label'], async function(n, next) {
//       expect(wallet).to.not.equal(null, 'Wallet not available')
//       const inputsSlice = inputs.slice(0, n.number);
//       const isTestnet = false;
//       const isSegwit = false;
//       const useChange = true;
//       const p = helpers.setup_btc_sig_test(isTestnet, isSegwit, useChange, wallet, inputsSlice, PURPOSE);
//       try {
//         await testSign(p.txReq, p.signingKeys, p.sigHashes);
//         next();
//       } catch (err) {
//         next(err);
//       }
//     });

// });

describe('segwit, testnet, change', function(){

    it.each(numInputs, 'Testing with %s inputs', ['label'], async function(n, next) {
      expect(wallet).to.not.equal(null, 'Wallet not available')
      const inputsSlice = inputs.slice(0, n.number);
      const isTestnet = true;
      const isSegwit = true;
      const useChange = true;
      const p = helpers.setup_btc_sig_test(isTestnet, isSegwit, useChange, wallet, inputsSlice, PURPOSE);
      try {
        await testSign(p.txReq, p.signingKeys, p.sigHashes);
        next();
      } catch (err) {
        next(err);
      }
    });

});

describe('segwit, mainnet, change', function(){

    it.each(numInputs, 'Testing with %s inputs', ['label'], async function(n, next) {
      expect(wallet).to.not.equal(null, 'Wallet not available')
      const inputsSlice = inputs.slice(0, n.number);
      const isTestnet = false;
      const isSegwit = true;
      const useChange = true;
      const p = helpers.setup_btc_sig_test(isTestnet, isSegwit, useChange, wallet, inputsSlice, PURPOSE);
      try {
        await testSign(p.txReq, p.signingKeys, p.sigHashes);
        next();
      } catch (err) {
        next(err);
      }
    });

});

describe('segwit, mainnet, no change', function(){

    it.each(numInputs, 'Testing with %s inputs', ['label'], async function(n, next) {
      expect(wallet).to.not.equal(null, 'Wallet not available')
      const inputsSlice = inputs.slice(0, n.number);
      const isTestnet = false;
      const isSegwit = true;
      const useChange = false;
      const p = helpers.setup_btc_sig_test(isTestnet, isSegwit, useChange, wallet, inputsSlice, PURPOSE);
      try {
        await testSign(p.txReq, p.signingKeys, p.sigHashes);
        next();
      } catch (err) {
        next(err);
      }
    });

});

// describe('legacy, mainnet, no change', function(){

//     it.each(numInputs, 'Testing with %s inputs', ['label'], async function(n, next) {
//       expect(wallet).to.not.equal(null, 'Wallet not available')
//       const inputsSlice = inputs.slice(0, n.number);
//       const isTestnet = false;
//       const isSegwit = false;
//       const useChange = false;
//       const p = helpers.setup_btc_sig_test(isTestnet, isSegwit, useChange, wallet, inputsSlice, PURPOSE);
//       try {
//         await testSign(p.txReq, p.signingKeys, p.sigHashes);
//         next();
//       } catch (err) {
//         next(err);
//       }
//     });

// });
