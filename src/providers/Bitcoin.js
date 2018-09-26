import { NodeClient } from '@gridplus/bclient';
import config from '../config.js';
import { httpReq, getTxHash } from '../util';
import { BlockCypherApi } from './apis'
const BASE_SEGWIT_SIZE = 134; // see: https://www.reddit.com/r/Bitcoin/comments/7m8ald/how_do_i_calculate_my_fees_for_a_transaction_sent/
const defaultOpts = {
  host: config.bitcoinNode.host,
  network: config.bitcoinNode.network,
  port: config.bitcoinNode.port,
};

export default class Bitcoin {
  constructor (opts=defaultOpts) {
    this.name = 'bitcoin';
    this.shortcode = 'BTC';
    if (opts.blockcypher === true) {
      // Use blockcypher api client
      this.blockcypher = true;
      this.provider = new BlockCypherApi(opts);
    } else {
      // Use bcoin client      
      this.client = new NodeClient(opts);
    }
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
    if (this.blockcypher === true) {
      return this.provider.broadcast(txData.tx, cb)
    } else {
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
  }

  buildTx ({amount, to, addresses, perByteFee, changeIndex=null, network=null, scriptType='p2sh(p2wpkh)'}, cb) {
    this.getBalance({ address: addresses }, (err, utxoSets) => {
      if (err) return cb(err);
      
      const utxos = [];
      let utxoSum = 0;
      addresses.forEach((address, i) => {
        if (utxoSets[address] && utxoSets[address].utxos && utxoSets[address].utxos.length > 0) {
          utxoSets[address].utxos.forEach((utxo) => {
            utxos.push([i, utxo]);
            utxoSum += utxo.value;
          });
        }
      });
      
      if (utxoSum <= amount) return cb(`Not enough balance to make this transaction: have ${utxoSum}, need ${amount}`);
      
      let inputs = [];
      let numInputs = 0;
      // Size is the base size plus 40 (for one additional output) plus 100 for each input over 1
      // This should work for now, but we should make it better
      // TODO: Make this more robust
      let bytesSize = 0;
      let fee = 0;
      let utxoVersion = 1;
      utxoSum = 0;  // Reset this as zero; we will count up with it
      utxos.forEach((utxo) => {
        if (utxoSum <= (amount + fee)) {
          const input = [
            utxo[1].hash,
            utxo[1].index,
            scriptType,
            utxo[0],
            utxo[0],   // We have to do this twice for legacy reasons. This should get cleaned up soon on the agent side
            null, // utxo[1].value,
          ];
          inputs = inputs.concat(input);
          numInputs += 1;
          bytesSize = BASE_SEGWIT_SIZE + 100 * (numInputs - 1) + 40;
          fee = perByteFee * bytesSize;
          utxoSum += utxo[1].value;
          utxoVersion = utxo[1].version; // Not sure what to do if two utxos have different versions...
        }
      });
      const params = [
        utxoVersion || 1,   // version
        0,   // locktime
        to,  // recipient
        amount,
        utxoSum - amount - fee,   // change
      ];

      if (utxoSum <= (amount + fee)) return cb(`Not enough balance to make this transaction: have balance=${utxoSum}, need amount=${amount}+fee=${fee}`);

      // TODO: addresses.length is not really the best way to do this because it requires
      // the user to provide all known addresses
      const req = {
        schemaIndex: 1,  // Bitcoin
        typeIndex: 2,    // segwit
        params: params.concat(inputs),
        fetchAccountIndex: changeIndex ? changeIndex : addresses.length,  // index of the change address
        network: network ? network : 'regtest',
      };
      return cb(null, req); 
    })
  }

  getBalance ({ address, sat = true }, cb) {
    if (this.blockcypher === true) {
      return this.provider.getBalance({ address, sat}, cb);
    } else {  
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
  }

  getTxHistory(opts, cb) {
    if (!opts.address && !opts.addresses) return cb('No address or addresses included in options.');
    const a = opts.address ? opts.address : opts.addresses;
    if (this.blockcypher === true) {
      return this.provider.getTxHistory({ address: a }, cb);
    } else {
      if (typeof a === 'string') {
        this.client.getTXByAddress(a)
        .then((txs) => {
          const filteredTxs = this._filterTxs(txs, { addresses: a });
          return cb(null, filteredTxs);
        })
        .catch((err) => {
          return cb(err);
        })
      } else {
        this.client.getTXByAddresses(a)
        .then((txs) => {
          const filteredTxs = this._filterTxs(txs, { addresses: a });
          const txsToReturn = {};
          filteredTxs.forEach((tx) => {
            if (a.indexOf(tx.from) > -1) {
              if (txsToReturn[tx.from] === undefined) txsToReturn[tx.from] = [ tx ]
              else                                    txsToReturn[tx.from].push(tx); 
            } else if (a.indexOf(tx.to) > -1) {
              if (txsToReturn[tx.to] === undefined) txsToReturn[tx.to] = [ tx ]
              else                                    txsToReturn[tx.to].push(tx); 
            }
          })
          return cb(null, txsToReturn);
        })
      }
    }
  }

  getTx(hashes, cb, opts={}, filled=[]) {
    if (typeof hashes === 'string') {
      return this._getTx(hashes, cb, opts);
    } else if (hashes.length === 0) {
      return cb(null, filled);
    } else {
      const hash = hashes.shift();
      return this._getTx(hash, (err, tx) => {
        if (err) return cb(err)
        if (tx) filled.push(tx);
        return this.getTx(hashes, cb, opts, filled);
      }, opts);
    }
  }

  getUtxosSingleAddr(addr) {
    return new Promise((resolve, reject) => {
      this.client.getCoinsByAddress(addr)
        .then((utxos) => {
          const sortedUtxos = this._sortByHeight(utxos);
          return resolve(sortedUtxos);
        })
        .catch((err) => {
          return reject(err);
        });
    });
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
        // Reconstruct data, indexed by address
        bulkUtxos.forEach((u) => {
          utxos[u.address].push(u);
        });
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
        const sortedTxs = this._sortByHeight(txs);
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
          txs[a] = this._sortByHeight(txs[a]);
        });
        return resolve(txs);
      })
      .catch((err) => {
        return reject(err);
      })
    })
  }

  initialize (cb) {
    if (this.blockcypher === true) {
      return this.provider.initialize(cb);
    } else {
      this.client.getInfo()
      .then((info) => {
        if (!info || !info.network) return cb(new Error('Could not connect to node'));
        return cb(null, info);
      })
      .catch((err) => cb(err))
    }
  }

  _getTx(hash, cb, opts={}) {
    if (this.blockcypher === true) {
      return this.provider.getTx(hash, cb);
    } else {
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
  }

  _filterTxs(txs, opts={}) {
    const addresses = opts.addresses ? opts.addresses : [];
    const newTxs = [];
    const isArray = txs instanceof Array === true;
    if (!isArray) { txs = [ txs ]; }
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
    if (!isArray) return newTxs[0]
    else          return newTxs;
  }

  _sortByHeight(_utxos) {
    return _utxos.sort((a, b) => {
      return (a.height > b.height) ? 1 : ((b.height > a.height) ? -1 : 0)
    });
  }

}