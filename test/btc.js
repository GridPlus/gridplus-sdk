// Basic tests for atomic SDK functionality
import { NodeClient } from 'bclient';
import assert from 'assert';
import bitcoin from 'bitcoinjs-lib';
import { bitcoinNode, SPLIT_BUF, testing } from '../src/config.js';
import { Client, providers  } from 'index';
import NodeCrypto from '@gridplus/node-crypto';

import crypto from 'crypto';

let startBal, startUtxos, TX_VALUE;
const CHANGE_INDEX = 2, CHANGE_AMOUNT = 9000;

const { host, network, port } = bitcoinNode;
const { btcHolder } = testing;
const { address } = btcHolder;
// Start bcoin client. There is also one running through the SDK,
// but we will use this instance to mine blocks
const nodeClient = new NodeClient({
  host,
  network,
  port,
});

// Receiving addresses
const receiving = [];
let client;

// Mine enough blocks so that the holder can spend the earliest
// coinbse transaction
function mineIfNeeded(oldestUtxoHeight, done) {
  nodeClient.execute('getblockcount')
  .then((b) => {
    const numNeeded = 101 - b - oldestUtxoHeight;
    if (numNeeded > 0) {
      nodeClient.execute('generate', [ numNeeded ])
      .then(() => { done(); })
    } else {
      done();
    }
  })
}

describe('Bitcoin', () => {

  before(() => {

    const btcProvider = new providers.Bitcoin();
    client = new Client({
      clientConfig: {
        name: 'basic-test',
        crypto: NodeCrypto,
        privKey: crypto.randomBytes(32).toString('hex'),
      },
      providers: [ btcProvider ]
    });

  });

  it('Should connect to a BTC node', (done) => {
    client.initialize((err, connections) => {
      assert.equal(err, null, err);
      assert.equal(connections[0].network, 'regtest', 'Did not connect to testnet');
      done();
    })
  });

  it('Should check the balance of a single address and set a baseline', (done) => {
    // Look for the balance and any unspent transaction outputs
    client.getBalance('BTC', { address: testing.btcHolder.address }, (err, d) => {
      assert(err === null, err);
      startUtxos = d.utxos;
      startBal = d.balance;
      done();
    })
  });

  it('Should mine a block', (done) => {
    nodeClient.execute('generate', [ 1 ])
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
    client.getBalance('BTC', { address: testing.btcHolder.address }, (err, d) => {
      assert(err === null, err);
      assert(d.utxos.length === startUtxos.length + 1, 'Block did not mine to correct coinbase');
      assert(d.balance > startBal, 'Balance did not increase. Try removing your chaindata: ~/.bcoin/regtest/chain.ldb');
      const balance = d.balance;
      // TODO: test balance
      assert.notEqual(balance, null);
      mineIfNeeded(d.utxos[0].height, done);
    });
  });

  it('Should connect to an agent', (done) => {
    const serial = process.env.AGENT_SERIAL;
    client.connect(serial, (err, res) => {
      assert(err === null, err);
      assert(client.client.ecdhPub === res.key, 'Mismatched key on response')
      done()
    });
  });

  it('Should pair with the agent', (done) => {
    const appSecret = process.env.APP_SECRET;
    client.pair(appSecret, (err) => {
      assert(err === null, err)
      done();
    });
  });

  it('Should create a manual permission', (done) => {
    client.addManualPermission((err, res) => {
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
    client.addresses(req, (err, res) => {
      assert(err === null, err);
      assert(res.result.data.addresses.length === 2);
      assert(res.result.data.addresses[0].slice(0, 1) === '2', 'Not a testnet address');
      const addrs = res.result.data.addresses;
      // Get the baseline balance for the addresses
      client.getBalance('BTC', { address: addrs[0] }, (err, d) => {
        assert(err === null, err);
        receiving.push([addrs[0], d.balance]);
        client.getBalance('BTC', { address: addrs[1] }, (err, d) => {
          assert(err === null, err);
          receiving.push([addrs[1], d.balance]);
          done();
        });
      });
    });
  });

  it('Should form a transaction and send 0.1 BTC to address 0', (done) => {
    const signer = bitcoin.ECPair.fromWIF(testing.btcHolder.wif, bitcoin.networks.testnet);
    client.getBalance('BTC', { address: testing.btcHolder.address }, (err, d) => {
      assert(err === null, err);
      const utxo = d.utxos[0];
      const txb = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
      txb.addInput(utxo.hash, utxo.index);
      // Note; this will throw if the address does not conform to the testnet
      // Need to figure out if regtest emulates the mainnet
      txb.addOutput(receiving[0][0], 1e7);
      txb.addOutput(address, utxo.value - 1e7 - 1e3);

      txb.sign(0, signer);
      const tx = txb.build().toHex();
      nodeClient.broadcast(tx)
      .then((result) => {
        assert(result.success === true, 'Could not broadcast transaction');
        return nodeClient.getMempool();
      })
      .then((mempool) => {
        assert(mempool.length > 0, `Found empty mempool: ${mempool}`)
        done();
      })
      .catch((err) => {
        assert(err === null, err);
        done();
      });
    });
  });

  it('Should register the updated balance and recognize address 1 as the new receiving address', (done) => {
    nodeClient.execute('generate', [ 1 ])
    .then((blocks) => {
      return nodeClient.execute('getblock', [blocks[0]])
    })
    .then((block) => {
      assert(block.tx.length > 1, 'Block did not include spend transaction')
      client.getBalance('BTC', { address: receiving[0][0] }, (err, d) => {
        assert(err === null, err);
        const expectedBal = receiving[0][1] + 1e7;
        assert(d.balance === expectedBal, `Expected balance of ${expectedBal}, got ${d.balance}`);
        done();
      });
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });


  it('Should spend out of the first address to the second one', (done) => {
    const req = {
      schemaIndex: 1,
      typeIndex: 2,
      fetchAccountIndex: CHANGE_INDEX,   // the account index where we'd like the change to go
      network: 'testnet',
    }
    client.getBalance('BTC', { address: receiving[0][0] }, (err, d) => {
      assert(err === null, err);
      const utxo = d.utxos[0];
      TX_VALUE = utxo.value - 10000;
      // Create the transaction. Here we will take change of 9000 sats and pay a mining fee of 1000 sats
      // [ version, lockTime, to, value, changeVal ]
      const params = [ 1, 0, receiving[1][0], TX_VALUE, CHANGE_AMOUNT]
      // Parameterize the k81 request with the input
      const inputs = [
        utxo.hash,
        utxo.index,
        'p2sh(p2wpkh)',
        0,
        0,
        utxo.value,
      ];
      req.params = params.concat(inputs);
      // Build a transaction and sign it in the k81
      client.signManual(req, (err, res) => {
        assert(err === null, err);
        const sigData = res.result.data.sigData.split(SPLIT_BUF);
        const tx = sigData[0];
        // Broadcast the transaction
        nodeClient.broadcast(tx)
        .then((success) => {
          assert(success.success === true, 'Failed to broadcast transaction')
          // Check the mempool
          return nodeClient.getMempool()
        })
        .then((mempool) => {
          assert(mempool.length > 0, 'Found empty mempool')
          // Mine a block
          return nodeClient.execute('generate', [ 1 ])
        })
        .then(() => {
          return nodeClient.getMempool()
        })
        .then((mempool) => {
          assert(mempool.length === 0, `Mempool not empty: ${mempool}`)
          client.getBalance('BTC', { address: receiving[1][0] }, (err, d) => {
            // Check the balance of the receiving address
            const prevBal = receiving[1][1];
            const newBal = d.balance;
            assert(newBal === TX_VALUE + prevBal, `Expected new balance of ${TX_VALUE + prevBal}, got ${newBal}`);
            done();
          })
        })
        .catch((err) => {
          assert(err === null, err);
          done();
        });
      });
    });
  });

  it('Should ensure the correct change address got the change', (done) => {
    const req = {
      permissionIndex: 0,
      isManual: true,
      total: 4,
      network: 'testnet'
    }
    client.addresses(req, (err, res) => {
      assert(err === null, err);
      client.getBalance('BTC', { address: res.result.data.addresses[CHANGE_INDEX] }, (err, d) => {
        assert(err === null, err);
        assert(d.utxos.length > 0, 'Did not find any change outputs')
        assert(d.utxos[d.utxos.length - 1].value === CHANGE_AMOUNT, 'Change output was wrong')
        done();
      });
    });
  });

});
