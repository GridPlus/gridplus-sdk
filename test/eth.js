// Basic tests for atomic SDK functionality
import assert from 'assert';
import EthUtil from 'ethereumjs-util';
import Tx from 'ethereumjs-tx';
import { SPLIT_BUF, testing } from '../src/config.js';
import { Client, providers } from 'index';
import NodeCrypto from '@gridplus/node-crypto';

const { erc20Src } = testing;

let client, addr, erc20Addr, sender, senderPriv, balance;

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
    client.addManualPermission((err, res) => {
      assert(err === null, err);
      assert(res.result.status === 200);
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
    client.addresses(req, (err, res) => {
      assert(err === null, err);
      addr = res.result.data.addresses;
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
    client.buildTx('ETH', sender.address, addr, toSend, (err, _tx) => {
      assert(err === null, err);
      const txObj = new Tx({ nonce: _tx[0], gasPrice: _tx[1], gasLimit: _tx[2], to: _tx[3], value: _tx[4], data: _tx[5] });
      txObj.sign(senderPriv);
      const serTx = txObj.serialize();
      const data = { tx: `0x${serTx.toString('hex')}` };
      client.broadcast('ETH', data, (err, res) => {
        assert(err === null, err);
        assert(res && res.hash && res.timestamp, 'Did not broadcast properly');
        setTimeout(() => {
          client.getTx('ETH', res.hash, (err, txs) => {
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
/*
  it('Should deploy an ERC20 token', (done) => {
    client.buildTx('ETH', sender.address, addr, 0, (err, _tx) => {
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
        assert(res && res.hash, 'Did not broadcast properly');
        client.providers.ETH.provider.getTransactionReceipt(res.hash)
        .then((receipt) => {
          assert(receipt.contractAddress !== undefined, 'Contract did not deploy properly');
          erc20Addr = receipt.contractAddress;
          done();
        })
        .catch((err) => { assert(err === null, `Got Error: ${err}`); done(); });
      })
    });
  });

  // A freshly deployed ERC20 token should have a new address, so the balance will be 0
  // (unlike ETH, which may have been sent in previous tests)
  it('Should find a zero token balance for the address', (done) => {
    client.getBalance('ETH', { address: addr, erc20Address: erc20Addr }, (err, data) => {
      assert(err === null, err);
      assert(typeof data.balance === 'number');
      assert(data.balance === 0);
      done();
    });
  });

  it('Should find a non-zero balance for the sender', (done) => {
    client.getBalance('ETH', { address: sender.address, erc20Address: erc20Addr }, (err, data) => {
      assert(err === null, err);
      assert(typeof data.balance === 'number');
      assert(data.balance > 0, `Sender balance should be >0, but is ${data.balance}`);
      done();
    });
  });

  it('Should transfer some ERC20 tokens to the address', (done) => {
    client.buildTx('ETH', sender.address, addr, 1, { ERC20Token: erc20Addr}, (err, _tx) => {
      assert(err === null, err);
      const txObj = new Tx(_tx);
      txObj.sign(senderPriv);
      const serTx = txObj.serialize();
      const data = { tx: `0x${serTx.toString('hex')}` };
      client.broadcast('ETH', data, (err, res) => {
        assert(err === null, err);
        assert(res && res.hash, 'Did not broadcast properly');
        client.getTx('ETH', res.hash, (err, minedTx) => {
          assert(err === null, err);
          assert(minedTx.height > -1);
          done();
        });
      });
    });
  });

  it('Should get the token transfer history for the user', (done) => {
    client.getTxHistory('ETH', { address: addr, erc20Address: erc20Addr }, (err, txHistory) => {
      console.log('ETH txs', txHistory);
      assert(err === null, err);
      assert(txHistory.in.length === 1, `Number of inbound transfers should be 1, but got ${txHistory.in.length}`);
      assert(txHistory.out.length === 0, `Number of outbound transfers should be 0, but got ${txHistory.out.length}`);
      done();
    });
  });
*/
  it('Should transfer ETH out of the agent account', (done) => {
    const randAddr = '0xdde20a2810ff23775585cf2d87991c7f5ddb8c22'
    client.buildTx('ETH', addr, randAddr, 10000, (err, tx) => {
      assert(err === null, err);
      const params = {
        schemaIndex: 0,
        typeIndex: 0,
        params: tx
      };
      client.signManual(params, (err, res) => {
        assert(err === null, err);
        assert(res.result.status === 200);
        const sigData = res.result.data.sigData.split(SPLIT_BUF);
        const msg = EthUtil.sha3(Buffer.from(sigData[0], 'hex'));
        const test = new Tx(tx.concat([null, null, null]));
        test.raw = test.raw.slice(0, test.raw.length - 3);

        const sig = sigData[1];
        const v = parseInt(sig.slice(-1)) + 27;
        const vrs = [ v, Buffer.from(sig.slice(0, 64), 'hex'), Buffer.from(sig.slice(64, 128), 'hex'),  ];
        // Check that the signer is correct
        const signer = '0x' + EthUtil.pubToAddress(EthUtil.ecrecover(Buffer.from(msg, 'hex'), v, vrs[1], vrs[2])).toString('hex');
        assert(signer === addr, `Expected signer to be ${addr}, got ${signer}`);

        // Create a new transaction with the returned signature
        client.broadcast('ETH', res.data, (err, res) => {
          assert(err === null, err);
          assert(res && res.hash, 'Did not broadcast properly');
          client.getTx('ETH', res.hash, (err, tx) => {
            assert(err === null, err);
            assert(tx.height > -1, 'Block was not mined');
            client.getBalance('ETH', { address: addr }, (err, data) => {
              assert(err === null, err);
              assert(data.balance < balance, 'Balance did not reduce');
              done();
            });
          });
        });
      });
    });
  });

  it('Should transfer the ERC20 token out of the agent account', (done) => {
    const randAddr = '0xdde20a2810ff23775585cf2d87991c7f5ddb8c22';
    client.buildTx('ETH', addr, randAddr, 1, { ERC20Token: erc20Addr}, (err, tx) => {
      assert(err === null, err);
      const params = {
        schemaIndex: 0,
        typeIndex: 1,
        params: tx
      };
      client.signManual(params, (err, res) => {
        assert(err === null, err);
        client.broadcast('ETH', res.data, (err, res) => {
          assert(err === null, err);
          assert(res && res.hash, 'Did not broadcast properly');
          // client.providers.ETH.provider.getTransaction(res.hash)
          client.getTx('ETH', res.hash, (err, tx) => {
            assert(err === null, err);
            assert(tx.height > -1, 'Transaction not included in block');
            client.getBalance('ETH', { address: addr, erc20Address: erc20Addr }, (err, data) => {
              assert(err === null, err);
              assert(data.nonce > -1);
              done();
            });
          });
        });
      });
    });
  });

});