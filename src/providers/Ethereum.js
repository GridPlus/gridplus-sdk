import config from '../config.js';
import { BigNumber } from 'bignumber.js';
import { EtherscanApi, JsonRpcApi } from './apis'
const schemaCodes = require('../permissions/codes.json').code;

export default class Ethereum {
  constructor (opts) {
    this.name = 'ethereum';
    this.shortcode = 'ETH';
    if (opts && opts.etherscan === true) {
      this.etherscan = true;
      this.provider = new EtherscanApi(opts);
    } else {
      this.etherscan = false;
      this.network = null;
      this.provider = new JsonRpcApi(opts);
    }
  }

  broadcast (data, cb) {
    this.provider.sendTransaction(data.tx)
    .then((txHash) => {
      this._getTx(txHash, (err, tx) => {
        if (err) return cb(err);
        tx.timestamp = new Date().getTime() / 1000;
        tx.in = 0;
        return cb(null, tx);
      });
    })
    .catch((err) => { 
      return cb(err);
    })
  }

  buildTx ({ from, to, value, ERC20Token=undefined, gasPrice=undefined }, cb) {
    if (typeof from !== 'string') {
      cb('Please specify a single address to transfer from');
    } else {
      this.getNonce(from)
        .then((nonce) => {
          const tx = [ nonce, null, null, to, null, null ];
          // Fill in `value` and `data` if this is an ERC20 transfer
          if (ERC20Token !== undefined) {
            tx[5] = config.erc20.transfer(to, value);
            tx[4] = 0;
            tx[3] = ERC20Token;
            tx[2] = 100000; // gas=100,000 to be safe
          } else {
            tx[5] = '';
            tx[4] = value;
            tx[2] = 22000; // gas=22000 for ETH transfers
          }
          // Check for a specified gas price (should be in decimal)
          if (gasPrice !== undefined) {
            tx[1] = gasPrice;
          } else {
            tx[1] = config.defaults.gasPrice;
          }
          const code = ERC20Token === undefined ? 'ETH' : 'ETH-ERC20';
          const txObj = {
            schemaIndex: schemaCodes[code].schema,
            typeIndex: schemaCodes[code].type,
            params: tx,
          }
          cb(null, txObj);
        })
        .catch((err) => {
          cb(err);
        });
    }
  }

  getBalance ({ address }, cb) {
    const data = {
      balance: 0,
      transfers: {}
    };
    // Otherwise query for the ETH balance
    this.provider.getBalance(address)
    .then((balance) => {
      data.balance = parseInt(balance);
      return this.getNonce(address)
    })
    .then((nonce) => {
      data.nonce = parseInt(nonce);
      cb(null, data);
    })
    .catch((err) => { cb(err); })
  }

  getTokenBalance(options, cb) {
    const { address } = options;
    const tokens = options.tokens ? options.tokens : options.token;
    this.provider.getTokenBalance(address, tokens)
    .then((balances) => { return cb(null, balances); })
    .catch((err) => { return cb(err); })
  }

  getNonce(user) {
    return new Promise((resolve, reject) => {
      this.provider.getTransactionCount(user)
      .then((nonce) => { return resolve(nonce); })
      .catch((err) => { return reject(err); })
    });
  }

  getTx(hashes, cb, filled=[]) {
    if (typeof hashes === 'string') {
      return this._getTx(hashes, cb);
    } else if (hashes.length === 0) {
      return cb(null, filled);
    } else {
      const hash = hashes.shift();
      return this._getTx(hash, (err, tx) => {
        if (err) return cb(err);
        if (tx) filled.push(tx);
        return this.getTx(hashes, cb, filled);
      });
    }
  }

  initialize (cb) {
    return cb(null, this.provider);
  }

  getTxHistory(opts, cb) {
    this.provider.getTxHistory(opts)
    .then((history) => { return cb(null, history); })
    .catch((err) => { return cb(err); })
  }

  _getTx(hash, cb) {
    let tx;
    return this.provider.getTransaction(hash)
    .then((txRaw) => {
      if (!txRaw) return cb(null, null);
      tx = {
        currency: 'ETH',
        hash: txRaw.hash,
        height: txRaw.blockNumber || -1,
        from: txRaw.from,
        to: txRaw.to,
        value: this._getValue(txRaw),
        fee: this._getFee(txRaw),
        in: 0,  // For now, we can assume any transactions are outgoing. TODO: figure a way to get incoming txs
        data: txRaw,
      }
      return cb(null, tx); 
    })
    .catch((err) => { return cb(err); })
  }

  _getValue(tx) {
    if (tx.value.toString() !== '0') {
      const factor = BigNumber('-1e18');
      const value = BigNumber(tx.value.toString());
      return value.div(factor).toString();
    } else {
      return 0;
    }
  }

  _getFee(tx) {
    const factor = BigNumber('-1e18');
    const weiFee = new BigNumber(tx.gasPrice.mul(tx.gasLimit).toString());
    return weiFee.div(factor).toString();
  }

}