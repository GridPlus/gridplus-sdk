// Blockcypher API
import { httpReq } from '../../util';
import { blockcypherApiKey } from '../../config';
export default class BlockCypherApi {

  constructor(opts) {
    this.network = opts.network ? opts.network : 'main';
    this.blockcypherBaseUrl = `https://api.blockcypher.com/v1/btc/${this.network}`;
  }

  broadcast(rawTx, cb) {
    const url = `${this.blockcypherBaseUrl}/txs/push?token=${blockcypherApiKey}`;
    return httpReq(url, JSON.stringify({ tx: rawTx }))
    .then((res) => { console.log('\n\ngot broadcast res', res, '\n\n'); return cb(null, this._filterBroadcastedTx(res)) })
    .catch((err) => { return cb(err); })
  }

  getBalance({ address, sat }, cb) {
    return this._getBalanceAndTransactions({ address, sat }, cb);
  }

  getTxHistory({ address }, cb) {
    return this._getBalanceAndTransactions({ address, txsOnly: true }, cb);
  }

  _getBalanceAndTransactions({ address, sat=true, txsOnly=false }, cb) {
    if (typeof address === 'string') {
      const url = `${this.blockcypherBaseUrl}/addrs/${address}/full`;
      return httpReq(url)
      .then((res) => { 
        if (txsOnly) {
          return cb(null, this._sortByHeight(this._filterTxs(res.txs, address)));
        } else {
          const toReturn = {
            balance: this._getBalance(res.balance, sat),
            utxos: this._sortByHeight(this._filterUtxos(res.txs, address)),
          };
          return cb(null, toReturn); 
        }
      })
      .catch((err) => { return cb(err); })
    } else {
      return httpReq(`${this.blockcypherBaseUrl}/addrs/${address.join(';')}/full`)
      .then((res) => {
        const toReturn = {};
        res.forEach((b) => {
          if (txsOnly) {
            // For the tx history
            toReturn[b.address] = this._sortByHeight(this._filterTxs(b.txs, b.address))
          } else {
            // For the balance/utxos
            toReturn[b.address] = {
              balance: this._getBalance(b.balance, sat),
              utxos: this._sortByHeight(this._filterUtxos(b.txs, b.address)),
            }
          }
        })
        return cb(null, toReturn);
      })
      .catch((err) => { return cb(err);})
    }
  }

  _getBalance(balance, sat) {
    if (sat !== true) return balance / Math.pow(10, 8)
    else              return balance;
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
    const newTxs = [];
    const addresses = typeof address === 'string' ? [ address ] : address;
    txs.forEach((tx) => {
      tx.inputs.forEach((i) => {
        const inputAddress = i.addresses[0];
        const outputAddress = tx.outputs[0].addresses[0];
        if (addresses.indexOf(inputAddress) > -1) {
          const newTx = {
            to: outputAddress,
            from: inputAddress,
            fee: tx.fees,
            in: false,
            hash: tx.hash,
            currency: 'BTC',
            height: tx.block_height,
            timestamp: tx.confirmed ? tx.confirmed : tx.received,
            value: i.output_value,
            data: tx,
          };
          newTxs.push(newTx);
        }
      })
      tx.outputs.forEach((o) => {
        // Really not sure why output.addresses is an array. I don't know when you would
        // send an output with multiple recipients...
        const outputAddress = o.addresses[0];
        const inputAddress = tx.inputs[0].addresses[0];
        if (addresses.indexOf(outputAddress) > -1) {
          const newTx = {
            to: outputAddress,
            from: inputAddress,
            fee: tx.fees,
            in: true,
            hash: tx.hash,
            currency: 'BTC',
            height: tx.block_height,
            timestamp: tx.confirmed ? tx.confirmed : tx.received,
            value: o.value,
            data: tx,
          };
          newTxs.push(newTx);
        }
      })
    })
    return newTxs;
  }

  _filterBroadcastedTx(tx) {
    const sender = tx.inputs[0].addresses[0];
    let output;
    tx.outputs.forEach((o) => {
      if (o.addresses[0] === sender) output = o;
    })
    if (!output) return null;
    const parsedTx = {
      to: output.addresses[0],
      from: sender,
      fee: tx.fees,
      in: false,
      hash: tx.hash,
      currency: 'BTC',
      height: tx.block_height,
      timestamp: tx.confirmed ? tx.confirmed : tx.received,
      value: tx.inputs[0].output_value,
      data: tx,
    }
    return parsedTx;
  }

  _sortByHeight(txs) {
    return txs.sort((a, b) => { return a.height < b.height });
  }

}