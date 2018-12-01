// Basic tests for atomic SDK functionality
import assert from 'assert';
import Tx from 'ethereumjs-tx';
import config from '../src/config.js';
import { Client, providers } from 'index';
import NodeCrypto from 'gridplus-node-crypto';
const TIMEOUT_SEC = 59;
const { erc20Src } = require('./config.json');
const { ethHolder, etherscanApiKey } = require('../secrets.json');
let client, addr, erc20Addr, sender, senderPriv, addr2;
const transferAmount = 54;

describe('Ethereum via Etherscan: ether transfers', () => {

  before(() => {
    const opts = {
      network: 'rinkeby', 
      etherscan: true, 
      apiKey: etherscanApiKey 
    }

    const eth = new providers.Ethereum(opts);
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

  it('Should get the Rinkeby balance of the holder account', (done) => {
    client.getBalance('ETH', { address: ethHolder.address }, (err, data) => {
      assert.equal(err, null, err);
      assert(data.balance > 10**17, 'User does not have sufficient balance');
      done();
    })
  })

  it('Should get the ETH address', (done) => {
    const req = {
      total: 2,
      coin_type: '60\''
    }
    client.addresses(req, (err, addresses) => {
      assert(err === null, err);
      assert(addresses.length === 2, `Expected 2 addresses. Got ${addresses.length}`);
      addr = addresses[0];
      addr2 = addresses[1];
      client.getBalance('ETH', { address: addr }, (err, data) => {
        assert.equal(err, null, err);
        assert(data.nonce > -1);
        done();
      });
    });
  });

  const toSend = Math.pow(10, 15);
  it('Should transfer ETH to the address (20s)', (done) => {
    sender = ethHolder;
    senderPriv = Buffer.from(sender.privKey, 'hex');
    // Build a tx for the sender
    const tx = {
      nonce: null,
      gasPrice: 1e9,
      gas: 50000, 
      from: sender.address,
      to: addr,
      value: toSend,
      data: '',
    };
    client.providers.ETH.getNonce(tx.from)
    .then((nonce) => {
      tx.nonce = nonce;
      const txObj = new Tx(tx);
      txObj.sign(senderPriv);
      const serTx = txObj.serialize();
      const data = { tx: `0x${serTx.toString('hex')}` };
      client.broadcast('ETH', data, (err, txHash) => {
        assert(err === null, err);
        let count = 0;
        const interval = setInterval(() => {
          client.getTx('ETH', txHash, (err, tx) => {
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

  it('Should create an automated permission.', (done) => {
    const req = {
      schemaCode: 'ETH',
      timeLimit: 0,
      params: {
        value: { lte: 12000 },
      }
    };
    client.addPermission(req, (err) => {
      assert(err === null, err);
      done();
    })
  });

  it('Should make an automated signature request and broadcast the response in a transaction.', (done) => {
    const req = {
      total: 2,
      coin_type: '60\''
    };
    client.addresses(req, (err, addresses) => {
      assert(err === null, err);
      client.providers.ETH.getNonce(addresses[0])
      .then((nonce) => {
        const req2 = {
          usePermission: true,
          schemaCode: 'ETH',
          params: {
            nonce,
            gasPrice: 1e9,
            gas: 1e6,
            to: addresses[1],
            value: 10000,
            data: '',
          },
          accountIndex: 0
        };
        client.sign(req2, (err, sigData) => {
          assert(err === null, err);
          client.broadcast('ETH', sigData, (err, txHash) => {
            assert(err === null, err);
            assert(txHash !== undefined && txHash !== null);
            done();
          })
        });
      })
      .catch((err) => {
        assert(err === null, err);
      })
    });
  });

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
    sender = ethHolder;
    senderPriv = Buffer.from(sender.privKey, 'hex');
    const tx = {
      nonce: null,
      gasPrice: 1e9,
      gas: '0x1e8480', 
      from: sender.address,
      value: 0,
      data: erc20Src
    };
    client.providers.ETH.getNonce(tx.from)
    .then((nonce) => {
      tx.nonce = nonce;
      const txObj = new Tx(tx);
      txObj.sign(senderPriv);
      const serTx = txObj.serialize();
      const data = { tx: `0x${serTx.toString('hex')}` };
      client.broadcast('ETH', data, (err, txHash) => {
        assert(err === null, err);
        let count = 0;
        const interval = setInterval(() => {
          client.getTx('ETH', txHash, (err, tx) => {
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
    })
    .catch((err) => { throw new Error(err); })
  });

  it('Should transfer some ERC20 tokens to the address', (done) => {
    const tx = {
      nonce: null,
      to: erc20Addr,
      gasPrice: 1e9,
      gas: 100000, 
      from: sender.address,
      value: 0,
      data: config.erc20.transfer(addr, transferAmount),
    };
    client.providers.ETH.getNonce(tx.from)
    .then((nonce) => {
      tx.nonce = nonce;
      const txObj = new Tx(tx);
      txObj.sign(senderPriv);
      const serTx = txObj.serialize();
      const data = { tx: `0x${serTx.toString('hex')}` };
      client.broadcast('ETH', data, (err, txHash) => {
        assert(err === null, err);
        let count = 0;
        const interval = setInterval(() => {
          client.getTx('ETH', txHash, (err, txs) => {
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
    })
    .catch((err) => { throw new Error(err); })
  });

  it('Should transfer some ERC20 tokens to the second address', (done) => {
    const tx = {
      nonce: null,
      to: erc20Addr,
      gasPrice: 1e9,
      gas: 100000, 
      from: sender.address,
      value: 0,
      data: config.erc20.transfer(addr2, transferAmount),
    };
    client.providers.ETH.getNonce(tx.from)
    .then((nonce) => {
      tx.nonce = nonce;
      const txObj = new Tx(tx);
      txObj.sign(senderPriv);
      const serTx = txObj.serialize();
      const data = { tx: `0x${serTx.toString('hex')}` };
      client.broadcast('ETH', data, (err, txHash) => {
        assert(err === null, err);
        let count = 0;
        const interval = setInterval(() => {
          client.getTx('ETH', txHash, (err, txs) => {
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

  it('Should get the token balance of the first receiving address', (done) => {
    client.getTokenBalance({ address: addr, tokens: erc20Addr }, (err, res) => {
      assert(err === null, err);
      assert(parseInt(res[erc20Addr]) === transferAmount, `Expected balance of ${transferAmount}, but got ${res[erc20Addr]}`);
      done();
    })
  })

  it('Should get no history for a random token address', (done) => {
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