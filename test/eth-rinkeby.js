// Basic tests for atomic SDK functionality
import assert from 'assert';
import EthUtil from 'ethereumjs-util';
import Tx from 'ethereumjs-tx';
import { SPLIT_BUF, testing } from '../src/config.js';
import { Client, providers } from 'index';
import NodeCrypto from '@gridplus/node-crypto';

const { erc20Src, ethHolder } = testing;

let client, addr, erc20Addr, sender, senderPriv, balance;

describe('Ethereum (via Etherscan)', () => {

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
          client.getTx('ETH', res.hash, (err, txs) => {
            if (count > 20) {
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
      })
    })
  });

  it('Should get a list of transactions', (done) => {
    client.getBalance('ETH', { address: ethHolder.address }, (err, data) => {
      assert.equal(err, null, err);
      assert(data.transfers.length > 0);
      done();
    })
  })

  
});