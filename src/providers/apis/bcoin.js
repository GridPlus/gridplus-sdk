// BCoin API
import { NodeClient } from '@gridplus/bclient';
import { getTxHash, sortByHeight } from '../../util';
const request = require('superagent');

export default class BcoinApi {

  constructor(opts) {
    this.client = new NodeClient(opts);
  }

  initialize(cb) {
    this.client.getInfo()
    .then((info) => {
      if (!info || !info.network) return cb(new Error('Could not connect to node'));
      return cb(null, info);
    })
    .catch((err) => cb(err))
  }

  addBalanceMultiple(utxos, sat=true) {
    const d = {};
    Object.keys(utxos).forEach((u) => {
      d[u] = this.addBalanceSingle(utxos[u], sat);
    });
    return d;
  }

  addBalanceSingle(utxos, sat=true) {
    let balance = 0;
    utxos.forEach((u) => {
      balance += u.value;
    });
    if (sat !== true) {
      balance /= Math.pow(10, 8);
    }
    return {
      utxos, balance
    };
  }
  
  broadcast(rawTx, cb) {
    const { tx } = txData;
    let { txHash, opts } = txData;
    if (!opts) opts = {};
    if (!txHash) txHash = getTxHash(tx);
    this.client.broadcast(tx)
    .then((success) => {
      if (!success.success) return cb('Could not broadcast transaction. Please try again later.');
      this.getTx(txHash, (err, newTx) => {
        if (err) return cb(err);
        return cb(null, newTx)
    }, opts)
    })
    .catch((err) => {
      return cb(err);
    })
  }

  getBalance({ address, sat }, cb, accounts=[]) {
    let balances;
    if (typeof address === 'string') {
      this.getUtxosSingleAddr(address)
      .then((utxos) => {
        balances = this.addBalanceSingle(utxos, sat);
        cb(null, balances);
      })
      .catch((err) => { cb(err); })
    } else {
      this.getUtxosMultipleAddrs(address)
      .then((utxos) => {
        balances = this.addBalanceMultiple(utxos);
        cb(null, balances);
      })
      .catch((err) => { cb(err); })
    }
  }
  
  _getTx(hash, cb, opts={}) {
    this.client.getTX(hash)
    .then((tx) => {
      if (!tx) return cb(null, null);
      const filtered = this._filterTxs(tx, opts);
      return cb(null, filtered);
    })
    .catch((err) => {
      return cb(err);
    })
  }
  
  getUtxosMultipleAddrs(addrs) {
    return new Promise((resolve, reject) => {
      const utxos = {}
      // Make sure there is a list for UTXOs of each address
      addrs.forEach((a) => {
        if (utxos[a] === undefined) utxos[a] = [];
      });
      this.client.getCoinsByAddresses(addrs)
      .then((bulkUtxos) => {
        if (bulkUtxos) {
          // Reconstruct data, indexed by address
          bulkUtxos.forEach((u) => {
            utxos[u.address].push(u);
          });
        }
        return resolve(utxos);
      })
      .catch((err) => {
        return reject(err);
      })
    })
  }
  
  getTxsSingleAddr(addr, addrs=[]) {
    return new Promise((resolve, reject) => {
      addrs.push(addr);
      this.client.getTXByAddress(addr)
      .then((txs) => {
        const sortedTxs = sortByHeight(txs);
        return resolve(sortedTxs);
        // return resolve(this._filterTxs(sortedTxs, addrs));
      })
      .catch((err) => {
        return reject(err);
      })
    })
  }
  
  getTxsMultipleAddrs(addrs) {
    return new Promise((resolve, reject) => {
      const txs = {}
      // Make sure there is a list for txs of each address
      addrs.forEach((a) => {
        if (txs[a] === undefined) txs[a] = [];
      });
      this.client.getTXByAddresses(addrs)
      .then((bulkTxs) => {
        // Reconstruct data, indexed by address
        bulkTxs.forEach((t) => {
          txs[t.inputs[0].coin.address].push(t);
        });
        // Sort the transactions for each address
        Object.keys(txs).forEach((a) => {
          txs[a] = sortByHeight(txs[a]);
        });
        return resolve(txs);
      })
      .catch((err) => {
        return reject(err);
      })
    })
  }
  
  getUtxosSingleAddr(addr) {
    return new Promise((resolve, reject) => {
      this.client.getCoinsByAddress(addr)
        .then((utxos) => {
          const sortedUtxos = sortByHeight(utxos);
          return resolve(sortedUtxos);
        })
        .catch((err) => {
          return reject(err);
        });
    });
  }

  getTxHistory({ address }, cb, txs=[], usedAddresses=[]) {
    if (typeof address === 'string') {
      this.client.getTXByAddress(address)
      .then((txs) => {
        const filteredTxs = this._filterTxs(txs, { addresses: address });
        return cb(null, filteredTxs);
      })
      .catch((err) => {
        return cb(err);
      })
    } else {
      this.client.getTXByAddresses(address)
      .then((txs) => {
        const filteredTxs = this._filterTxs(txs, { addresses: address });
        const txsToReturn = {};
        filteredTxs.forEach((tx) => {
          if (address.indexOf(tx.from) > -1) {
            if (txsToReturn[tx.from] === undefined) txsToReturn[tx.from] = [ tx ]
            else                                    txsToReturn[tx.from].push(tx); 
          } else if (address.indexOf(tx.to) > -1) {
            if (txsToReturn[tx.to] === undefined) txsToReturn[tx.to] = [ tx ]
            else                                    txsToReturn[tx.to].push(tx); 
          }
        })
        return cb(null, txsToReturn);
      })
    }
  }

  getTxs(hashes, cb, opts = {}) {
    if (typeof hashes === 'string') {
      return this._getTx(hashes, cb, opts);
    } 
    if (hashes.length === 0) {
      return cb(null, filled);
    } 
    const hash = hashes.shift();
    return this._getTx(hash, (err, tx) => {
      if (err) return cb(err)
      if (tx) filled.push(tx);
      return this._getTx(hashes, cb, opts, filled);
    }, opts);
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
    console.log('typeof address', typeof address, address)
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

}