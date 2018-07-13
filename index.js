const crypto = require('crypto');
const EC = require('elliptic').ec;
const EC_K = new EC('secp256k1');
const request = require('superagent');
const config = require('./config.js');
const bitcoin = require('./src/blockchain/bitcoin.js');
const ethereum = require('./src/blockchain/ethereum.js');
const util = require('./src/util.js');
const RestClient = require('./src/rest/restClient.js').default;
const DEFAULT_COUNTER = 5;

class GridPlusSDK extends RestClient{
  //============================================================================
  // SETUP OBJECT
  //============================================================================
  constructor({ url = config.api.baseUrl, name = 'app-0', privKey = crypto.randomBytes(32),  } = {}) {
    super({ baseUrl: url, privKey });
    // Create a keypair either with existing entropy or system-based randomness
    // this._initKeyPair(opts);
    this.headerSecret = null;
    this.name = name
    // If an ETH provider is included in opts, connect to the provider automatically
    // if (opts.ethProvider !== undefined) this.connectToEth(opts.ethProvider);
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
  // @callback        err (Error), info (object) 
  connectToBtc(options={}, cb) {
    if (typeof options === 'function') {
      cb = options;
      options = {};
    }
    bitcoin.initBitcoin(options, cb)
  }

  // Get the web3 connection for advanced functionality
  getProvider() {
    return ethereum.getProvider();
  }

  // Get a balance for an account.
  // @param [currency]  {string}  - "ETH", "ERC20", or "BTC"
  // @param [addr]      {string}  - The account we are querying
  // @param [ERC20Addr] {string}  - (optional) Address of the ERC20 token we are asking about
  // @callback                    - err (Error), data (object)
  getBalance(currency, addr, ERC20Addr=null, cb) {
    if (typeof ERC20Addr === 'function') {
      cb = ERC20Addr;
      ERC20Addr = null;
    }
    if (currency === 'BTC') {
      bitcoin.getBalance(addr, cb)
    } else if (currency === 'ETH' || (currency === 'ERC20' && typeof ERC20Addr === 'string')) {
      ethereum.getBalance(addr, ERC20Addr, cb);
    } else {
      cb('Unsupported currency specified or params not formatted properly')
    }
  }

  // Build a transaction
  // @param [system]  {string}          - "ETH" or "BTC"
  // @param [to]      {string}          - Receiving address
  // @param [from]    {string | array}  - Sending address (or addresses for BTC)
  // @param [value]   {number}          - number of tokens to send in the tx
  // @param [opts]    {Object}          - (optional) parameterization options, including ERC20 address
  // @callback                          - err (Error), data (object)
  buildTx(system, from, to, value, opts={}, cb) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = {}
    }
    if (system = 'ETH') {
      ethereum.buildTx(from, to, value, opts, cb);
    }
  }
  
}

exports.default = GridPlusSDK;