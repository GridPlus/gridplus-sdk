// Basic tests for atomic SDK functionality
import { NodeClient } from '@gridplus/bclient';
import assert from 'assert';
import bitcoin from 'bitcoinjs-lib';
import { bitcoinNode, testing } from '../src/config.js';
import { Client, providers  } from 'index';
import NodeCrypto from '@gridplus/node-crypto';

const regtest = {  // regtest config from bcoin: http://bcoin.io/docs/protocol_networks.js.html
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'rb',
  bip32: {
    public: 0xeab4fa05,
    private: 0xeab404c7
  },
  pubKeyHash: 0x3c,
  scriptHash: 0x26,
  wif: 0x5a
}

import crypto from 'crypto';

let deviceAddresses, startBal, startUtxos, TX_VALUE;
const CHANGE_INDEX = 2
let CHANGE_AMOUNT = 9000;

const { host, network, port } = bitcoinNode;
const { btcHolder } = testing;
const { regtestAddress } = btcHolder;
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
    const diff = 101 - (b - oldestUtxoHeight);
    const numNeeded = diff > 0 ? diff : 0;
    if (numNeeded > 0) {
      nodeClient.execute('generate', [ numNeeded ])
      .then(() => { done(); })
    } else {
      done();
    }
  })
}

process.on('unhandledRejection', e => { throw e; });

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
    client.getBalance('BTC', { address: testing.btcHolder.regtestAddress }, (err, d) => {
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
      return nodeClient.execute('getblock', [ blocks[0] ])
    })
    .then((b) => {
      return nodeClient.getTX(b.tx[0])
    })
    .then((tx) => {
      assert(tx.outputs[0].address === testing.btcHolder.regtestAddress, 'Mined coinbase address is incorrect')
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });

  it('Should register a balance increase', (done) => {
    // Look for the balance and any unspent transaction outputs
    client.getBalance('BTC', { address: testing.btcHolder.regtestAddress }, (err, d) => {
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
      network: 'regtest'
    }
    client.addresses(req, (err, res) => {
      assert(err === null, err);
      assert(res.result.data.addresses.length === 2);
      deviceAddresses = res.result.data.addresses;
      // Get the baseline balance for the addresses
      client.getBalance('BTC', { address: deviceAddresses[0] }, (err, d) => {
        assert(err === null, err);
        receiving.push([deviceAddresses[0], d.balance]);
        client.getBalance('BTC', { address: deviceAddresses[1] }, (err, d) => {
          assert(err === null, err);
          receiving.push([deviceAddresses[1], d.balance]);
          done();
        });
      });
    });
  });

  it('Should get UTXOs for a few addresses', (done) => {
    const addresses = deviceAddresses.concat(testing.btcHolder.regtestAddress);
    client.getBalance('BTC', { address: addresses }, (err, balances) => {
      console.log('BALANCES', balances)
      assert(err === null, err);
      assert(typeof balances[deviceAddresses[0]].balance === 'number', 'Balance not found for address 0');
      assert(typeof balances[deviceAddresses[1]].balance === 'number', 'Balance not found for address 1');
      assert(typeof balances[testing.btcHolder.regtestAddress].balance === 'number', 'Balance not found for btcHolder address.');
      assert(balances[testing.btcHolder.regtestAddress].balance > 0, 'Balance should be >0 for btcHolder address');
      done();
    })
  });

  it('Should get UTXOs for a single address', (done) => {
    const address = testing.btcHolder.regtestAddress;
    client.getBalance('BTC', { address }, (err, balances) => {
      assert(err === null, err);
      assert(typeof balances.balance === 'number', 'Balance not found');
      assert(balances.balance > 0, 'Balance should be >0');
      done();
    })
  })

  it('Should get transaction history for the same addresses', (done) => {
    const addresses = deviceAddresses.concat(testing.btcHolder.regtestAddress);
    client.getTxHistory('BTC', { addresses }, (err, txs) => {
      assert(err === null, err);
      assert(txs[testing.btcHolder.regtestAddress].length > 0, 'btcHolder address should have more than one transaction in history');      
      done();
    })
  })

  it('Should get transaction history for just one address', (done) => {
    const address = testing.btcHolder.regtestAddress;
    client.getTxHistory('BTC', { address }, (err, txs) => {
      assert(err === null, err);
      assert(txs.length > 0, 'btcHolder address should have more than one transaction in history');      
      done();
    })
  })

  it('Should form a transaction and send 0.1 BTC to address 0', (done) => {
    const signer = bitcoin.ECPair.fromWIF(testing.btcHolder.regtestWif, regtest);
    client.getBalance('BTC', { address: testing.btcHolder.regtestAddress }, (err, d) => {
      assert(err === null, err);
      const utxo = d.utxos[0];
      const txb = new bitcoin.TransactionBuilder(regtest);
      txb.addInput(utxo.hash, utxo.index);
      // Note; this will throw if the address does not conform to the testnet
      // Need to figure out if regtest emulates the mainnet
      txb.addOutput(receiving[0][0], 1e7);
      txb.addOutput(regtestAddress, utxo.value - 1e7 - 1e3);
      txb.sign(0, signer);

      const tx = txb.build().toHex();
      client.broadcast('BTC', { tx }, (err, res) => {
        assert(err === null, err);
        assert(res.timestamp > 0, 'Could not broadcast properly');
        client.getTx('BTC', res.hash, { addresses: testing.btcHolder.regtestAddress }, (err, retTx) => {
          assert(err === null, err);
          assert(retTx.value === -0.1);
          assert(retTx.height === -1, 'Transaction was mined but should not have been');
          assert(retTx.from === testing.btcHolder.regtestAddress, 'Tx not sent from the right address');
          done();
        });
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
    client.getBalance('BTC', { address: receiving[0][0] }, (err, d) => {
      assert(err === null, err);
      const utxo = d.utxos[0];
      TX_VALUE = utxo.value - 10000;
      
      const req = {
        amount: TX_VALUE,
        to: receiving[1][0],
        addresses: deviceAddresses,
        perByteFee: 3,
        changeIndex: CHANGE_INDEX,
        network: 'regtest'
      }
      
      client.buildTx('BTC', req, (err, sigReq) => {
        assert(err === null, err);
        CHANGE_AMOUNT = sigReq.params[4];
        client.signManual(sigReq, (err, res) => {
          assert(err === null, err);
          // Broadcast the transaction
          client.broadcast('BTC', res.data, (err, res) => {
            assert(err === null, err);
            assert(res.timestamp > 0, 'Could not broadcast properly');
            
            nodeClient.execute('generate', [ 1 ])
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
      })
    });
  });

  it('Should ensure the correct change address got the change', (done) => {
    const req = {
      permissionIndex: 0,
      isManual: true,
      total: 4,
      network: 'regtest'
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