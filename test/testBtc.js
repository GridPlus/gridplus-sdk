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
// After you do the above, you can run this test with `npm run test-eth`
//
// NOTE: It is highly suggested that you set `AUTO_SIGN_DEV_ONLY=1` in the firmware
//        root CMakeLists.txt file (for dev units)
require('it-each')({ testPerIteration: true });
const expect = require('chai').expect;
const helpers = require('./testUtil/helpers');
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

const inputs = [
  {
    hash: '5be4d21e26d8adb9919a4cf77db04cb9d79138955d7ab4940b835e384f4fb663',
    value: 42118245,
    signerIdx: 0,
    idx: 5,
  },
  {
    hash: '4aabfd94c1803057faf4610d4f5a38913887e2ede22a3ff3ed7e23d141373b5a',
    value: 78649247,
    signerIdx: 1,
    idx: 5,
  },
  {
    hash: '40c579f94927faf2cf40d3093ed55752e8514f13a401df25ad8e3aefeba51668',
    value: 69162416,
    signerIdx: 2,
    idx: 5,
  },
  {
    hash: 'd6811ae63af8a314143d70c55f5660e0ae19f01b15580f642871699d58a37739',
    value: 71286356,
    signerIdx: 3,
    idx: 5,
  },
  {
    hash: '4d1226ad184396d401e9ccb6925c3f5b43f1d0ce647065c267a11ef8b03d4395',
    value: 54482146,
    signerIdx: 4,
    idx: 5,
  },
  {
    hash: '2a5c2070a511646eec772b9b366fd9510864e5b849d01b19e1b31afe6ab9d96a',
    value: 3474291,
    signerIdx: 5,
    idx: 5,
  },
  {
    hash: '6d4c560fb43a752edc0b9a34afe4e093994e63c3a43d7b1c03e40164710bdfd6',
    value: 19088329,
    signerIdx: 6,
    idx: 5,
  },
  {
    hash: 'fb8d9b4f57d5304579f65b3b33e0e3ae9206358f384336f9e0b7e5611fc6353b',
    value: 69440062,
    signerIdx: 7,
    idx: 5,
  },
  {
    hash: '5849b0e66d59cc21c6e2b091ea35706741416962f994d9b7f6f64f13572ddcc9',
    value: 74499838,
    signerIdx: 11, // this value doesn't really matter, but it should be <19 to avoid wallet caching issues on the Lattice
    idx: 5,
  },
  {
    hash: '3391104648b65bb140764ea557cf0f3fab8b2c43e011e0a59ca4e26fc0cb583e',
    value: 99114960,
    signerIdx: 12,
    idx: 5,
  }
];
const numInputs = [];
for (let i = 1; i < 3; i++) {
  numInputs.push({ label: `${i}`, number: i })
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
      const recipient = 'mhifA1DwiMPHTjSJM8FFSL8ibrzWaBCkVT'
      const sumInputs = helpers.getSumInputs(inputsSlice);

      const fee = Math.floor(Math.random() * 50000)
      const value = Math.floor(Math.random() * sumInputs) - fee;
      const sigHashes = helpers.get_legacy_sighashes(wallet, recipient, value, fee, inputsSlice, true);
      const signingKeys = helpers.get_signing_keys(wallet, inputsSlice, true);
      const txReq = helpers.tx_request_builder(inputsSlice, recipient, value, fee, false, true);

      try {
        await testSign(txReq, signingKeys, sigHashes);
        next();
      } catch (err) {
        next(err);
      }
    });

});

describe('legacy, mainnet, change', function(){

    it.each(numInputs, 'Testing with %s inputs', ['label'], async function(n, next) {
      const inputsSlice = inputs.slice(0, n.number);
      const recipient = '1KFHE7w8BhaENAswwryaoccDb6qcT6DbYY'
      const sumInputs = helpers.getSumInputs(inputsSlice);

      const fee = Math.floor(Math.random() * 50000)
      const value = Math.floor(Math.random() * sumInputs) - fee;
      const sigHashes = helpers.get_legacy_sighashes(wallet, recipient, value, fee, inputsSlice, false);
      const signingKeys = helpers.get_signing_keys(wallet, inputsSlice, false);
      const txReq = helpers.tx_request_builder(inputsSlice, recipient, value, fee, false, false);

      try {
        await testSign(txReq, signingKeys, sigHashes);
        next();
      } catch (err) {
        next(err);
      }
    });

});


