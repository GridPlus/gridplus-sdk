// Basic tests for atomic SDK functionality
import assert from 'assert';
import EthUtil from 'ethereumjs-util';
import Tx from 'ethereumjs-tx';
import { testing } from '../src/config.js';
import { Client, providers, tokens } from 'index';
import NodeCrypto from 'gridplus-node-crypto';

const { erc20Src } = testing;
const transferAmount = 154;
const randAddr = '0xdde20a2810ff23775585cf2d87991c7f5ddb8c22';

let client, addr, erc20Addr, erc20Addr2, sender, senderPriv, balance;

describe('Ethereum', () => {

  before(() => {

    const eth = new providers.Ethereum();
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
    client.pair(appSecret, (err) => {
      assert(err === null, err)
      done();
    });
  });

  it('Should create a manual permission', (done) => {
    client.addManualPermission((err) => {
      assert(err === null, err);
      done();
    })
  });

  it('Should get the ETH address', (done) => {
    const req = {
      permissionIndex: 0,
      isManual: true,
      total: 1,
      coin_type: '60\''
    }
    client.addresses(req, (err, addresses) => {
      assert(err === null, err);
      addr = addresses;
      client.getBalance('ETH', { address: addr }, (err, data) => {
        assert.equal(err, null, err);
        assert(data.nonce > -1);
        balance = data.balance;
        done();
      });
    });
  });

  const toSend = Math.pow(10, 18);
  it('Should transfer ETH to the address', (done) => {
    sender = testing.ethHolder;
    senderPriv = Buffer.from(sender.privKey, 'hex');
    // Build a tx for the sender
    const opts = {
      from: sender.address,
      to: addr,
      value: toSend,
    }
    client.buildTx('ETH', opts, (err, _tx) => {
      assert(err === null, err);
      const { params } = _tx;
      const txObj = new Tx({ nonce: params[0], gasPrice: params[1], gasLimit: params[2], to: params[3], value: params[4], data: params[5] });
      txObj.sign(senderPriv);
      const serTx = txObj.serialize();
      const data = { tx: `0x${serTx.toString('hex')}` };
      client.broadcast('ETH', data, (err, txHash) => {
        console.log('txHash', txHash)
        assert(err === null, err);
        setTimeout(() => {
          client.getTx('ETH', txHash, (err, txs) => {
            assert(err === null, err);
            assert(txs.height > 0, 'Tx was not mined');
            done();
          });
        }, 300);
      })
    })
  });

  it('Should find a non-zero ETH balance for the address', (done) => {
    client.getBalance('ETH', { address: addr }, (err, data) => {
      assert(err === null, err);
      const _balance = data.balance;
      assert(typeof _balance === 'number');
      // Note that _balances are returned in whole units (ether)
      assert(_balance === balance + toSend, `Expected balance of ${balance + toSend}, but got ${_balance}`);
      balance = _balance;
      done();
    });
  });

  it('Should deploy an ERC20 token', (done) => {
    const opts = {
      from: sender.address,
      to: addr,
      value: 0,
    }
    client.buildTx('ETH', opts, (err, _tx) => {
      assert(err === null, err);
      const { params } = _tx;
      const rawTx = {
        nonce: params[0],
        gasPrice: params[1],
        gasLimit: '0x1e8480',
        value: 0,
        data: erc20Src,
      }
      const txObj = new Tx(rawTx);
      txObj.sign(senderPriv);
      const serTx = txObj.serialize();
      const data = { tx: `0x${serTx.toString('hex')}` };
      client.broadcast('ETH', data, (err, txHash) => {
        assert(err === null, err);
        client.providers.ETH.provider.getTransactionReceipt(txHash)
        .then((receipt) => {
          assert(receipt.contractAddress !== undefined, 'Contract did not deploy properly');
          erc20Addr = receipt.contractAddress;
          done();
        })
        .catch((err) => { assert(err === null, `Got Error: ${err}`); done(); });
      })
    });
  });

  it('Should deploy a second ERC20 token', (done) => {
    const opts = {
      from: sender.address,
      to: addr,
      value: 0,
    }
    client.buildTx('ETH', opts, (err, _tx) => {
      assert(err === null, err);
      const { params } = _tx;
      const rawTx = {
        nonce: params[0],
        gasPrice: params[1],
        gasLimit: '0x1e8480',
        value: 0,
        data: erc20Src,
      }
      const txObj = new Tx(rawTx);
      txObj.sign(senderPriv);
      const serTx = txObj.serialize();
      const data = { tx: `0x${serTx.toString('hex')}` };
      client.broadcast('ETH', data, (err, txHash) => {
        assert(err === null, err);
        client.providers.ETH.provider.getTransactionReceipt(txHash)
        .then((receipt) => {
          assert(receipt.contractAddress !== undefined, 'Contract did not deploy properly');
          erc20Addr2 = receipt.contractAddress;
          done();
        })
        .catch((err) => { assert(err === null, `Got Error: ${err}`); done(); });
      })
    });
  });

  it('Should transfer some ERC20 (1) tokens to the address', (done) => {
    const opts = {
      from: sender.address,
      to: addr,
      value: transferAmount,
      ERC20Token: erc20Addr
    };
    client.buildTx('ETH', opts, (err, _tx) => {
      assert(err === null, err);
      const { params } = _tx;
      const txObj = new Tx(params);
      txObj.sign(senderPriv);
      const serTx = txObj.serialize();
      const data = { tx: `0x${serTx.toString('hex')}` };
      client.broadcast('ETH', data, (err, txHash) => {
        assert(err === null, err);
        client.getTx('ETH', txHash, (err, minedTx) => {
          assert(err === null, err);
          assert(minedTx.height > -1);
          done();
        });
      });
    });
  });

  it('Should transfer some ERC20 (2) tokens to the address', (done) => {
    const opts = {
      from: sender.address,
      to: addr,
      value: transferAmount,
      ERC20Token: erc20Addr2
    };
    client.buildTx('ETH', opts, (err, _tx) => {
      assert(err === null, err);
      const txObj = new Tx(_tx.params);
      txObj.sign(senderPriv);
      const serTx = txObj.serialize();
      const data = { tx: `0x${serTx.toString('hex')}` };
      client.broadcast('ETH', data, (err, txHash) => {
        assert(err === null, err);
        client.getTx('ETH', txHash, (err, minedTx) => {
          assert(err === null, err);
          assert(minedTx.height > -1);
          done();
        });
      });
    });
  });

  it('Should transfer some ERC20 (2) tokens to the random address', (done) => {
    const opts = {
      from: sender.address,
      to: randAddr,
      value: transferAmount,
      ERC20Token: erc20Addr2,
    };
    client.buildTx('ETH', opts, (err, _tx) => {
      assert(err === null, err);
      const { params } = _tx;
      const txObj = new Tx(params);
      txObj.sign(senderPriv);
      const serTx = txObj.serialize();
      const data = { tx: `0x${serTx.toString('hex')}` };
      client.broadcast('ETH', data, (err, txHash) => {
        assert(err === null, err);
        client.getTx('ETH', txHash, (err, minedTx) => {
          assert(err === null, err);
          assert(minedTx.height > -1);
          done();
        });
      });
    });
  });

  it('Should get the token transfer history for a single token', (done) => {
    client.getTxHistory('ETH', { address: addr, ERC20Token: erc20Addr2 }, (err, txHistory) => {
      assert(err === null, err);
      assert(txHistory.length === 1, `Number of transfers should be 1, but got ${txHistory.length}`);
      assert(txHistory[0].value === transferAmount, 'Transfer amount incorrect.')
      assert(txHistory[0].in === 1, 'Transfer should be inbound, but was not')
      done();
    });
  });

  it('Should get the token transfer history for both tokens', (done) => {
    client.getTxHistory('ETH', { address: addr, ERC20Token: [ erc20Addr, erc20Addr2 ] }, (err, txHistory) => {
      assert(err === null, err);
      assert(txHistory.length === 2, `Number of transfers should be 2, but got ${txHistory.length}`);
      assert(txHistory[0].value === transferAmount, 'Transfer amount incorrect.')
      assert(txHistory[1].value === transferAmount, 'Transfer amount incorrect.')
      assert(txHistory[0].in === 1, 'Transfer should be inbound, but was not')
      assert(txHistory[1].in === 1, 'Transfer should be inbound, but was not')
      done();
    });
  });

  it('Should get the token transfer history for multiple addresses', (done) => {
    client.getTxHistory('ETH', { address: [ addr, randAddr ], ERC20Token: [ erc20Addr, erc20Addr2 ] }, (err, txHistory) => {
      assert(err === null, err);
      assert(txHistory.length === 3, `Number of transfers should be 3, but got ${txHistory.length}`);
      assert(txHistory[0].value === transferAmount, 'Transfer amount incorrect.')
      assert(txHistory[1].value === transferAmount, 'Transfer amount incorrect.')
      assert(txHistory[0].in === 1, 'Transfer should be inbound, but was not')
      assert(txHistory[1].in === 1, 'Transfer should be inbound, but was not')
      done();
    });
  });

  it('Should transfer ETH out of the first agent account', (done) => {
    const req = {
      schemaCode: 'ETH',
      params: {
        nonce: null,
        gasPrice: 100000000,
        gas: 100000,
        to: randAddr,
        value: 10000,
        data: ''
      },
      accountIndex: 0, // corresponds to addr
      sender: addr,    // full address corresponding to accountIndex=0
    }
    client.signManual(req, (err, data) => {
      assert(err === null, err);
      // Create a new transaction with the returned signature
      client.broadcast('ETH', data, (err, txHash) => {
        assert(err === null, err);
        client.getTx('ETH', txHash, (err, tx) => {
          assert(err === null, err);
          assert(tx.height > -1, 'Block was not mined');
          assert(tx.from.toLowerCase() === addr.toLowerCase(), `Incorrect signer: got ${tx.from}, expected ${addr}`);
          client.getBalance('ETH', { address: addr }, (err, data) => {
            assert(err === null, err);
            assert(data.balance < balance, 'Balance did not reduce');
            done();
          });
        });
      });
    });
  });

  it('Should transfer the ERC20 token out of the agent account', (done) => {
    const req = {
      schemaCode: 'ETH-ERC20',
      params: {
        nonce: null,
        gasPrice: 100000000,
        gas: 100000,
        to: erc20Addr,
        value: 0,
        data: {
          to: randAddr,
          value: 1
        }
      },
      accountIndex: 0,
      sender: addr,
    };
    client.signManual(req, (err, sigData) => {
      assert(err === null, err);
      client.broadcast('ETH', sigData, (err, txHash) => {
        assert(err === null, err);
        client.getTx('ETH', txHash, (err, tx) => {
          assert(err === null, err);
          assert(tx.height > -1, 'Transaction not included in block');
          client.getBalance('ETH', { address: addr }, (err, data) => {
            assert(err === null, err);
            assert(data.nonce > -1);
            done();
          });
        });
      });
    });
  });

  it('Should get a list of tokens and check a balance', (done) => {
    const tokenList = tokens;
    assert(tokenList && Object.keys(tokenList).length > 0);
    done();
  })

  it('Should get the token balance of the first receiving address', (done) => {
    client.getTokenBalance({ address: addr, tokens: [ erc20Addr, erc20Addr2 ] }, (err, res) => {
      assert(err === null, err);
      assert(parseInt(res[erc20Addr]) === transferAmount - 1, `Expected balance of ${transferAmount - 1}, but got ${res[erc20Addr]}`);
      assert(parseInt(res[erc20Addr2]) === transferAmount, `Expected balance of ${transferAmount}, but got ${res[erc20Addr2]}`);
      done();
    })
  })

  it('Should create an automated permission.');

  it('Should make an automated signature request and broadcast the response in a transaction.');

});