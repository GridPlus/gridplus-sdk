// Tests on communications with simulated agent devices
const assert = require('assert');
const config = require(`${__dirname}/../src/config.js`);
const GridPlusSDK = require('../src/index.js').default;
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

  it('Should connect to an agent', (done) => {
    sdk.connect(1)
    .then((res) => {
      assert(res === true, 'Response incorrect');
      done();
    })
    .catch((err) => {
      assert(err === null, `Error connecting to agent: ${err}`);
      done();
    });
  });
});