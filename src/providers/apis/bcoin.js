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
  
  broadcast(txData, cb) {
    const { tx } = txData;
    let { txHash, opts } = txData;
    if (!opts) opts = {};
    if (!txHash) txHash = getTxHash(tx);
    this.client.broadcast(tx)
    .then((success) => {
      if (!success.success) return cb('Could not broadcast transaction. Please try again later.');
      this._getTx(txHash, (err, newTx) => {
        if (err) return cb(err);
        return cb(null, newTx)
    }, opts)
    })
    .catch((err) => {
      return cb(err);
    })
  }

  getBalance({ address, sat }, cb, accounts = []) {
    let balances;
    if (typeof address === 'string') {
      this.getUtxosSingleAddr(address).then(utxos => {
        balances = this.addBalanceSingle(utxos, sat);
        cb(null, this._combineBalances({ [address]: balances }));
      }).catch(err => {
        cb(err);
      });
    } else {
      this.getUtxosMultipleAddrs(address).then(utxos => {
        balances = this.addBalanceMultiple(utxos);
        cb(null, this._combineBalances(balances));
      }).catch(err => {
        cb(err);
      });
    }
  }

  _combineBalances(balances) {
    const combined = {
      balance: 0,
      utxos: []
    }
    Object.keys(balances).forEach((k) => {
      const balance = balances[k];
      if (typeof balance === 'object' && !Array.isArray(balance)) {
        combined.balance += balance.balance;
        combined.utxos = combined.utxos.concat(balance.utxos);
      }
    });
    return combined;
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

  getTxs(hashes, cb, opts = {}, filled=[]) {
    if (typeof hashes === 'string') {
      return this._getTx(hashes, cb, opts);
    } else if (hashes.length === 0) {
      return cb(null, filled);
    } else {
      const hash = hashes.shift();
      return this._getTx(hash, (err, tx) => {
        if (err) return cb(err)
        if (tx) filled.push(tx);
        return this.getTxs(hashes, cb, opts, filled);
      }, opts);
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

  _filterTxs(txs, opts={}) {
    const addresses = opts.addresses ? opts.addresses : [];
    const newTxs = [];
    const isArray = txs instanceof Array === true;
    if (!txs) {
      txs = [];
    } else if (!isArray) {
      txs = [txs];
    }
    txs.forEach((tx) => {
      let value = 0;
      tx.inputs.forEach((input) => {
        if (input.coin && addresses.indexOf(input.coin.address) > -1) {
          // If this was sent by one of our addresses, the value should be deducted
          value -= input.coin.value;
        }
      });
      tx.outputs.forEach((output) => {
        if (addresses.indexOf(output.address) > -1) {
          value += output.value; 
        }
      });
      if (value < 0) value += tx.fee
      else           value -= tx.fee;
      // Set metadata
      newTxs.push({
        to: tx.outputs[0].address, 
        from: tx.inputs[0].coin ? tx.inputs[0].coin.address : '',
        fee: tx.fee / Math.pow(10, 8),
        in: value > 0 ? 1 : 0,
        hash: tx.hash,
        currency: 'BTC',
        height: tx.height,
        timestamp: tx.mtime,
        value: value / Math.pow(10, 8),
        data: tx,
      });
    });

    if (txs.length === 0)  return []
    else if (!isArray)     return newTxs[0]
    else                   return newTxs;
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