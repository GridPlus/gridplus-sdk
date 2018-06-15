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
    .then((success) => {
      assert(success === true);
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    })
  });
})
