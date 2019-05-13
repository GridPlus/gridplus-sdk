// import { Client, providers } from 'index';
// import NodeCrypto from 'gridplus-node-crypto';
// import { assert } from 'elliptic/lib/elliptic/utils';
// import { testing } from '../src/config.js';
// const { btcHolder } = testing;
// let client, deviceAddresses;
// process.on('unhandledRejection', e => { throw e; });

// const bcy = {                    // blockcypher testnet
//   messagePrefix: '\x18Bitcoin Signed Message:\n',
//   bech32: 'bc',
//   bip32: {
//     public: 0x0488b21e,
//     private: 0x0488ade4
//   },
//   pubKeyHash: 0x1B,
//   scriptHash: 0x05,
//   wif: 0x49
// };

// const network = 'testnet';
// const coin = 'btc';

// const holderAddress = btcHolder.address // btcHolder.bcyAddress

// describe('Bitcoin via BlockCypher: transfers', () => {
//   before(() => {
//     const btc = new providers.Bitcoin({ network, blockcypher: true, coin });
//     client = new Client({
//       clientConfig: {
//         name: 'blockcypher-test',
//         crypto: NodeCrypto,
//         privKey: NodeCrypto.randomBytes(32).toString('hex'),
//       },
//       providers: [ btc ],
//     }) 
//   })

//   it('Should connect to an agent', (done) => {
//     const serial = process.env.AGENT_SERIAL;
//     client.connect(serial, (err, res) => {
//       assert(err === null, err);
//       assert(client.client.ecdhPub === res.key, 'Mismatched key on response')
//       done()
//     });
//   });

//   it('Should pair with the agent', (done) => {
//     const appSecret = process.env.APP_SECRET;
//     client.pair(appSecret, (err) => {
//       assert(err === null, err)
//       done();
//     });
//   });

//   it('Should create a manual permission', (done) => {
//     client.addManualPermission((err, res) => {
//       assert(err === null, err);
//       assert(res.result.status === 200);
//       done();
//     })
//   });

//   it('Should get the first 2 Bitcoin addresses of the manual permission and log address 0', (done) => {
//     const req = {
//       permissionIndex: 0,
//       isManual: true,
//       total: 2,
//       network,
//     }
//     client.addresses(req, (err, res) => {
//       assert(err === null, err);
//       const addrs = res.result.data.addresses;
//       assert(addrs.length === 2);
//       // assert(addrs[0].slice(0, 1) === 'B' || addrs[0].slice(0, 1) === 'C', 'Address 1 is not a BCY address');
//       // assert(addrs[1].slice(0, 1) === 'B' || addrs[1].slice(0, 1) === 'C', 'Address 2 is not a BCY address')
//       deviceAddresses = addrs;
//       // // Get the baseline balance for the addresses
//       client.getBalance('BTC', { address: deviceAddresses[0] }, (err) => {
//         assert(err === null, err);
//         done()
//       });
//     });
//   });

//   it('Should get the testnet3 balance of the holder account', (done) => {
//     client.getBalance('BTC', { address: holderAddress }, (err, data) => {
//       assert.equal(err, null, err);
//       assert(data.utxos.length > 0, `address (${holderAddress}) has not sent or received any bitcoins. Please request funds from the faucet (https://coinfaucet.eu/en/btc-testnet/) and try again.`);
//       assert(data.utxos[0].height > 0 && data.utxos[0].index !== undefined);
//       utxo = data.utxos[0];
//       setTimeout(() => { done() }, 750);      
//     });
//   });



//   // it('Should get UTXOs for a few addresses', (done) => {
//   //   const addresses = deviceAddresses.concat(holderAddress);
//   //   client.getBalance('BTC', { address: addresses }, (err, balances) => {
//   //     assert(err === null, err);
//   //     assert(typeof balances[deviceAddresses[0]].balance === 'number', 'Balance not found for address 0');
//   //     assert(typeof balances[deviceAddresses[1]].balance === 'number', 'Balance not found for address 1');
//   //     assert(typeof balances[holderAddress].balance === 'number', 'Balance not found for btcHolder address.');
//   //     assert(balances[holderAddress].balance > 0, 'Balance should be >0 for btcHolder address');
//   //     setTimeout(() => { done() }, 750);      
//   //   })
//   // });

//   // it('Should get transaction history for the holder', (done) => {
//   //   client.getTxHistory('BTC', { addresses: holderAddress }, (err, txs) => {
//   //     assert(err === null, err);
//   //     assert(txs.length > 0, 'btcHolder address should have more than one transaction in history');      
//   //     setTimeout(() => { done() }, 1000);      
//   //   })
//   // })

//   // it('Should get transaction history for all 3 addresses', (done) => {
//   //   const addresses = deviceAddresses.concat(holderAddress);
//   //   client.getTxHistory('BTC', { addresses }, (err, txs) => {
//   //     assert(err === null, err);
//   //     assert(txs[holderAddress].length > 0, 'btcHolder address should have more than one transaction in history');      
//   //     setTimeout(() => { done() }, 1000);
//   //   })
//   // })





  // it('Should spend a small amount from the holder address', (done) => {
  //   const signer = bitcoin.ECPair.fromWIF(testing.btcHolder.bcyWif, bcy);
  //   const txb = new bitcoin.TransactionBuilder(bcy);
  //   txb.addInput(utxo.hash, utxo.index);
  //   // // Note; this will throw if the address does not conform to the testnet
  //   // // Need to figure out if regtest emulates the mainnet
  //   txb.addOutput(deviceAddresses[0], 10000);
  //   txb.addOutput(holderAddress, utxo.value - 10000 - 100);
  //   txb.sign(0, signer);
  //   const tx = txb.build().toHex();  
  //   client.broadcast('BTC', { tx }, (err, res) => {
  //     assert(err === null, err);
  //     sentTx = res;
  //     done();
  //   })
  // })

  // it('Should get the utxo of the new account', (done) => {
  //   const a = deviceAddresses[0];
  //   client.getBalance('BTC', { address: a }, (err, data) => {
  //     console.log(data)
  //     assert.equal(err, null, err);
      
  //     assert(data.utxos.length > 0, `Address (${a}) has not sent or received any bitcoins. Please request funds from the faucet (https://coinfaucet.eu/en/btc-testnet/) and try again.`);
  //     assert(data.utxos[0].height > 0 && data.utxos[0].index !== undefined, `Address (${a}) has a transaction, but it has not been confirmed. Please wait until it has`);
  //     // newUtxo = data.utxos[0];
  //     setTimeout(() => { done() }, 750);      
  //   });
  // });

  // it('Should spend some of the new coins from the lattice address', (done) => {
  //   const req = {
  //     amount: 100,
  //     to: holderAddress,
  //     addresses: deviceAddresses,
  //     perByteFee: 1,
  //     changeIndex: 1,
  //     network,
  //   };

  //   client.buildTx('BTC', req, (err, sigReq) => {
  //     console.log('sigreq', sigReq)
  //     assert(err === null, err);
  //     client.signManual(sigReq, (err, res) => {
  //       assert(err === null, err);
  //       console.log('signed', res)
  //       // client.broadcast(res.data, (err2, res2) => {
  //       //   assert(err2 === null, err2);
  //       //   done();
  //       // });
  //       done();
  //     });
  //   });
  // });

// });
