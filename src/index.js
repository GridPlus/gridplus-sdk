import crypto from 'crypto';
import config from './config';
import bitcoin from './blockchain/bitcoin';
import ethereum from './blockchain/ethereum';
import AgentRestClient from './rest/client';

export default class GridPlusSDK {
  //============================================================================
  // SETUP OBJECT
  //============================================================================
  constructor(options) {
    options = options || {};

    options.clientConfig = options.clientConfig || {}
    options.clientConfig.baseUrl = options.clientConfig.baseUrl || config.api.baseUrl;
    options.clientConfig.name = options.clientConfig.name || 'gridplus-sdk';
    options.clientConfig.privKey = options.clientConfig.privKey || crypto.randomBytes(32);

    this.client = new AgentRestClient(options.clientConfig)
    // Create a keypair either with existing entropy or system-based randomness
    // this._initKeyPair(opts);
    // this.headerSecret = null;
    this.providers = {
      bitcoin: null,
      ethereum: null,
    }
  }

  addresses(param, cb) {
    const type = 'addresses';
    return this.client.pairedRequest('addresses', { param, type }, cb);
  }

  addManualPermission(cb) {
    const type = 'addManualPermission';
    return this.client.pairedRequest('addManualPermission', { type }, cb);
  }

  addPermission(param, cb) {
    const type = 'addPermission';
    return this.client.pairedRequest('addPermission', { param, type }, cb);
  }

  /*
    connects to all configured network providers, returning the first of any encountered errors.
    else continues via supplied callback when done.
  */
  connect(cb) {
    return this.client.request('connect', cb);
  }

  pair(name, cb) {
    return this.client.pair(name, cb);
  }

  signAutomated(param, cb) {
    const type = 'signAutomated';
    return this.client.pairedRequest('signAutomated', { param, type }, cb);
  }

  signManual(param, cb) {
    const type = 'signManual';
    return this.client.pairedRequest('signManual', { param, type }, cb);
  }

  setupPairing(cb) {
    return this.client.setupPairing(cb);
  }

  //============================================================================
  // FUNCTIONALITY TO INTERACT WITH VARIOUS BLOCKCHAINS
  // We need to query both Bitcoin and Ethereum blockchains to get relevent
  // account data. This means connecting to nodes
  //============================================================================

  // Initialize a connection to an Ethereum node.
  // @param [provider] {string} - of form `${protocol}://${host}:${port}`, where `protocol` is 'ws' or 'http'
  // @returns          {Error}  - may be null
  connectToEth(provider=null, cb) {
    if (typeof provider === 'function') {
      cb = provider;
      provider = null;
    }
    if (provider === null) {
      ethereum.initEth(null, (err, provider) => {
        if (err) {
          cb(err)
        } else {
          this.providers.ethereum = provider;
          cb(null, provider);
        }
      });
    } else {
      ethereum.initEth(provider, (err, provider) => {
        if (err) {
          cb(err);
        } else {
          this.providers.ethereum = provider;
          cb(null, provider);
        }
      });
    }
  }

  // Initialize a connection to Bitcoin node.
  // @param [options] {object}
  // @callback        err (Error), info (object)
  connectToBtc(options={}, cb) {
    if (typeof options === 'function') {
      cb = options;
      options = {};
    }
    bitcoin.initBitcoin(options, (err, client, info) => {
      if (err) {
        cb(err);
      } else {
        this.providers.bitcoin = client;
        cb(null, info);
      }
    })
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
      bitcoin.getBalance(this.providers.bitcoin, addr, cb)
    } else if (currency === 'ETH' || (currency === 'ERC20' && typeof ERC20Addr === 'string')) {
      ethereum.getBalance(this.providers.ethereum, addr, ERC20Addr, cb);
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
    if (system === 'ETH') {
      ethereum.buildTx(this.providers.ethereum, from, to, value, opts, cb);
    }
  }

}

exports.default = GridPlusSDK;
