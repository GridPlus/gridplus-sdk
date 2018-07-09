// Tests on communications with simulated agent devices
const assert = require('assert');
const config = require(`${__dirname}/../config.js`);
const GridPlusSDK = require('../index.js').default;
const request = require('superagent');
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
    sdk.connect((err, res) => {
      assert(err === null, err);
      assert(sdk.ecdhPub === res.key, 'Mismatched key on response')
      done()
    });
  });

  it('Should start the pairing process on the agent', (done) => {
    sdk.setupPairing((err, res) => {
      assert(err === null, err);
      assert(res.status === 200);
      done();
    });
  });

  it('Should pair with the agent', (done) => {
    sdk.pair(sdk.name, (err, res) => {
      assert(err === null, err)
      done();
    });
  });

  it('Should create a manual permission', (done) => {
    sdk.addManualPermission((err, res) => {
      assert(err === null, err);
      assert(res.result.status === 200);
      done();
    })
  });

  it('Should get the Bitcoin addresses of the manual permission', (done) => {
    const req = {
      permissionIndex: 0,
      isManual: true,
      total: 3,
    }
    sdk.addresses(req, (err, res) => {
      assert(err === null, err);
      assert(res.result.data.addresses.length === 3);
      assert(res.result.data.addresses[0].slice(0, 1) === '3', 'Not a segwit address');
      done();
    })
  });

  it('Should get testnet addresses', (done) => {
    const req = {
      permissionIndex: 0,
      isManual: true,
      total: 3,
      network: 'testnet'
    }
    sdk.addresses(req, (err, res) => {
      assert(err === null, err);
      assert(res.result.data.addresses.length === 3);
      assert(res.result.data.addresses[0].slice(0, 1) === '2', 'Not a testnet address');
      done();
    })
  });

});