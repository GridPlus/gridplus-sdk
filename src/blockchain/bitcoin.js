const { NodeClient } = require('bclient');
const { Network } = require('bcoin');

const config = require('../config.js');
let client;

exports.initBitcoin = function(options={}) {
  return new Promise((resolve, reject) => {
    try {
      client = new NodeClient({
        network: options.network | config.bitcoinNode.network,
        port: options.port | config.bitcoinNode.port,
      });
      client.getInfo()
      .then((info) => {
        if (!info || !info.network) return reject('Could not connect to node')
        return resolve(info);
      })
      .catch((err) => {
        return reject(err);
      })
    } catch (err) {
      return reject(err);
    }
  })
}

exports.getBalance = function(addr) {
  return new Promise((resolve, reject) => {
    // client.getBalance('2N6en3ZNerpFKf69KfsLveTNUosA45i4EXQ')
    // client.getBalance({ account: '*', minconf: 0 })
    // .then((balance) => {
    //   console.log('balance', balance);
    //   return resolve(balance);
    // })
    // .catch((err) => {
    //   console.log('found err', err)
    //   return reject(err);
    // })
    // client.getTransactionByHash('32bbd7cc8550d64fc932bf77940fd15a156e0a08b904af3e9275bbb824956b19')
    console.log(client.listUnspent, '\n\n\n\n')
    client.listUnspent()
    .then((foo) => {
      console.log('got foo', foo)
      return resolve(foo);
    })
    .catch((err) => {
      console.log('found err', err);
      return reject(err);
    })
  })
}