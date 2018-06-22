const EC = require('elliptic').ec;
const EC_K = new EC('secp256k1');
const request = require('superagent');
const config = require('./config.js');
const bitcoin = require('./src/blockchain/bitcoin.js');
const ethereum = require('./src/blockchain/ethereum.js');

class GridPlusSDK {
  //============================================================================
  // SETUP OBJECT
  //============================================================================
  constructor(opts={}) {
    // Create a keypair either with existing entropy or system-based randomness
    this._initKeyPair(opts);
    this.headerKey = null;

    // If an ETH provider is included in opts, connect to the provider automatically
    if (opts.ethProvider !== undefined) this.connectToEth(opts.ethProvider);
  }

  //============================================================================
  // FUNCTIONALITY TO INTERACT WITH VARIOUS BLOCKCHAINS
  // We need to query both Bitcoin and Ethereum blockchains to get relevent
  // account data. This means connecting to nodes
  //============================================================================
  
  // Initialize a connection to an Ethereum node. 
  // @param [provider] {string} - of form `${protocol}://${host}:${port}`, where `protocol` is 'ws' or 'http'
  // @returns          {Error}  - may be null
  connectToEth(provider=null) {
    if (provider === null) return ethereum.initEth()
    else                   return ethereum.initEth(provider)
  }

  // Initialize a connection to Bitcoin node. 
  // @param [options] {object}
  // @returns         {Promise}
  connectToBtc(options={}) {
    return bitcoin.initBitcoin(options)
  }

  // Get the web3 connection for advanced functionality
  getProvider() {
    return ethereum.getProvider();
  }

  // Get a balance for an account. RETURNS A PROMISE!
  // @param [currency]  {string}  - "ETH", "ERC20", or "BTC"
  // @param [addr]      {string}  - The account we are querying
  // @param [ERC20Addr] {string}  - (optional) Address of the ERC20 token we are asking about
  // @returns           {Promise} - Contains the balance in full units (i.e. with decimals divided in)
  getBalance(currency, addr, ERC20Addr=null) {
    switch(currency) {
      case 'BTC':
        return bitcoin.getBalance(addr);
        break;
      case 'ETH': 
        return ethereum.getBalance(addr);
        break;
      case 'ERC20':
        return ethereum.getBalance(addr, ERC20Addr);
        break;
      default:
        return;
        break;
    }
  }

  // Get a history of transfers for the desired currency. RETURNS A PROMISE!
  // @param [currency]  {string}  - "ETH", "ERC20", or "BTC"
  // @param [addr]      {string}  - The account we are querying
  // @param [ERC20Addr] {string}  - (optional) Address of the ERC20 token we are asking about
  // @returns           {Promise} - Contains an object of form: { in: <Array> , out: <Array> }
  //                                See API documentation for schema of the nested arrays.
  getTransactionHistory(currency, user, ERC20Addr=null) {
    switch(currency) {
      case 'ETH':
        return []; // Todo, need to figure out a way to pull in simple transfers
        break;
      case 'ERC20':
        return ethereum.getERC20TransferHistory(user, ERC20Addr);
        break;
      default:
        return;
        break;
    }
  }

  // Get the number of transactions an address has made. This is needed for building ETH
  // transactions and may be useful for BTC as well
  // @param [system]  {string}  - "ETH" or "BTC"
  // @param [user]    {string}  - Account we are querying
  // @returns         {Promise} - Contains a number
  getTransactionCount(system, user) {
    switch (system) {
      case 'ETH':
        return ethereum.getNonce(user);
        break;
      default:
        return;
        break;
    }
  }

  //============================================================================
  // COMMS WITH AGENT
  //============================================================================

  // Initiate comms with a particular agent
  connect(id) {
    return new Promise((resolve, reject) => {
      const url = `${config.api.baseUrl}/headerKey`;
      request.post(url)
      .then((res) => {
        if (!res.body) return reject(`No body returned from ${url}`)
        else if (!res.body.headerKey) return reject(`Incorrect response body from ${url}`)
        else {
          this.headerKey = res.body.headerKey;
          return resolve(true);
        }
      })
      .catch((err) => {
        return reject(err);
      })
    })
  }

  // Create an EC keypair. Optionally, a passphrase may be provided as opts.entropy
  _initKeyPair(opts) {
    // Create the keypair
    if (opts.entropy === undefined) {
      this.key = EC_K.genKeyPair();
    } else {
      if (opts.entropy.length < 20) {
        console.log('WARNING: Passphrase should be at least 20 characters. Please consider using a longer one.');
        for (let i = 0; i < 20 - opts.entropy.length; i++) opts.entropy += 'x';
        this.key = EC_K.genKeyPair({ entropy: opts.entropy });
      }
    }
    // Add the public key
    this.key.pub = this.key.getPublic();
  }
}

exports.default = GridPlusSDK;
