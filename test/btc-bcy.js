import { Client, providers } from 'index';
import bitcoin from 'bitcoinjs-lib';
import NodeCrypto from '@gridplus/node-crypto';
import { assert } from 'elliptic/lib/elliptic/utils';
import { testing } from '../src/config.js';
const { btcHolder } = testing;
let client, deviceAddresses, utxo, sentTx, newUtxo;
let balance0 = 0;
process.on('unhandledRejection', e => { throw e; });

const bcy = {                    // blockcypher testnet (https://www.blockcypher.com/dev/bitcoin/#testing)
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'bc',
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4
  },
  pubKeyHash: 0x1b,
  // pubKeyHash: 0x00,     // I think this is the same as mainnet, but not totally sure
  scriptHash: 0x1b,
  wif: 0x49
};

const coin = 'bcy';
const network = 'bcy';
const holderAddress = btcHolder.bcyAddress

describe('Bitcoin via BlockCypher: transfers', () => {
  before(() => {
    const btc = new providers.Bitcoin({ network: 'test', blockcypher: true, coin, timeout: 750 });
    client = new Client({
      clientConfig: {
        name: 'blockcypher-test',
        crypto: NodeCrypto,
        privKey: NodeCrypto.randomBytes(32).toString('hex'),
      },
      providers: [ btc ],
    }) 
  })

  it('Should connect to a BTC node provider', (done) => {
    client.initialize((err, provider) => {
      assert(err === null, err);
      assert(typeof provider === 'object');
      assert(provider[0].height > 0);
      done();
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
      network,
      segwit: false
    }
    client.addresses(req, (err, res) => {
      assert(err === null, err);
      const addrs = res.result.data.addresses;
      assert(addrs.length === 2);
      assert(addrs[0].slice(0, 1) === 'B' || addrs[0].slice(0, 1) === 'C', 'Address 1 is not a BCY address');
      assert(addrs[1].slice(0, 1) === 'B' || addrs[1].slice(0, 1) === 'C', 'Address 2 is not a BCY address')
      deviceAddresses = addrs;
      // // Get the baseline balance for the addresses
      client.getBalance('BTC', { address: deviceAddresses[0] }, (err, d) => {
        assert(err === null, err);
        done()
      });
    });
  });
  
  it('Should get the BCY testnet balance of the holder account', (done) => {
    client.getBalance('BTC', { address: holderAddress }, (err, data) => {
      assert.equal(err, null, err);
      assert(data.utxos.length > 0, `address (${holderAddress}) has not sent or received any bitcoins. Please request funds from the faucet (https://coinfaucet.eu/en/btc-testnet/) and try again.`);
      data.utxos.some((u) => {
        if (u.value >= 10000 && u.height > 0 && u.index !== undefined) {
          utxo = u;
          return true;
        }
      });
      assert(utxo !== undefined, `Unable to find an output with value >=10000 for address ${holderAddress}`);
      done();  
    });
  });

  // it('Should get UTXOs for a few addresses', (done) => {
  //   const addresses = deviceAddresses.concat(holderAddress);
  //   client.getBalance('BTC', { address: addresses }, (err, balances) => {
  //     assert(err === null, err);
  //     assert(typeof balances[deviceAddresses[0]].balance === 'number', 'Balance not found for address 0');
  //     assert(typeof balances[deviceAddresses[1]].balance === 'number', 'Balance not found for address 1');
  //     assert(typeof balances[holderAddress].balance === 'number', 'Balance not found for btcHolder address.');
  //     assert(balances[holderAddress].balance > 0, 'Balance should be >0 for btcHolder address');
  //     balance0 = balances[deviceAddresses[0]].balance;
  //     done();   
  //   })
  // });

  // it('Should get transaction history for the holder', (done) => {
  //   client.getTxHistory('BTC', { addresses: holderAddress }, (err, txs) => {
  //     assert(err === null, err);
  //     assert(txs.length > 0, 'btcHolder address should have more than one transaction in history');      
  //     done();     
  //   })
  // })

  // it('Should get transaction history for all 3 addresses', (done) => {
  //   const addresses = deviceAddresses.concat(holderAddress);
  //   client.getTxHistory('BTC', { addresses }, (err, txs) => {
  //     assert(err === null, err);
  //     assert(txs[holderAddress].length > 0, 'btcHolder address should have more than one transaction in history');      
  //     done();
  //   })
  // })

  it('Should spend a small amount from the holder address', (done) => {
    if (balance0 === 0) {
      const signer = bitcoin.ECPair.fromWIF(testing.btcHolder.bcyWif, bcy);
      const txb = new bitcoin.TransactionBuilder(bcy);
      txb.addInput(utxo.hash, utxo.index);
      // // Note; this will throw if the address does not conform to the testnet
      // // Need to figure out if regtest emulates the mainnet
      txb.addOutput(deviceAddresses[0], 10000);
      txb.addOutput(holderAddress, utxo.value - 10000 - 100);
      txb.sign(0, signer);
      
      const tx = txb.build().toHex();  
      client.broadcast('BTC', { tx }, (err, res) => {
        assert(err === null, err);
        sentTx = res;
        done();
      });
    } else {
      done();
    }
  });

  it('Should get the utxo of the new account', (done) => {
    const a = deviceAddresses[0];
    let count = 0;
    const interval = setInterval(() => {
      client.getBalance('BTC', { address: a }, (err, data) => {
        if (count > 10) {
          assert.equal(err, null, err);      
          assert(data.utxos.length > 0, `Address (${a}) has not sent or received any bitcoins. Please request funds from the faucet (https://coinfaucet.eu/en/btc-testnet/) and try again.`);
          assert(data.utxos[0].height > 0 && data.utxos[0].index !== undefined, `Address (${a}) has a transaction, but it has not been confirmed. Please wait until it has`);
          newUtxo = data.utxos[0];
          done();
        } else if (data.utxos.length > 0 && data.utxos[0].height > 0) {
          newUtxo = data.utxos[0];
          clearInterval(interval);
          done();
        } else {
          count += 1;
        }
      });
    }, 10000);
  });

  it('Should spend some of the new coins from the lattice address', (done) => {
    const req = {
      amount: 100,
      to: holderAddress,
      addresses: deviceAddresses,
      perByteFee: 1,
      changeIndex: 1,
      network,
      scriptType: 'p2pkh'
    };
    client.buildTx('BTC', req, (err, sigReq) => {
      assert(err === null, err);
      client.signManual(sigReq, (err, res) => {
        assert(err === null, err);
        setTimeout(() => {
          client.broadcast('BTC', res.data, (err2, res2) => {
            assert(err2 === null, err2);
            console.log('res2', res2)
            done();
          });
        }, 750);
      });
    });
  });

  it('Should get transaction data from the hashes', (done) => {
    const hashes = [ newUtxo.hash, utxo.hash ];
    client.getTx('BTC', hashes, { addresses: holderAddress }, (err, res) => {
      assert(err === null, err);
      assert(res.length === 2, `Should have gotten 2 filtered tx objects, but got ${res.length}`);
      assert(res[0].from === holderAddress && res[0].in === false, `First filtered transaction of unexpected format: expected outflow from ${holderAddress}`);
      assert(res[1].from === holderAddress && res[1].in === false, `Second filtered transaction of unexpected format: expected outflow from ${holderAddress}`);
      done();
    })
  });
  
  it('Should get the correct explorer url and do a lookup', (done) => {
    assert(client.getExplorerUrl() === null);
    assert(client.getExplorerUrl('BTC'), 'https://live.blockcypher.com/bcy');
    done();
  });
});