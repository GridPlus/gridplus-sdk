import { Client, providers } from 'index';
import bitcoin from 'bitcoinjs-lib';
import NodeCrypto from '@gridplus/node-crypto';
import { assert } from 'elliptic/lib/elliptic/utils';
import { testing } from '../src/config.js';
const { btcHolder } = testing;
let client, deviceAddresses;
process.on('unhandledRejection', e => { throw e; });

const testnet = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'tb',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394
  },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef
}

describe('Bitcoin via BlockCypher: transfers', () => {
  before(() => {
    const btc = new providers.Bitcoin({ network: 'test3', blockcypher: true });
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

  it('Should get the testnet3 balance of the holder account', (done) => {
    client.getBalance('BTC', { address: btcHolder.address }, (err, data) => {
      assert.equal(err, null, err);
      assert(data.utxos.length > 0, `address (${btcHolder.address}) has not sent or received any bitcoins. Please request funds from the faucet (https://coinfaucet.eu/en/btc-testnet/) and try again.`);
      setTimeout(() => { done() }, 750);      
    });
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
      deviceAddresses = res.result.data.addresses;
      // // Get the baseline balance for the addresses
      client.getBalance('BTC', { address: deviceAddresses[0] }, (err, d) => {
        assert(err === null, err);
        done()
      });
    });
  });


  it('Should get UTXOs for a few addresses', (done) => {
    const addresses = deviceAddresses.concat(testing.btcHolder.address);
    client.getBalance('BTC', { address: addresses }, (err, balances) => {
      assert(err === null, err);
      assert(typeof balances[deviceAddresses[0]].balance === 'number', 'Balance not found for address 0');
      assert(typeof balances[deviceAddresses[1]].balance === 'number', 'Balance not found for address 1');
      assert(typeof balances[testing.btcHolder.address].balance === 'number', 'Balance not found for btcHolder address.');
      assert(balances[testing.btcHolder.address].balance > 0, 'Balance should be >0 for btcHolder address');
      setTimeout(() => { done() }, 750);      
    })
  });

  it('Should get transaction history for the holder', (done) => {
    client.getTxHistory('BTC', { addresses: testing.btcHolder.address }, (err, txs) => {
      assert(err === null, err);
      assert(txs.length > 0, 'btcHolder address should have more than one transaction in history');      
      setTimeout(() => { done() }, 750);      
    })
  })

  // it('Should get transaction history for all 3 addresses', (done) => {
  //   const addresses = deviceAddresses.concat(testing.btcHolder.address);
  //   client.getTxHistory('BTC', { addresses }, (err, txs) => {
  //     console.log(txs)
  //     assert(err === null, err);
  //     assert(txs[testing.btcHolder.address].length > 0, 'btcHolder address should have more than one transaction in history');      
  //     done();
  //   })
  // })



  it('Should spend a small amount from the holder address', (done) => {
    const signer = bitcoin.ECPair.fromWIF(testing.btcHolder.wif, testnet);
    client.getBalance('BTC', { address: testing.btcHolder.address }, (err, d) => {
      assert(err === null, err);
      const utxo = d.utxos[0];
      const txb = new bitcoin.TransactionBuilder(testnet);
      // console.log('deviceAddresses[0]', deviceAddresses[0], 'utxo', JSON.stringify(utxo))
      txb.addInput(utxo.hash, utxo.block_index);
      // // Note; this will throw if the address does not conform to the testnet
      // // Need to figure out if regtest emulates the mainnet
      txb.addOutput(deviceAddresses[0], 100);
      txb.addOutput(testing.btcHolder.address, utxo.value - 100 - 100);
      txb.sign(0, signer);

      const tx = txb.build().toHex();
      // console.log('tx', tx)
      // client.broadcast('BTC', { tx }, (err, res) => {
      //   assert(err === null, err);
      //   assert(res.timestamp > 0, 'Could not broadcast properly');
      //   client.getTx('BTC', res.hash, { addresses: testing.btcHolder.regtestAddress }, (err, retTx) => {
      //     assert(err === null, err);
      //     assert(retTx.value === -0.1);
      //     assert(retTx.height === -1, 'Transaction was mined but should not have been');
      //     assert(retTx.from === testing.btcHolder.regtestAddress, 'Tx not sent from the right address');
      //     done();
      //   });
      // });
      done()
    });
  });

})