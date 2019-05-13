const { BigNumber } = require('bignumber.js');
const { EtherscanApi, JsonRpcApi } = require('./apis');

class Ethereum {
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
      return cb(null, txHash);
    })
    .catch((err) => {
      return cb(err);
    })
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

  getStatefulParams(opts, cb) {
    // Get the nonce
    if (opts.sender) {
      if (Array.isArray(opts)) opts.sender = opts.sender[0];
      this.getNonce(opts.sender)
      .then((nonce) => {
        opts.params[0] = nonce;   // Nonce is in the first position
        return cb(null, opts);
      })
      .catch((err) => {
        return cb(err);
      });
    } else {
      return cb(null, opts);
    }
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

  getTx(hashes, cb, opts={}, filled=[]) {
    if (typeof hashes === 'string') {
      return this._getTx(hashes, cb);
    } else if (hashes.length === 0) {
      return cb(null, filled);
    } else {
      const hash = hashes.shift();
      return this._getTx(hash, (err, tx) => {
        if (err) return cb(err);
        if (tx) filled.push(tx);
        return this.getTx(hashes, cb, opts, filled);
      });
    }
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
        timestamp: txRaw.timestamp || new Date().getTime() / 1000,
        value: this._getValue(txRaw),
        fee: this._getFee(txRaw),
        in: 0,  // For now, we can assume any transactions are outgoing. TODO: figure a way to get incoming txs
        data: txRaw,
      }
      return cb(null, this._postProcessTx(tx)); 
    })
    .catch((err) => { return cb(err); })
  }

  _postProcessTx(tx) {
    const d = tx.data.data;
    switch(d.slice(0, 10)) {
      case '0xa9059cbb':
        // ERC20
        tx.to = `0x${d.slice(34, 74)}`;
        tx.value = parseInt(`0x${d.slice(74)}`, 16);
        tx.contractAddress = tx.data.to;
        break;
      default:
        break;
    }
    return tx;
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

module.exports = Ethereum;