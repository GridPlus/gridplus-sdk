// Blockcypher API
import { getOutputScriptType } from '../../util';
const request = require('superagent');

export default class BlockCypherApi {

  constructor(opts={}) {
    this.network = this.getNetwork(opts.network);
    this.coin = this.getCoin(this.network);
    this.blockcypherBaseUrl = `https://api.blockcypher.com/v1/${this.coin}/${this.network}`;
    this.timeout = opts.timeout ? opts.timeout : 0; // Timeout between requests to avoid getting 429s from blockcypher
    this.sat = opts.sat ? opts.sat : false;
    if (!opts.apiKey) throw new Error('You must provide an `apiKey` argument to use Blockcypher provider');    
    this.apiKey = opts.apiKey;
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
    if (utxos.length === 0) {
      return cb(null, utxos);
    } else {
      let inputs = [];
      const hashes = [];
      utxos.forEach((utxo) => { hashes.push(utxo.hash); });
      this.getTx(hashes, (err, txs) => {
        if (!Array.isArray(txs)) txs = [ txs ];
        if (err) return cb(err);
        txs.forEach((tx, i) => {
          const u = utxos[i];
          const o = tx.outputs[u.index];
          const input = [ u.hash, u.index, getOutputScriptType(o.script), u.accountIndex, o.value ];
          inputs = inputs.concat(input);
        })

        return cb(null, inputs);
      })
    }
  }

  broadcast({tx:rawTx}, cb) {
    const url = `${this.blockcypherBaseUrl}/txs/push?token=${this.apiKey}`;
    return this._request(url, { tx: rawTx })
      .then((res) => { 
        if (!res || !res.tx || !res.tx.hash) return cb(`Could not properly broadcast transaction. Got response: ${JSON.stringify(res)}`)
        else                                 return cb(null, res.tx.hash )
      })
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
      .then((txs) => { return cb(null, this._filterTxs(txs, opts.addresses)); })
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

  _filterTxs(txs, address=[]) {
    if (!address || address.length === 0) {
      return txs;
    } else {
      const oldTxs = (txs && txs.length !== undefined) ? txs : [ txs ];
      const newTxs = [];
      const addresses = typeof address === 'string' ? [ address ] : address;

      oldTxs.forEach((tx) => {
        let value = 0;
        tx.inputs.forEach((i) => {
          if (addresses.indexOf(i.addresses[0]) > -1) {
            value -= i.output_value;
          }
        })
        tx.outputs.forEach((o) => {
          // Really not sure why output.addresses is an array. I don't know when you would
          // send an output with multiple recipients...
          if (addresses.indexOf(o.addresses[0]) > -1) {
            value += o.value;
          }
        })
        if (value < 0) value += tx.fees;
        else           value -= tx.fees;
        newTxs.push({
          to: tx.outputs[0].addresses[0],
          from: tx.inputs[0].addresses[0],
          fee: tx.fees / Math.pow(10, 8),
          in: value > 0 ? 1 :0,
          hash: tx.hash,
          currency: 'BTC',
          height: tx.block_height,
          timestamp: tx.confirmed ? this._getUnixTimestamp(tx.confirmed) : this._getUnixTimestamp(tx.received),
          value: value / Math.pow(10, 8),
          data: tx,
        });
      })
      if (txs.length !== undefined) return newTxs
      else                          return newTxs[0];
    }
  }

  // _filterBroadcastedTx(res) {
  //   const tx = res.tx ? res.tx : res;
  //   const sender = tx.inputs[0].addresses[0];
  //   if (tx.outputs.length < 1) return null;
  //   const output = tx.outputs[0];
  //   return this._filterTx(tx, output.addresses[0], sender, output.value);
  // }

  // _getInputValue(input, outputs, addresses) {
  //   let val = input.output_value;
  //   outputs.forEach((o) => {
  //     if (addresses.indexOf(o.addresses[0]) > -1) val -= o.value;
  //   })
  //   return val;
  // }

  // _filterTx(tx, to, from, value, input=false) {
  //   const allowed = (to !== from);
  //   if (allowed) {
  //     const t = tx.confirmed ? tx.confirmed : tx.received;
  //     return {
  //       to,
  //       from,
  //       fee: this._getBitcoinValue(tx.fees),
  //       in: input,
  //       hash: tx.hash,
  //       currency: 'BTC',
  //       height: tx.block_height,
  //       timestamp: this._getUnixTimestamp(t),
  //       value: this._getBitcoinValue(value),
  //       data: tx,
  //     }
  //   } else {
  //     return undefined;
  //   }
  // }

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