// Basic tests for atomic SDK functionality
const assert = require('assert');
const bitcoin = require('bitcoinjs-lib');
const config = require('../config.js');
const GridPlusSDK = require('../index.js').default;
let startBal, startUtxos, testAddr, testKeyPair, balance;

// Start bcoin client. There is also one running through the SDK,
// but we will use this instance to mine blocks
const { NodeClient } = require('bclient');
const { Network } = require('bcoin');
const client = new NodeClient({
  host: config.bitcoinNode.host,
  network: config.bitcoinNode.network,
  port: config.bitcoinNode.port,
});

// Receiving addresses
let receiving = [];

// Mine enough blocks so that the holder can spend the earliest
// coinbse transaction 
function mineIfNeeded(oldestUtxoHeight, done) {
  client.execute('getblockcount')
  .then((b) => {
    const numNeeded = 101 - b - oldestUtxoHeight;
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
      assert(d.balance > startBal, 'Balance did not increase. Try removing your chaindata: ~/.bcoin/regtest/chain.ldb');
      balance = d.balance;
      mineIfNeeded(d.utxos[0].height, done);
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
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

  it('Should get the first 2 Bitcoin addresses of the manual permission and log address 0', (done) => {
    const req = {
      permissionIndex: 0,
      isManual: true,
      total: 2,
      network: 'testnet'
    }
    sdk.addresses(req, (err, res) => {
      assert(err === null, err);
      assert(res.result.data.addresses.length === 2);
      assert(res.result.data.addresses[0].slice(0, 1) === '2', 'Not a testnet address');
      const addrs = res.result.data.addresses;
      // Get the baseline balance for the addresses
      sdk.getBalance('BTC', addrs[0])
      .then((d) => {
        receiving.push([addrs[0], d.balance]);
        return sdk.getBalance('BTC', addrs[1])
      })
      .then((d) => {
        receiving.push([addrs[1], d.balance]);
        done();
      });
    });
  });

  it('Should form a transaction and send 0.1 BTC to address 0', (done) => {
    const signer = bitcoin.ECPair.fromWIF(config.testing.btcHolder.wif, bitcoin.networks.testnet);
    sdk.getBalance('BTC', config.testing.btcHolder.address)
    .then((d) => {
      const utxo = d.utxos[0];
      const txb = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
      txb.addInput(utxo.hash, utxo.index);
      // Note; this will throw if the address does not conform to the testnet
      // Need to figure out if regtest emulates the mainnet
      txb.addOutput(receiving[0][0], 1e7);
      txb.addOutput(config.testing.btcHolder.address, utxo.value - 1e7 - 1e3);
      txb.sign(0, signer);
      const tx = txb.build().toHex();
      return client.broadcast(tx);
    })
    .then((result) => {
      assert(result.success === true, 'Could not broadcast transaction');
      return client.getMempool();
    })
    .then((mempool) => {
      assert(mempool.length === 1, `Found empty mempool: ${mempool}`)
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });

  it('Should register the updated balance and recognize address 1 as the new receiving address', (done) => {
    client.execute('generate', [ 1 ])
    .then((blocks) => {
      return client.execute('getblock', [blocks[0]])
    })
    .then((block) => {
      assert(block.tx.length > 1, 'Block did not include spend transaction')
      return sdk.getBalance('BTC', receiving[0][0])
    })
    .then((d) => {
      const expectedBal = receiving[0][1] + 1e7;
      assert(d.balance === expectedBal, `Expected balance of ${expectedBal}, got ${d.balance}`);
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });

})