const { NodeClient } = require('bclient');
const { Network } = require('bcoin');

const config = require('../config.js');
let client;

// Initialize a connection to a Bitcoin node. Uses params in config.js by default.
// @param [options] {object}  - may contain `network` and `port` params
// @returns         {Promise}  - contains `info` Object or error
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

// Get the balance (and the set of UTXOs) belonging to a given address (or addresses)
// @param [addr] {string or object}  - single or array of addresses to query 
// @returns      {Promise}           - contains object { balance: <number>, utxos: <Array> } or error
exports.getBalance = function(addr) {
  return new Promise((resolve, reject) => {
    getUtxos(addr)
    .then((utxos) => {
      const toReturn = {
        utxos: utxos,
        balance: sumBalance(utxos),
      };
      return resolve(toReturn);
    })
    .catch((err) => {
      return reject(err);
    })
  });
}

// Get all of the UTXOs for a given address
// @param [addr] {string}  - single address to query
// @returns      {Array}   - array of UTXO objects
function getUtxos(addr) {
  return new Promise((resolve, reject) => {
    client.getCoinsByAddress(addr)
    .then((utxos) => { return resolve(utxos); })
    .catch((err) => { return reject(err); })
  });
}

// Total the balance given a set of UTXO objects
// @param [utxos] {Array}  - array of UTXO objects
// @param [sat]   {bool}   - [optional] if true, return the balance in satoshis
function sumBalance(utxos, sat=true) {
  let balance = 0;
  utxos.forEach((u) => {
    balance += u.value;
  });
  if (sat === true) return balance
  else              return balance / 10 ** 8;   // 1 bitcoin = 10**8 satoshis
}