import config from './config';
import Bitcoin from './providers/Bitcoin';
import Debug from 'debug';
import Ethereum from './providers/Ethereum';
import node from './crypto/node';
import AgentRestClient from './rest/client';

export const providers = {
  Bitcoin,
  Ethereum,
};

export const crypto = {
  node,
}

const debug = Debug('gridplus-sdk');

export default class SdkClient {

  constructor(options) {
    options = options || {};

    options.clientConfig = options.clientConfig || {}
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
    })

    debug(`gridplus sdk created with providers [${Object.keys(this.providers)}]`);

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
  connect(cb) {
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

        debug(`initializing provider ${shortcode}`);

        provider.initialize((err, info) => {
          if (err) return reject(err);

          this.providers[shortcode] = provider;

          debug(`initialized provider ${shortcode}`);
          resolve(info);
        });

      });
    });

    return Promise.all(promises).then((info) => {
      return cb(null, info);
    }).catch(err => cb(err));
  }

  pair(name, cb) {
    return this.client.pair(name, cb);
  }

  signAutomated(param, cb) {
    return this.client.pairedRequest('signAutomated', { param }, cb);
  }

  signManual(param, cb) {
    return this.client.pairedRequest('signManual', { param }, cb);
  }

  setupPairing(cb) {
    return this.client.setupPairing(cb);
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

  // Build a transaction
  // @param [shortcode]  {string}          - "ETH" or "BTC"
  // @param [to]      {string}          - Receiving address
  // @param [from]    {string | array}  - Sending address (or addresses for BTC)
  // @param [value]   {number}          - number of tokens to send in the tx
  // @param [opts]    {Object}          - (optional) parameterization options, including ERC20 address
  // @callback                          - err (Error), data (object)
  buildTx(shortcode, from, to, value, opts={}, cb) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }

    if (! this.providers[shortcode]) {
      return cb(new Error(`no provider loaded for shortcode ${shortcode}`));
    }

    return this.providers[shortcode].buildTx(from, to, value, opts, cb);
  }

}

export const Client = SdkClient;