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

// Mine enough blocks so that the holder can spend the earliest
// coinbse transaction 
function mineIfNeeded(oldestUtxoHeight, done) {
  client.execute('getblockcount')
  .then((b) => {
    const numNeeded = b - oldestUtxoHeight;
    if (numNeeded > 0) {
      client.execute('generate', [ numNeeded ])
      .then(() => { done(); })
    } else {
      done();
    }
  })
}


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
      mineIfNeeded(d.utxos[0].height, done);
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });

  it('Should make a connection to an agent');

  // We should be able to send some kind of signal to the agent instance to accept requests
  // (only in test mode)
  it('Should create a read-only permission');

  it('Should get the first 2 addresses associated with the permission');

  it('Should scan the addresses and find that the first one is the receiving address (i.e. has 0 balance)');

  it('Should form a transaction and send 0.1 BTC to address 0', (done) => {
    const addr = '2NGHjvjw83pcVFgMcA7QvSMh2c246rxLVz9';
    const signer = bitcoin.ECPair.fromWIF(config.testing.btcHolder.wif, bitcoin.networks.testnet);
    sdk.getBalance('BTC', config.testing.btcHolder.address)
    .then((d) => {
      const utxo = d.utxos[0];
      const txb = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
      txb.addInput(utxo.hash, utxo.index);
      // Note; this will throw if the address does not conform to the testnet
      // Need to figure out if regtest emulates the mainnet
      txb.addOutput(addr, 1e7);
      txb.addOutput(config.testing.btcHolder.address, 50e8 - 1e7);
      txb.sign(0, signer);
      const tx = txb.build().toHex();
      return client.broadcast(tx);
    })
    .then((result) => {
      assert(result.success === true, 'Could not broadcast transaction');
      return client.getMempool();
    })
    .then((mempool) => {
      console.log('mempool', mempool)
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });

  it('Should register the updated balance and recognize address 1 as the new receiving address', (done) => {
    const addr = '2NGHjvjw83pcVFgMcA7QvSMh2c246rxLVz9';
    client.execute('generate', [ 1 ])
    .then(() => {
      return sdk.getBalance('BTC', config.testing.btcHolder.address)
    })
    .then((d) => {
      const expectedBal = startBal + 100e8 - 1e7;
      assert(d.balance === expectedBal, `Expected balance of ${expectedBal}, got ${d.balance}`);
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });
})
