const Client = require('bitcoin-core');
const config = require('../config.js');
let client;

exports.initBitcoin = function(options={}) {
  return new Promise((resolve, reject) => {
    try {
      client = new Client({
        host: options.host | config.bitcoinNode.host,
        port: options.port | config.bitcoinNode.port, 
        password: options.password | config.bitcoinNode.password, 
        username: options.username | config.bitcoinNode.username, 
        version: options.version | config.bitcoinNode.version, 
      });
      client.getBlockchainInformation((err, data) => {
        if (err) return reject(err)
        else if (!data.blocks) return reject ('Error connecting to bitcoin node')
        else return resolve(true);
      })
    } catch (err) {
      return reject(err);
    }
  })
}