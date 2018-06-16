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

// Get the balance (and the set of UTXOs) belonging to a given address (or addresses)
// @param [addr] {string or object}  - single or array of addresses to query 
// @returns      {Promise}           - contains object { balance: <number>, utxos: <Array> } or error
exports.getBalance = function(addr) {
  return new Promise((resolve, reject) => {
    // Copy the addresses in case it's an object and gets modified
    const addrCopy = JSON.parse(JSON.stringify(addr));
    getUtxos(addrCopy)
    .then((utxos) => {
      let toReturn = {};
      if (utxos.length === undefined) {
        // Multiple addresses to check
        Object.keys(utxos).forEach((user) => {
          toReturn[user] = { utxos: utxos[user], balance: sumBalance(utxos[user]) };
        });
      } else {
        // Single address to check
        toReturn = { utxos: utxos, balance: sumBalance(utxos) };
      }
      return resolve(toReturn);
    })
    .catch((err) => {
      return reject(err);
    })
  });
}

// Get all of the UTXOs for a given address
// @param [_addr] {string or Array}  - address[es] to query
// @returns       {Array}             - array of UTXO objects
function getUtxos(_addr, checkedAddrs={}, outerResolve=null) {
  return new Promise((resolve, reject) => {
    let addr = _addr; // assume it's a string
    // If it isn't a string (i.e. multiple addresses, pop the last one)
    const isObj = typeof _addr === 'object';
    if (isObj === true) {
      addr = _addr.pop();
      // Capture the outer resolve statement if not captured
      if (outerResolve === null) outerResolve = resolve;
    }
    // Lookup UTXOs
    client.getCoinsByAddress(addr)
    .then((utxos) => { 
      if (isObj === true) {
        // For multiple addresses 
        checkedAddrs[addr] = utxos;
        if (_addr.length > 0) {
          return getUtxos(_addr, checkedAddrs, outerResolve) 
        } else {
          // Reformat the object and return it
          let toReturn = {};
          Object.keys(checkedAddrs).forEach((user) => {
            toReturn[user] = { utxos: checkedAddrs[user] }
          });
          return outerResolve(checkedAddrs);
        }
      } else {
        // For single addresses
        return resolve(utxos); 
      }
    })
    .catch((err) => { 
      return reject(err); 
    })
  });
}

// Total the balance given a set of UTXO objects
// @param [utxos] {Array or Object}  - array of UTXO objects (or object containing multiple arrays)
// @param [sat]   {bool}   - [optional] if true, return the balance in satoshis
function sumBalance(utxos, sat=true) {
  let balance = 0;
  if (typeof utxos === 'object') {}
  utxos.forEach((u) => {
    balance += u.value;
  });
  if (sat === true) return balance
  else              return balance / 10 ** 8;   // 1 bitcoin = 10**8 satoshis
}