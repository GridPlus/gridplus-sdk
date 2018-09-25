import { Client, providers } from 'index';
import bitcoin from 'bitcoinjs-lib';
import NodeCrypto from '@gridplus/node-crypto';
import { assert } from 'elliptic/lib/elliptic/utils';
import { testing } from '../src/config.js';
const { btcHolder } = testing;
let client, deviceAddresses, sentTx, utxo, newUtxo;
process.on('unhandledRejection', e => { throw e; });

const bcy = {                    // blockcypher testnet
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'bc',
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4
  },
  pubKeyHash: 0x1B,
  scriptHash: 0x05,
  wif: 0x49
};

describe('Bitcoin via BlockCypher: transfers', () => {
  before(() => {
    const btc = new providers.Bitcoin({ network: 'test', blockcypher: true, coin: 'bcy' });
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
      setTimeout(() => { done() }, 750);
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
      network: 'bcy'
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

  it('Should get the testnet3 balance of the holder account', (done) => {
    client.getBalance('BTC', { address: btcHolder.bcyAddress }, (err, data) => {
      assert.equal(err, null, err);
      assert(data.utxos.length > 0, `address (${btcHolder.bcyAddress}) has not sent or received any bitcoins. Please request funds from the faucet (https://coinfaucet.eu/en/btc-testnet/) and try again.`);
      assert(data.utxos[0].height > 0 && data.utxos[0].index !== undefined);
      utxo = data.utxos[0];
      setTimeout(() => { done() }, 750);      
    });
  });

  // it('Should get UTXOs for a few addresses', (done) => {
  //   const addresses = deviceAddresses.concat(testing.btcHolder.bcyAddress);
  //   client.getBalance('BTC', { address: addresses }, (err, balances) => {
  //     assert(err === null, err);
  //     assert(typeof balances[deviceAddresses[0]].balance === 'number', 'Balance not found for address 0');
  //     assert(typeof balances[deviceAddresses[1]].balance === 'number', 'Balance not found for address 1');
  //     assert(typeof balances[testing.btcHolder.bcyAddress].balance === 'number', 'Balance not found for btcHolder address.');
  //     assert(balances[testing.btcHolder.bcyAddress].balance > 0, 'Balance should be >0 for btcHolder address');
  //     setTimeout(() => { done() }, 750);      
  //   })
  // });

  // it('Should get transaction history for the holder', (done) => {
  //   client.getTxHistory('BTC', { addresses: testing.btcHolder.bcyAddress }, (err, txs) => {
  //     assert(err === null, err);
  //     assert(txs.length > 0, 'btcHolder address should have more than one transaction in history');      
  //     setTimeout(() => { done() }, 1000);      
  //   })
  // })

  // it('Should get transaction history for all 3 addresses', (done) => {
  //   const addresses = deviceAddresses.concat(testing.btcHolder.bcyAddress);
  //   client.getTxHistory('BTC', { addresses }, (err, txs) => {
  //     assert(err === null, err);
  //     assert(txs[testing.btcHolder.bcyAddress].length > 0, 'btcHolder address should have more than one transaction in history');      
  //     setTimeout(() => { done() }, 1000);
  //   })
  // })

  it('Should spend a small amount from the holder address', (done) => {
    const signer = bitcoin.ECPair.fromWIF(testing.btcHolder.bcyWif, bcy);
    const txb = new bitcoin.TransactionBuilder(bcy);
    txb.addInput(utxo.hash, utxo.index);
    // // Note; this will throw if the address does not conform to the testnet
    // // Need to figure out if regtest emulates the mainnet
    txb.addOutput(deviceAddresses[0], 10000);
    txb.addOutput(testing.btcHolder.bcyAddress, utxo.value - 10000 - 100);
    txb.sign(0, signer);
    const tx = txb.build().toHex();  
    client.broadcast('BTC', { tx }, (err, res) => {
      assert(err === null, err);
      sentTx = res;
      done();
    });
  })

  it('Should get the utxo of the new account', (done) => {
    client.getBalance('BTC', { address: deviceAddresses[0] }, (err, data) => {
      assert.equal(err, null, err);
      assert(data.utxos.length > 0, `address (${deviceAddresses[0]}) has not sent or received any bitcoins. Please request funds from the faucet (https://coinfaucet.eu/en/btc-testnet/) and try again.`);
      assert(data.utxos[0].height > 0 && data.utxos[0].index !== undefined);
      newUtxo = data.utxos[0];
      setTimeout(() => { done() }, 750);      
    });
  });

  it('Should spend some of the new coins from the lattice address', (done) => {
    console.log('newUtxo', newUtxo)
    const req = {
      amount: newUtxo.value - 90,
      to: deviceAddresses[0],
      addresses: deviceAddresses,
      perByteFee: 3,
      changeIndex: 2,
      network: 'bcy'
    };
    client.buildTx('BTC', req, (err, sigReq) => {
      console.log('sigReq', sigReq, err)
      done()
      // assert(err === null, err);
      // client.signManual(sigReq, (err, res) => {
      //   assert(err === null, err);
      //   console.log('signed', res)
      //   done();
      // })
    })  
  });

});