import crypto from 'crypto';
import config from './config';
import bitcoin from './blockchain/bitcoin';
import ethereum from './blockchain/ethereum';
import RestClient from './rest/restClient';

export default class GridPlusSDK extends RestClient {
  //============================================================================
  // SETUP OBJECT
  //============================================================================
  constructor({ url = config.api.baseUrl, name = 'app-0', privKey = crypto.randomBytes(32),  } = {}) {
    super({ baseUrl: url, privKey });
    // Create a keypair either with existing entropy or system-based randomness
    // this._initKeyPair(opts);
    this.headerSecret = null;
    this.name = name;
    this.providers = {
      bitcoin: null,
      ethereum: null,
    }
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
