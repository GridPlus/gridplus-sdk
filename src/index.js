import config from './config';
import Bitcoin from './providers/Bitcoin';
import debug from 'debug';
import Ethereum from './providers/Ethereum';
import AgentRestClient from './rest/client';
import { parseSigResponse } from './util';
export const providers = {
  Bitcoin,
  Ethereum,
};
const tokenList = require('../tokensByAddress.json')
const log = debug('gridplus-sdk');

export default class SdkClient {

  constructor(options) {
    options = options || {};

    options.clientConfig = options.clientConfig || {};
    options.clientConfig.baseUrl = options.clientConfig.baseUrl || config.api.baseUrl;
    options.clientConfig.name = options.clientConfig.name || 'gridplus-sdk';
    options.clientConfig.privKey = options.clientConfig.privKey;

    if ( ! options.clientConfig.crypto) {
      throw new Error('options.clientConfig.crypto provider must be specified');
    }

    if ( ! options.clientConfig.privKey || options.clientConfig.privKey.length !== 64 || typeof options.clientConfig.privKey !== 'string') {
      throw new Error('options.clientConfig.privKey must be provided as a 32 byte hex string')
    }

    this.client = new AgentRestClient(options.clientConfig);

    this.providers = {};

    (options.providers || []).map((provider) => {
      this.providers[provider.shortcode] = provider;
    });

    log(`gridplus sdk created with providers [${Object.keys(this.providers)}]`);

  }

  addresses(param, cb) {
    return this.client.pairedRequest('addresses', { param }, cb);
  }

  addManualPermission(cb) {
    return this.client.pairedRequest('addManualPermission', { }, cb);
  }

  addPermission(param, cb) {
    return this.client.pairedRequest('addPermission', { param }, cb);
  }

  /*
    connects to all configured network providers, returning the first of any encountered errors.
    else continues via supplied callback when done.
  */
  connect(serial, cb) {
    if (typeof serial === 'function') {
      cb = serial;
      serial = null;
    }
    return this.client.request('connect', cb);
  }

  initialize(options, cb) {
    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    let shortcodes = [];

    if ( ! options.shortcodes && options.shortcode) {
      shortcodes = [ options.shortcode ];
    }
    else if (options.shortcodes) {
      shortcodes = options.shortcodes;
    } else {
      shortcodes = Object.keys(this.providers);
    }

    if ( ! shortcodes.length) return cb(new Error('cannot initialize sdk. no providers specified'));

    const promises = shortcodes.map(shortcode => {
      return new Promise((resolve, reject) => {

        const provider = this.providers[shortcode];

        if ( ! provider) return reject(new Error(`no provider found with shortcode ${shortcode}`));

        log(`initializing provider ${shortcode}`);

        provider.initialize((err, info) => {
          if (err) return reject(err);

          this.providers[shortcode] = provider;

          log(`initialized provider ${shortcode}`);
          resolve(info);
        });

      });
    });

    return Promise.all(promises).then((info) => {
      return cb(null, info);
    }).catch(err => cb(err));
  }
  // appSecret
  pair(appSecret, cb) {
    return this.client.pair(appSecret, cb);
  }

  deletePairing(cb) {
    return this.client.pairedRequest('deletePairing', {}, cb);
  }

  signAutomated(param, cb) {
    return this.client.pairedRequest('signAutomated', { param }, cb);
  }

  signManual(param, cb) {
    return this.client.pairedRequest('signManual', { param }, (err, res) => {
      if (err) return cb(err);
      const data = parseSigResponse(res);
      res.data = data;
      cb(null, res);
    });
  }

  // Get a balance for an account.
  // @param [shortcode]  {string}  - "ETH", "ERC20", or "BTC"
  // @param [addr]      {string}  - The account we are querying
  // @param [ERC20Addr] {string}  - (optional) Address of the ERC20 token we are asking about
  // @callback                    - err (Error), data (object)
  getBalance(shortcode, options, cb) {
    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    if (! this.providers[shortcode]) {
      return cb(new Error(`no provider loaded for shortcode ${shortcode}`));
    }

    return this.providers[shortcode].getBalance(options, cb);
  }

  getTokenBalance(options, cb) {
    if (!this.providers['ETH']) {
      return cb(new Error('Cannot request token balance. ETH provider is not set.'))
    }

    return this.providers['ETH'].getTokenBalance(options, cb);
  }

  getTxHistory(shortcode, options, cb) {
    if (! this.providers[shortcode]) {
      return cb(new Error(`no provider loaded for shortcode ${shortcode}`));
    }
    return this.providers[shortcode].getTxHistory(options, cb);
  }

  // Get (one or more) transaction(s) and return (one or more) object(s) that conform to a common schema across currencies
  getTx(shortcode, hashes, opts, cb) {
    if (! this.providers[shortcode]) {
      return cb(new Error(`no provider loaded for shortcode ${shortcode}`));
    }
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    return this.providers[shortcode].getTx(hashes, cb, opts);
  }

  // Broadcast a transaction and return the result of the mempool
  broadcast(shortcode, payload, cb) {
    if (! this.providers[shortcode]) {
      return cb(new Error(`no provider loaded for shortcode ${shortcode}`));
    }

    return this.providers[shortcode].broadcast(payload, cb);
  }

  // Build a transaction
  // @param [shortcode]  {string}          - "ETH" or "BTC"
  // @param [to]      {string}          - Receiving address
  // @param [from]    {string | array}  - Sending address (or addresses for BTC)
  // @param [value]   {number}          - number of tokens to send in the tx
  // @param [opts]    {Object}          - (optional) parameterization options, including ERC20 address
  // @callback                          - err (Error), data (object)
  buildTx(shortcode, opts={}, cb) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }

    if (! this.providers[shortcode]) {
      return cb(new Error(`no provider loaded for shortcode ${shortcode}`));
    }
    // return this.providers[shortcode].buildTx(from, to, value, opts, cb);
    return this.providers[shortcode].buildTx(opts, cb);
  }

}

export const Client = SdkClient;
export const tokens = require('../tokensBySymbol.json');
export const tokensBySymbol = require('../tokensBySymbol.json');
export const tokensByAddress = require('../tokensByAddress.json');
