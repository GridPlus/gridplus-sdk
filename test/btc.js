// Basic tests for atomic SDK functionality
const assert = require('assert');
const bitcoin = require('bitcoinjs-lib');
const config = require('../src/config.js');
const GridPlusSDK = require('../src/index.js').default;
const wif = require('wif');
let startBal, startUtxos, testAddr, testKeyPair;

// Handle all promise rejections
process.on('unhandledRejection', e => { throw e; });

describe('Bitcoin', () => {
  it('Should instantiate an SDK object', (done) => {
    try {
      sdk = new GridPlusSDK();
      done();
    } catch (err) {
      assert(err === null, err);
      done();
    }
  });

  it('Should connect to an BTC node', (done) => {
    sdk.connectToBtc()
    .then((info) => {
      assert(info.network === 'testnet', 'Did not connect to testnet');
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    })
  });

  // This address needs to have some BTC in it
  it('Should check the balance of the config testnet address', (done) => {
    sdk.getBalance('BTC', config.testing.btcHolder.address)
    .then((d) => {
      assert(d.balance > 0, 'Address in config.js must have >0 BTC in order to run the tests.')
      assert(d.utxos.length > 0, 'Found zero UTXOs, but we need to spend at least one')
      startUtxos = d.utxos;
      startBal = d.balance;
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    })
  });

  it('Should create a new testnet address', (done) => {
    testKeyPair = bitcoin.ECPair.makeRandom({ network: bitcoin.networks.testnet });
    testAddr = testKeyPair.getAddress();
    done();
  });

  it('Should make a transaction spending 1 sat', (done) => {
    try {
      const txb = new bitcoin.TransactionBuilder();
      const keyPair = bitcoin.ECPair.fromWIF(config.testing.btcHolder.wif, bitcoin.networks.testnet);
      txb.addInput(startUtxos[0].hash, startUtxos[0].input);
      txb.addOutput(testAddr, 1);
      txb.addOutput(config.testing.btcHolder.address, startUtxos[0].value - 1);
      txb.sign(0, keyPair)
      console.log(txb.build().toHex())
      done();
    } catch (err) {
      assert(err === null, err);
      done();
    }
  });
  
})
