// Basic tests for atomic SDK functionality
const assert = require('assert');
const crypto = require('crypto');
const GridPlusSDK = require('../src/index.js').default;
let sdk;
let privKey;
let addr;

// Handle all promise rejections
process.on('unhandledRejection', e => { throw e; });

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

  it('Should connect to an ETH node', (done) => {
    const e = sdk.connectToEth();
    assert(e === null);
    done();
  });

  it('Should get a zero ETH balance for a random address', (done) => {
    addr = crypto.randomBytes(20).toString('hex');
    sdk.getEthBalance(addr)
    .then((balance) => {
      assert(typeof balance === 'number');
      assert(balance === 0);
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });

  it('Should transfer ETH to the random address');

  it('Should find a non-zero ETH balance for the random address');

  it('Should deploy an ERC20 token');

  it('Should find a zero token balance for the address');

  it('Should transfer some ERC20 tokens to the address');

  it('Should find a non-zero token balance for the address');

})
