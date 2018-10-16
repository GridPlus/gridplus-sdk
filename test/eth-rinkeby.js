// Basic tests for atomic SDK functionality
import assert from 'assert';
import EthUtil from 'ethereumjs-util';
import Tx from 'ethereumjs-tx';
import { SPLIT_BUF, testing } from '../src/config.js';
import { Client, providers } from 'index';
import NodeCrypto from '@gridplus/node-crypto';
const TIMEOUT_SEC = 59;
const { erc20Src, ethHolder } = testing;

let client, addr, erc20Addr, sender, senderPriv, balance, addr2;
const transferAmount = 54;

describe('Ethereum via Etherscan: ether transfers', () => {

  before(() => {

    const eth = new providers.Ethereum({ network: 'rinkeby', etherscan: true });
    client = new Client({
      clientConfig: {
        name: 'basic-test',
        crypto: NodeCrypto,
        privKey: NodeCrypto.randomBytes(32).toString('hex'),
      },
      providers: [ eth ],
    });

  });

  it('Should connect to an ETH node', (done) => {
    client.initialize((err, provider) => {
      assert(err === null, err);
      assert(typeof provider === 'object');
      done();
    })
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
    console.log('Pairing with app secret: ', appSecret)
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

  it('Should get the Rinkeby balance of the holder account', (done) => {
    client.getBalance('ETH', { address: ethHolder.address }, (err, data) => {
      assert.equal(err, null, err);
      assert(data.balance > 10**17, 'User does not have sufficient balance');
      done();
    })
  })

  it('Should get the ETH address', (done) => {
    const req = {
      permissionIndex: 0,
      isManual: true,
      total: 2,
      coin_type: '60\''
    }
    client.addresses(req, (err, res) => {
      assert(err === null, err);
      assert(res.result.data.addresses.length === 2, `Expected 2 addresses. Got ${res.result.data.addresses.length}`);
      addr = res.result.data.addresses[0];
      addr2 = res.result.data.addresses[1];
      client.getBalance('ETH', { address: addr }, (err, data) => {
        assert.equal(err, null, err);
        assert(data.nonce > -1);
        balance = data.balance;
        done();
      });
    });
  });

  const toSend = Math.pow(10, 15);
  it('Should transfer ETH to the address (20s)', (done) => {
    sender = testing.ethHolder;
    senderPriv = Buffer.from(sender.privKey, 'hex');
    // Build a tx for the sender
    client.buildTx('ETH', sender.address, addr, toSend, (err, _tx) => {
      assert(err === null, err);
      const txObj = new Tx({ nonce: _tx[0], gasPrice: _tx[1], gasLimit: _tx[2], to: _tx[3], value: _tx[4], data: _tx[5] });
      txObj.sign(senderPriv);
      const serTx = txObj.serialize();
      const data = { tx: `0x${serTx.toString('hex')}` };
      client.broadcast('ETH', data, (err, res) => {
        assert(err === null, err);
        assert(res && res.hash && res.timestamp, 'Did not broadcast properly');
        let count = 0;
        const interval = setInterval(() => {
          client.getTx('ETH', res.hash, (err, tx) => {
            if (count > TIMEOUT_SEC) {
              assert(err === null, err);
              assert(tx.height > 0, 'Tx was not mined');
              done();
            } else if (tx.height > 0) {
              clearInterval(interval);
              done();
            } else {
              count += 1;
            }
          });
        }, 1000);
      })
    })
  });

  it('Should get a list of transactions', (done) => {
    client.getTxHistory('ETH', { address: ethHolder.address }, (err, txs) => {
      assert.equal(err, null, err);
      assert(txs.length > 0);
      done();
    })
  })
  
});

describe('Ethereum via Etherscan: ERC20 transfers',  () => {

  before(() => {

    const eth = new providers.Ethereum({ network: 'rinkeby', etherscan: true });
    client = new Client({
      clientConfig: {
        name: 'basic-test',
        crypto: NodeCrypto,
        privKey: NodeCrypto.randomBytes(32).toString('hex'),
      },
      providers: [ eth ],
    });

  });

  it('Should deploy an ERC20 token', (done) => {
    sender = testing.ethHolder;
    senderPriv = Buffer.from(sender.privKey, 'hex');
    client.buildTx('ETH', sender.address, addr, 0, {gasPrice: 1e9}, (err, _tx) => {
      assert(err === null, err);
      const rawTx = {
        nonce: _tx[0],
        gasPrice: _tx[1],
        gasLimit: '0x1e8480',
        value: 0,
        data: erc20Src,
      }
      const txObj = new Tx(rawTx);
      txObj.sign(senderPriv);
      const serTx = txObj.serialize();
      const data = { tx: `0x${serTx.toString('hex')}` };
      client.broadcast('ETH', data, (err, res) => {
        assert(err === null, err);
        assert(res && res.hash && res.timestamp, 'Did not broadcast properly');
        let count = 0;
        const interval = setInterval(() => {
          client.getTx('ETH', res.hash, (err, tx) => {
            if (count > TIMEOUT_SEC) {
              assert(err === null, err);
              assert(tx.height > 0, 'Tx was not mined');
              done();
            } else if (tx && tx.height > 0) {
              clearInterval(interval);
              erc20Addr = tx.data.creates;
              done();
            } else {
              count += 1;
            }
          });
        }, 1000);
      });
    });
  });

  it('Should transfer some ERC20 tokens to the address', (done) => {
    const opts = {
      gasPrice: 1e9, 
      ERC20Token: erc20Addr,
    }
    client.buildTx('ETH', sender.address, addr, transferAmount, opts, (err, _tx) => {
      assert(err === null, err);
      const txObj = new Tx(_tx);
      txObj.sign(senderPriv);
      const serTx = txObj.serialize();
      const data = { tx: `0x${serTx.toString('hex')}` };
      client.broadcast('ETH', data, (err, res) => {
        assert(err === null, err);
        assert(res && res.hash && res.timestamp, 'Did not broadcast properly');
        let count = 0;
        const interval = setInterval(() => {
          client.getTx('ETH', res.hash, (err, txs) => {
            if (count > TIMEOUT_SEC) {
              assert(err === null, err);
              assert(txs.height > 0, 'Tx was not mined');
              done();
            } else if (txs.height > 0) {
              clearInterval(interval);
              done();
            } else {
              count += 1;
            }
          });
        }, 1000);
      });
    });
  });

  it('Should transfer some ERC20 tokens to the second address', (done) => {
    const opts = {
      gasPrice: 1e9, 
      ERC20Token: erc20Addr,
    }
    client.buildTx('ETH', sender.address, addr2, transferAmount, opts, (err, _tx) => {
      assert(err === null, err);
      const txObj = new Tx(_tx);
      txObj.sign(senderPriv);
      const serTx = txObj.serialize();
      const data = { tx: `0x${serTx.toString('hex')}` };
      client.broadcast('ETH', data, (err, res) => {
        assert(err === null, err);
        assert(res && res.hash && res.timestamp, 'Did not broadcast properly');
        let count = 0;
        const interval = setInterval(() => {
          client.getTx('ETH', res.hash, (err, txs) => {
            if (count > TIMEOUT_SEC) {
              assert(err === null, err);
              assert(txs.height > 0, 'Tx was not mined');
              done();
            } else if (txs.height > 0) {
              clearInterval(interval);
              done();
            } else {
              count += 1;
            }
          });
        }, 1000);
      });
    });
  });

  it('Should get the token transfer history for the receiving addresses', (done) => {
    let count = 0;
    const opts = {
      address: [ addr, addr2 ],
      ERC20Token: erc20Addr, 
    }
    const interval = setInterval(() => {
      client.getTxHistory('ETH', opts, (err, txs) => {
        assert(err === null, err);
        if (count > TIMEOUT_SEC) {
          assert(txs.height > 0, 'Could not get correct tx history from etherscan. Try again.');
          assert(txs[txs.length - 1].contractAddress !== null);
          clearInterval(interval);
          done();
        } else if (txs && txs.length > 0) {
          const t = txs[txs.length - 1];
          if (
            t.to.toLowerCase() === addr.toLowerCase() &&
            t.from.toLowerCase() === sender.address.toLowerCase() &&
            t.contractAddress &&
            t.contractAddress.toLowerCase() === erc20Addr.toLowerCase()
          ) {
            assert(t.value === transferAmount.toString(), 'Token transfer value incorrect.')
            clearInterval(interval);
          } else {
            count += 1;
          }
        }
      });
    }, 1000);
    done();
  });

  it('Should get not history for a random token address', (done) => {
    const opts = {
      address: addr,
      ERC20Token: '0xf8025BE99c093e3ea80AfE1F20cd9D64CEAb6626', 
    }
    client.getTxHistory('ETH', opts, (err, txs) => {
      assert(err === null)
      const tokenTransfers = txs.filter((t) => { return t.contractAddress !== null; });
      assert(tokenTransfers.length === 0);
      done();
    })
  })

})