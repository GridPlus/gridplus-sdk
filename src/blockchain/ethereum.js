// Integrations to query the Ethereum blockchain for relevant account data
const ethers = require('ethers');
let provider;
const config = require('../../config.js');
const { pad64, unpad } = require('../util.js');
let erc20Decimals = {};


// Instantiate the Ethereum query service. In this case, it is a web3 instance.
exports.initEth = function(_provider=config.defaultWeb3Provider) {
  return new Promise((resolve, reject) => {
    try {
      provider =  new ethers.providers.JsonRpcProvider(_provider);
      return resolve(true);
    } catch (err) {
      return reject(err);
    }
  })
}

// Expose the web3 interface for advanced functionality
exports.getProvider = function() { return provider; }

// Get the balance of an Ethereum account. This can be an ERC20 or ETH balance.
// @param [addr]      {string}  - The account we are querying
// @param [ERC20Addr] {string}  - Address of the ERC20 token we are asking about
// @returns           {Promise} - Contains the balance in full units (i.e. with decimals divided in)
exports.getBalance = function(addr, ERC20Addr=null) {
  return new Promise((resolve, reject) => {
    if (ERC20Addr !== null) {
      if (erc20Decimals[ERC20Addr] === undefined) {
        // Save the contract as an object
        provider.call({ to: ERC20Addr, data: config.erc20.decimals() })
        .then((decimals) => {
          erc20Decimals[ERC20Addr] = parseInt(decimals);
          // Get the balance
          return provider.call({ to: ERC20Addr, data: config.erc20.balanceOf(addr) })
        })
        .then((balance) => { return resolve(parseInt(balance) / 10 ** erc20Decimals[ERC20Addr]); })
        .catch((err) => { return reject(err); });
      } else {
        // If the decimals are cached, we can just query the balance
        provider.call({ to: ERC20Addr, data: config.erc20.balanceOf(addr) })
        .then((balance) => { return resolve(parseInt(balance) / 10 ** erc20Decimals[ERC20Addr]); })
        .catch((err) => { return reject(err); });
      }
    } else {
      console.log('here', addr)
      // Otherwise query for the ETH balance
      provider.getBalance(addr)
      .then((balance) => { return resolve(parseInt(balance) / 10 ** 18); })
      .catch((err) => { return reject(err); })
    }
  })
}

// Get a history of ERC20 transfers to and from an account
// @param [addr]         {string}  - The account we are looking up
// @param [contractAddr] {string}  - Address of the deployed ERC20 contract
exports.getERC20TransferHistory = function(user, contractAddr) {
  return new Promise((resolve, reject) => {
    let events = {}
    // Get transfer "out" events
    _getEvents(contractAddr, [ null, `0x${pad64(user)}`, null ])
    .then((outEvents) => {
      events.out = outEvents;
      return _getEvents(contractAddr, [ null, null, `0x${pad64(user)}` ])
    })
    .then((inEvents) => {
      events.in = inEvents;
      return resolve(_parseTransferLogs(events, 'ERC20', erc20Decimals[contractAddr]));
    })
    .catch((err) => { return reject(err); })
  });
}

// Get the nonce (i.e. the number of transactions an account has sent)
// @param [addr]    {string}  - The account we are looking up
exports.getNonce = function(user) {
  return new Promise((resolve, reject) => {
    provider.getTransactionCount(user)
    .then((nonce) => { return resolve(nonce); })
    .catch((err) => { return reject(err); })
  });
}

// Build an Ethereum transaction object
// @returns {array}  - array of form [ nonce, gasPrice, gas, to, value, data ]
exports.buildTx = function(from, to, value, opts={}) {
  return new Promise((resolve, reject) => {
    if (typeof from !== 'string') {
      return reject('Please specify a single address to transfer from');
    } else {
      exports.getNonce(from)
      .then((nonce) => {
        let tx = [ nonce, null, null, to, null, null ];
        // Fill in `value` and `data` if this is an ERC20 transfer
        if (opts.ERC20Token !== undefined) {
          tx[5] = config.erc20.transfer(to, value);
          tx[4] = 0;
          tx[3] = opts.ERC20Token;
          tx[2] = 100000; // gas=100,000 to be safe
        } else {
          tx[5] = '';
          tx[4] = value;
          tx[2] = 22000; // gas=22000 for ETH transfers
        }
        // Check for a specified gas price (should be in decimal)
        if (opts.gasPrice !== undefined) {
          tx[1] = opts.gasPrice;
        } else {
          tx[1] = config.defaults.gasPrice;
        }
        return resolve(tx);
      })
      .catch((err) => {
        return reject(err);
      });
    }
  });
}

exports.broadcast = function(system, tx) {
  switch (system) {
    case 'ETH':
      break;
    default:
      break;
  }
}

// Get a set of event logs
function _getEvents(address, topics, fromBlock=0, toBlock='latest') {
  return new Promise((resolve, reject) => {
    provider.getLogs({ address, topics, fromBlock, toBlock })
    .then((events) => { return resolve(events); })
    .catch((err) => { return reject(err); })
  });
}

function _parseTransferLogs(logs, type, decimals=0) {
  let newLogs = { in: [], out: [] };
  logs.out.forEach((log) => {
    newLogs.out.push(_parseLog(log, type, decimals));
  });
  logs.in.forEach((log) => {
    newLogs.in.push(_parseLog(log, type, decimals));
  });
  return newLogs;
}

function _parseLog(log, type, decimals=0) {
  switch (type) {
    case 'ERC20':
      return {
        transactionHash: log.transactionHash,
        contract: log.address,
        from: `0x${unpad(log.topics[1])}`,
        to: `0x${unpad(log.topics[2])}`,
        value: parseInt(log.data) / (10 ** decimals),
      };
      break;
    default:
      return {};
      break;
  }
}