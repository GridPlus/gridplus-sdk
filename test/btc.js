// Basic tests for atomic SDK functionality
const assert = require('assert');
const GridPlusSDK = require('../src/index.js').default;

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
/*
  it('Should check the balance of the testnet address', (done) => {
    sdk.getBalance('BTC', 'dsgadsg')
    .then((balance) => {
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    })
  })
  */
})
