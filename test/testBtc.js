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
let client;

// Bitcoin specific functionality/setup
// !!!! IMPORTANT NOTE: YOU MUST RUN THESE TESTS AGAINST A LATTICE WHOSE SEED WAS RECOVERED USING
//                      THE MNEMONIC SPECIFIED BELOW!!!!
// Set up the wallet:
const bip39 = require('bip39')
const bip32 = require('bip32')
let MNEMONIC = 'negative spare peasant raw feature camera glide notice fee gown heavy depart'
let PASSWORD = ''
if (process.env.MNEMONIC)
  MNEMONIC = process.env.MNEMONIC;
if (process.env.PASSWORD)
  PASSWORD = process.env.PASSWORD;
const seed = bip39.mnemonicToSeedSync(MNEMONIC, PASSWORD)
const wallet = bip32.fromSeed(seed)

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
    expect(signingKeys[i].verify(sigHashes[i], sig)).to.equal(true);
  }
}

describe('Test BTC Transactions', () => {

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
  });

})

describe('legacy, testnet, change', function(){

    it.each(numInputs, 'Testing with %s inputs', ['label'], async function(n, next) {
      const inputsSlice = inputs.slice(0, n.number);
      const isTestnet = true;
      const isSegwit = false;
      const useChange = true;
      const p = helpers.setup_btc_sig_test(isTestnet, isSegwit, useChange, wallet, inputsSlice);
      try {
        await testSign(p.txReq, p.signingKeys, p.sigHashes);
        next();
      } catch (err) {
        next(err);
      }
    });

});

describe('legacy, mainnet, change', function(){

    it.each(numInputs, 'Testing with %s inputs', ['label'], async function(n, next) {
      const inputsSlice = inputs.slice(0, n.number);
      const isTestnet = false;
      const isSegwit = false;
      const useChange = true;
      const p = helpers.setup_btc_sig_test(isTestnet, isSegwit, useChange, wallet, inputsSlice);
      try {
        await testSign(p.txReq, p.signingKeys, p.sigHashes);
        next();
      } catch (err) {
        next(err);
      }
    });

});

describe('segwit, testnet, change', function(){

    it.each(numInputs, 'Testing with %s inputs', ['label'], async function(n, next) {
      const inputsSlice = inputs.slice(0, n.number);
      const isTestnet = true;
      const isSegwit = true;
      const useChange = true;
      const p = helpers.setup_btc_sig_test(isTestnet, isSegwit, useChange, wallet, inputsSlice);
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
      const inputsSlice = inputs.slice(0, n.number);
      const isTestnet = false;
      const isSegwit = true;
      const useChange = true;
      const p = helpers.setup_btc_sig_test(isTestnet, isSegwit, useChange, wallet, inputsSlice);
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
      const inputsSlice = inputs.slice(0, n.number);
      const isTestnet = false;
      const isSegwit = true;
      const useChange = false;
      const p = helpers.setup_btc_sig_test(isTestnet, isSegwit, useChange, wallet, inputsSlice, useChange);
      try {
        await testSign(p.txReq, p.signingKeys, p.sigHashes);
        next();
      } catch (err) {
        next(err);
      }
    });

});

describe('legacy, mainnet, no change', function(){

    it.each(numInputs, 'Testing with %s inputs', ['label'], async function(n, next) {
      const inputsSlice = inputs.slice(0, n.number);
      const isTestnet = false;
      const isSegwit = false;
      const useChange = false;
      const p = helpers.setup_btc_sig_test(isTestnet, isSegwit, useChange, wallet, inputsSlice, useChange);
      try {
        await testSign(p.txReq, p.signingKeys, p.sigHashes);
        next();
      } catch (err) {
        next(err);
      }
    });

});

