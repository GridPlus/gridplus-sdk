// Blockcypher API
import { blockcypherApiKey } from '../../config';
const request = require('superagent');

export default class BlockCypherApi {

  constructor(opts) {
    this.network = opts.network ? opts.network : 'main';
    this.coin = opts.coin ? opts.coin : 'btc';
    this.blockcypherBaseUrl = `https://api.blockcypher.com/v1/${this.coin}/${this.network}`;
    this.timeout = opts.timeout ? opts.timeout : 0; // Timeout between requests to avoid getting 429s from blockcypher
    this.sat = opts.sat ? opts.sat : false;
  }

  getExplorerUrl() {
    const prefix = this.coin === 'bcy' ? 'bcy' : (this.coin === 'btc' && this.network === 'test3') ? 'btc-testnet' : 'btc';
    return `https://live.blockcypher.com/${prefix}`;
  }

  initialize(cb) {
    return this._request(this.blockcypherBaseUrl)
    .then((res) => { return cb(null, res); })
    .catch((err) => cb(err));
  }

  broadcast(rawTx, cb) {
    const url = `${this.blockcypherBaseUrl}/txs/push?token=${blockcypherApiKey}`;
    return this._request(url, { tx: rawTx })
      .then((res) => { return cb(null, this._filterBroadcastedTx(res)); })
      .catch((err) => { return cb(err); })
  }

  getBalance({ address }, cb) {
    return this._getBalanceAndTransactions({ address }, cb);
  }

  getTxHistory({ address }, cb) {
    return this._getBalanceAndTransactions({ address, txsOnly: true }, cb);
  }

  getTxs(hashes, cb, addresses=[]) {
    if (typeof hashes === 'string') hashes = [ hashes ];
    const url = `${this.blockcypherBaseUrl}/txs/${hashes.join(';')}`;
    return this._request(url)
      .then((txs) => { return cb(null, this._filterTxs(txs, addresses)); })
      .catch((err) => { return cb(err); })
  }

  _getBalanceAndTransactions({ address, txsOnly=false }, cb) {
    if (typeof address === 'string') {
      const url = `${this.blockcypherBaseUrl}/addrs/${address}/full`;
      return this._request(url)
      .then((res) => { 
        if (txsOnly) {
          return cb(null, this._sortByHeight(this._filterTxs(res.txs, address)));
        } else {
          const toReturn = {
            // balance: this._getBitcoinValue(res.balance),
            balance: res.balance,   // TODO: Fix the inconsistencies between this and the fallback bcoin option. We should ideally return the BTC value (as opposed to satoshi)
            utxos: this._sortByHeight(this._filterUtxos(res.txs, address)),
          };
          return cb(null, toReturn); 
        }
      })
      .catch((err) => { return cb(err); })
    } else {
      return this._request(`${this.blockcypherBaseUrl}/addrs/${address.join(';')}/full`)
      .then((res) => {
        const toReturn = {};
        if (!Array.isArray(res)) res = [ res ];
        res.forEach((b) => {
          if (txsOnly) {
            // For the tx history
            toReturn[b.address] = this._sortByHeight(this._filterTxs(b.txs, b.address))
          } else {
            // For the balance/utxos
            toReturn[b.address] = {
              // balance: this._getBitcoinValue(b.balance),
              balance: b.balance,   // TODO: Fix the inconsistencies between this and the fallback bcoin option. We should ideally return the BTC value (as opposed to satoshi)            
              utxos: this._sortByHeight(this._filterUtxos(b.txs, b.address)),
            }
          }
        })
        return cb(null, toReturn);
      })
      .catch((err) => { return cb(err);})
    }
  }

  _getBitcoinValue(a) {
    if (this.sat !== true) return a / Math.pow(10, 8)
    else                   return a;
  }

  _filterUtxos(txs, address) {
    const addresses = typeof address === 'string' ? [ address ] : address;
    const filteredUtxos = [];
    txs.forEach((tx) => {
      tx.outputs.forEach((o, idx) => {
        const outputAddress = o.addresses[0];
        if (addresses.indexOf(outputAddress) > -1) {
          const utxo = {
            version: tx.ver,
            height: tx.block_height,
            value: o.value,
            script: o.script,
            address: outputAddress,
            coinbase: false,
            hash: tx.hash,
            index: idx,
          };
          filteredUtxos.push(utxo);
        }
      })
    })
    return filteredUtxos;
  }

  _filterTxs(txs, address) {
    const oldTxs = (txs.length !== undefined) ? txs : [ txs ];
    const newTxs = [];
    const addresses = typeof address === 'string' ? [ address ] : address;
    oldTxs.forEach((tx) => {
      tx.inputs.forEach((i) => {
        const inputAddress = i.addresses[0];
        const outputAddress = tx.outputs[0].addresses[0];
        if (addresses.indexOf(inputAddress) > -1) {
          newTxs.push(this._filterTx(tx, outputAddress, inputAddress, i.output_value));
        }
      })
      tx.outputs.forEach((o) => {
        // Really not sure why output.addresses is an array. I don't know when you would
        // send an output with multiple recipients...
        const outputAddress = o.addresses[0];
        const inputAddress = tx.inputs[0].addresses[0];
        if (addresses.indexOf(outputAddress) > -1) {
          newTxs.push(this._filterTx(tx, outputAddress, inputAddress, o.value, true));
        }
      })
    })
    if (txs.length !== undefined) return newTxs
    else                          return newTxs[0];
  }

  _filterBroadcastedTx(res) {
    const tx = res.tx ? res.tx : res;
    const sender = tx.inputs[0].addresses[0];
    let output;
    tx.outputs.forEach((o) => {
      if (!output && o.addresses[0] !== sender) output = o;
    })
    if (!output) return null;
    return this._filterTx(tx, output.addresses[0], sender);
  }

  _filterTx(tx, to, from, value, input=false) {
    const t = tx.confirmed ? tx.confirmed : tx.received;
    return {
      to,
      from,
      fee: this._getBitcoinValue(tx.fees),
      in: input,
      hash: tx.hash,
      currency: 'BTC',
      height: tx.block_height,
      timestamp: this._getUnixTimestamp(t),
      value: this._getBitcoinValue(value),
      data: tx,
    }
  }

  _getUnixTimestamp(t) {
    return new Date(t).getTime() / 1000;
  }

  _sortByHeight(txs) {
    return txs.sort((a, b) => { return a.height < b.height });
  }

  _request(url, body=null) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (body === null) {
          return request.get(url)
            .then((res) => { return resolve(res.body); })
            .catch((err) => { return reject(err); })
        } else {
          return request.post(url)
            .set('Content-Type', 'application/json')
            .send(JSON.stringify(body))
            .then((res) => { return resolve(res.body); })
            .catch((err) => { return reject(err); })
        }
        }, this.timeout);
    })
  }

}