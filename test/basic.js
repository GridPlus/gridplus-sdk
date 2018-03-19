// Basic tests for atomic SDK functionality
const assert = require('assert');
const crypto = require('crypto');
const GridPlusSDK = require('../src/index.js').default;
let sdk;
let privKey;

describe('Basic tests', () => {
  it('Should instantiate an SDK object', (done) => {
    try {
      privKey = crypto.randomBytes(32).toString('hex');
      sdk = new GridPlusSDK({ key: privKey });
      done();
    } catch (err) {
      assert(err === null, err);
      done();
    }
  });

  /*it('Should get the public header key', (done) => {
    const key = sdk.getHeaderKey();
    assert(typeof key === 'string');
    assert(key.length === 130);
    done();
  });*/


})
