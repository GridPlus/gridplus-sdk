// Basic tests for atomic SDK functionality
const assert = require('assert');
const bitcoin = require('bitcoinjs-lib');
const config = require('../config.js');
const GridPlusSDK = require('../index.js').default;
let startBal, startUtxos, testAddr, testKeyPair;

// Start bcoin client. There is also one running through the SDK,
// but we will use this instance to mine blocks
const { NodeClient } = require('bclient');
const { Network } = require('bcoin');
const client = new NodeClient({
  host: config.bitcoinNode.host,
  network: config.bitcoinNode.network,
  port: config.bitcoinNode.port,
});

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
      assert(info.network === 'regtest', 'Did not connect to testnet');
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });

  it('Should check the balance of a single address and set a baseline', (done) => {
    // Look for the balance and any unspent transaction outputs
    sdk.getBalance('BTC', config.testing.btcHolder.address)
    .then((d) => {
      startUtxos = d.utxos;
      startBal = d.balance;
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });

  it('Should mine a block', (done) => {
    client.execute('generate', [ 1 ])
    .then((blocks) => {
      assert(blocks.length === 1);
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });

  it('Should register a balance increase', (done) => {
    // Look for the balance and any unspent transaction outputs
    sdk.getBalance('BTC', config.testing.btcHolder.address)
    .then((d) => {
      assert(d.utxos.length === startUtxos.length + 1, 'Block did not mine to correct coinbase');
      assert(d.balance === startBal + 50e8, `Expected balance of ${startBal + 50e8}, got ${d.balance}`);
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });

  it('Should form a transaction to spend one of those UTXOs');

})
