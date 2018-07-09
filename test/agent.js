// Tests on communications with simulated agent devices
const assert = require('assert');
const config = require(`${__dirname}/../config.js`);
const GridPlusSDK = require('../index.js').default;
let sdk, privKey, addr, provider, erc20Addr, sender, senderPriv;

// Handle all promise rejections
process.on('unhandledRejection', e => { throw e; });

describe('Basic tests', () => {
  it('Should instantiate an SDK object', (done) => {
    try {
      sdk = new GridPlusSDK();
      done();
    } catch (err) {
      assert(err === null, err);
      done();
    }
  });

  it('Should fail to connect to a bad API URL', (done) => {
    sdk.connect(123, 'foo')
    .then((res) => {
      assert(res === null)
      done();
    })
    .catch((err) => {
      assert(err !== null);
      done();
    });
  });

  it('Should connect to an agent', (done) => {
    const serial = 'agent-0';
    sdk.connect(serial, config.api.baseUrl)
    .then((res) => {
      assert(res.result !== undefined)
      assert(res.result.status === 200);
      done()
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    })
  })

});