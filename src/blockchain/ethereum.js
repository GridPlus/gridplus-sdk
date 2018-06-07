// Integrations to query the Ethereum blockchain for relevant account data
const config = require(`${__dirname}/../config.js`);
const Web3 = require('web3');
let erc20Decimals = {};
let web3;

// Instantiate the Ethereum query service. In this case, it is a web3 instance.
exports.initEth = function(_provider=config.defaultWeb3Provider) {
  let provider;
  // Set the provider engine with a specified provider
  if (_provider.substr(0, 2) === 'ws') {
    // Websocket providers are preferred, but not all nodes will be able
    // to utilize them.
    try {
      provider = new Web3.providers.WebsocketProvider(_provider);
    } catch (err) {
      return new Error(err);
    }
  } else if (_provider.substr(0, 4) === 'http') {
    // Use http if the user specifies. Note that this is not ideal because polling
    // can take lots of bandwidth
    try {
      provider = new Web3.providers.HttpProvider(_provider);
    } catch (err) {
      return new Error(err);
    }
  }
  // With the provider started, initialize the web3 object
  try {
    web3 = new Web3(provider);
    return null;
  } catch (err) {
    return new Error(err);
  }
}

// Expose the web3 interface for advanced functionality
exports.web3 = function() { return web3; }

// Get the balance of an Ethereum account. This can be an ERC20 or ETH balance.
// @param [addr]      {string}  - The account we are querying
// @param [ERC20Addr] {string}  - Address of the ERC20 token we are asking about
// @returns           {Promise} - Contains the balance in full units (i.e. with decimals divided in)
exports.getBalance = function(addr, ERC20Addr=null) {
  return new Promise((resolve, reject) => {
    if (ERC20Addr !== null) {
      if (erc20Decimals[ERC20Addr] === undefined) {
        // Cache the number of decimals for the token if it is not already saved.
        // This will make future balance requests more efficient.
        web3.eth.call({ to: ERC20Addr, data: config.erc20.decimals() })
        .then((decimals) => {
          erc20Decimals[ERC20Addr] = parseInt(decimals);
          // Get the balance
          console.log('thing', config.erc20.balanceOf(addr));
          return web3.eth.call({ to: ERC20Addr, data: config.erc20.balanceOf(addr) })
        })
        .then((balance) => { console.log('got balance', balance); return resolve(parseInt(balance) / 10 ** erc20Decimals[ERC20Addr]); })
        .catch((err) => { return reject(err); });
      } else {
        // If the decimals are cached, we can just query the balance
        web3.eth.call({ to: ERC20Addr, data: config.erc20.balanceOf(addr) })
        .then((balance) => { return resolve(parseInt(balance) / 10 ** erc20Decimals[ERC20Addr]); })
        .catch((err) => { return reject(err); });
      }
    } else {
      // Otherwise query for the ETH balance
      web3.eth.getBalance(addr)
      .then((balance) => { return resolve(parseInt(balance) / 10 ** 18); })
      .catch((err) => { return reject(err); })
    }
  })
}