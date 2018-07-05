const { NodeClient } = require('bclient');
const { Network } = require('bcoin');

const config = require('../../config.js');
let client;

// Initialize a connection to a Bitcoin node. Uses params in config.js by default.
// @param [options] {object}  - may contain `network` and `port` params
// @returns         {Promise}  - contains `info` Object or error
exports.initBitcoin = function(options={}) {
  return new Promise((resolve, reject) => {
    try {
      client = new NodeClient({
        host: options.host || config.bitcoinNode.host,
        network: options.network || config.bitcoinNode.network,
        port: options.port || config.bitcoinNode.port,
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

// Get all of the UTXOs for a given address
// @param [_addr] {string or Array}  - address[es] to query
// @returns       {Array}             - array of UTXO objects
exports.getBalance = function(addr) {
  return new Promise((resolve, reject) => {
    if (typeof addr === 'string') {
      getUtxosSingleAddr(addr)
      .then((utxos) => { return resolve(addBalanceSingle(utxos)); })
      .catch((err) => { return reject(err); })
    } else {
      getUtxosMultipleAddrs(addr)
      .then((utxos) => { return resolve(addBalanceMultiple(utxos)); })
      .catch((err) => { return reject(err); })
    }
  });
}

// Get a set of UTXOs for a single address
// @param [addr] {String}  -  Address to look for UTXOs of
// @returns      {Array}   -  Contains set of UTXO object
function getUtxosSingleAddr(addr) {
  return new Promise((resolve, reject) => {
    client.getCoinsByAddress(addr)
    .then((utxos) => {
      const sortedUtxos = _sortUtxos(utxos);
      return resolve(sortedUtxos);
    })
    .catch((err) => {
      return reject(err);
    })
  });
}

// Get a set of UTXOs for a set of addresses
// @param [addrs] {Array}   -  list of addresses to look up
// @returns       {Object}  -  Contains UTXOs:  { addr1: [utxo1, utxo2], ... }
function getUtxosMultipleAddrs(addrs) {
  return new Promise((resolve, reject) => {
    let utxos = {}
    // Make sure there is a list for UTXOs of each address
    addrs.forEach((a) => {
      if (utxos[a] === undefined) utxos[a] = [];
    });
    client.getCoinsByAddresses(addrs)
    .then((bulkUtxos) => {
      // Reconstruct data, indexed by address
      bulkUtxos.forEach((u) => {
        utxos[u.address].push(u);
      });
      return resolve(utxos);
    })
    .catch((err) => {
      return reject(err);
    })
  })
}

// Total the balance given a set of UTXO objects
// @param [utxos] {Array}  - array of UTXO objects (or object containing multiple arrays)
// @param [sat]   {bool}   - [optional] if true, return the balance in satoshis
// @returns       {Object}  - of form  { utxos: <Array>, balance: <Number> }

function addBalanceSingle(utxos, sat=true) {
  let balance = 0;
  utxos.forEach((u) => {
    balance += u.value;
  });
  if (sat !== true) balance /= 10 ** 8;
  return { utxos, balance };
}

// Add the balances to the UTXOs object for multiple addresses
// @param [utxos] {Object}  - object full of UTXO arrays, indexed on address
// @param [sat]   {bool}    - [optional] if true, return the balance in satoshis (false=BTC)
// @returns       {Object}  - of form  { user1: { utxos: <Array>, balance: <Number> } }
function addBalanceMultiple(utxos, sat=true) {
  let d = {};
  Object.keys(utxos).forEach((u) => {
    d[u] = addBalanceSingle(utxos[u], sat);
  });
  return d;
}

// Sort a set of UTXOs based on the block height (earlier blocks first)
function _sortUtxos(_utxos) {
  return _utxos.sort((a, b) => { 
    return (a.height > b.height) ? 1 : ((b.height > a.height) ? -1 : 0) 
  });
}