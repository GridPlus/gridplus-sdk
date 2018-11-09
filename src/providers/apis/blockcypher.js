// Blockcypher API
import { blockcypherApiKey } from '../../config';
const request = require('superagent');

export default class BlockCypherApi {

  constructor(opts={}) {
    this.network = this.getNetwork(opts.network);
    this.coin = this.getCoin(this.network);
    this.blockcypherBaseUrl = `https://api.blockcypher.com/v1/${this.coin}/${this.network}`;
    this.timeout = opts.timeout ? opts.timeout : 0; // Timeout between requests to avoid getting 429s from blockcypher
    this.sat = opts.sat ? opts.sat : false;
  }

  getNetwork(code) {
    switch (code) {
      case 'testnet':
        return 'test3';
      case 'bcy':
        return 'test';
      case 'bitcoin':
        return 'main';
      case 'regtest':
        return 'regtest';
      default:
        return 'main';
    }
  }

  getCoin(network) {
    switch (network) {
      case 'test':
        return 'bcy';
      default:
        return 'btc';
    }
  }

  initialize(cb) {
    return this._request(this.blockcypherBaseUrl)
    .then((res) => { return cb(null, res); })
    .catch((err) => cb(err));
  }

  buildInputs(utxos, cb) {

  }

  broadcast({tx:rawTx}, cb) {
    const url = `${this.blockcypherBaseUrl}/txs/push?token=${blockcypherApiKey}`;
    return this._request(url, { tx: rawTx })
      .then((res) => { return cb(null, this._filterBroadcastedTx(res)); })
      .catch((err) => { return cb(err); })
  }

  getBalance({ address }, cb, accounts=[]) {
    const allAddresses = typeof address === 'string' ? [ address ] : JSON.parse(JSON.stringify(address));
    if (allAddresses.length === 0) {
      let totalBalance = 0;
      accounts.forEach((a) => { totalBalance += a.balance; })
      const data = {
        balance: totalBalance,
        utxos: this._sortByHeight(this._filterUtxos(accounts, address))
      };
      return cb(null, data);
    } else {
      const a = allAddresses.shift();
      const url = `${this.blockcypherBaseUrl}/addrs/${a}?unspentOnly=true`;
      return this._request(url)
      .then((account) => {
        accounts.push(account);
        return this.getBalance({ address: allAddresses }, cb, accounts)
      })
      .catch((err) => { return cb(err); })
    }
  }

  getTxHistory({ address }, cb, txs=[], usedAddresses=[]) {
    const allAddresses = typeof address === 'string' ? [ address ] : JSON.parse(JSON.stringify(address));
    if (allAddresses.length === 0) {
     const filteredTxs = this._filterTxs(txs, usedAddresses);
     return cb(null, this._sortByHeight(filteredTxs)); 
    } else {
      const a = allAddresses.shift();
      const url = `${this.blockcypherBaseUrl}/addrs/${a}/full`;
      return this._request(url)
        .then((res) => {
          res.txs.forEach((t) => { txs.push(t); })
          usedAddresses.push(a);
          return this.getTxHistory({ address: allAddresses }, cb, txs, usedAddresses);
        })
        .catch((err) => { return cb(err); })
    }
  }

  getTx(hashes, cb, opts={}) {
    if (typeof hashes === 'string') hashes = [ hashes ];
    const url = `${this.blockcypherBaseUrl}/txs/${hashes.join(';')}`;
    return this._request(url)
      .then((txs) => { return cb(null, this._filterTxs(txs, opts.addresses || [])); })
      .catch((err) => { return cb(err); })
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
    const oldTxs = (txs && txs.length !== undefined) ? txs : [ txs ];
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