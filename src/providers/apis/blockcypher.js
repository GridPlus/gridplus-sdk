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
    const addressString = typeof address === 'string' ? address : address.join(';');
    const url = `${this.blockcypherBaseUrl}/addrs/${addressString}?unspentOnly=true`;
    return this._request(url)
      .then((account) => {
        const data = {
          balance: Array.isArray(account) ? account.reduce((a, b) => { return a.balance + b.balance}) : account.balance,
          utxos: this._sortByHeight(this._filterUtxos(account, address))
        }
        return cb(null, data);
      })
      .catch((err) => { return cb(err); })
  }

  getTxHistory({ address }, cb) {
    const addressString = typeof address === 'string' ? address : address.join(';');
    const url = `${this.blockcypherBaseUrl}/addrs/${addressString}/full`;
    return this._request(url)
      .then((res) => {
        return cb(null, this._sortByHeight(this._filterTxs(res.txs, address)));
      })
      .catch((err) => { return cb(err); })
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

  _filterUtxos(utxoSets) {
    const filteredUtxos = [];
    if (!Array.isArray(utxoSets)) utxoSets = [ utxoSets ];
    utxoSets.forEach((utxoSet) => {
      if (utxoSet.txrefs) {
        utxoSet.txrefs.forEach((utxo) => {
          filteredUtxos.push({
            version: null,
            height: utxo.block_height,
            value: utxo.value,
            script: null,
            address: utxoSet.address,
            coinbase: false,
            hash: utxo.tx_hash,
            index: utxo.tx_output_n,
          })
        })
      }
      if (utxoSet.unconfirmed_txrefs) {
        utxoSet.unconfirmed_txrefs.forEach((utxo) => {
          filteredUtxos.push({
            version: null,
              height: -1,
              value: utxo.value,
              script: null,
              address: utxoSet.address,
              coinbase: false,
              hash: utxo.tx_hash,
              index: utxo.tx_output_n,
          })
        })
      }
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
          const filteredTx = this._filterTx(tx, outputAddress, inputAddress, this._getInputValue(i, tx.outputs, addresses));
          if (filteredTx) newTxs.push(filteredTx);
        }
      })
      tx.outputs.forEach((o) => {
        // Really not sure why output.addresses is an array. I don't know when you would
        // send an output with multiple recipients...
        const outputAddress = o.addresses[0];
        const inputAddress = tx.inputs[0].addresses[0];
        if (addresses.indexOf(outputAddress) > -1) {
          const filteredTx = this._filterTx(tx, outputAddress, inputAddress, o.value, true);
          if (filteredTx) newTxs.push(filteredTx);
        }
      })
    })
    if (txs.length !== undefined) return newTxs
    else                          return newTxs[0];
  }

  _filterBroadcastedTx(res) {
    const tx = res.tx ? res.tx : res;
    const sender = tx.inputs[0].addresses[0];
    if (tx.outputs.length < 1) return null;
    const output = tx.outputs[0];
    return this._filterTx(tx, output.addresses[0], sender, output.value);
  }

  _getInputValue(input, outputs, addresses) {
    let val = input.output_value;
    outputs.forEach((o) => {
      if (addresses.indexOf(o.addresses[0]) > -1) val -= o.value;
    })
    return val;
  }

  _filterTx(tx, to, from, value, input=false) {
    const allowed = (to !== from);
    if (allowed) {
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
    } else {
      return undefined;
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