import { NodeClient } from 'bclient';
import config from '../config.js';
import { getTxHash } from '../util';

export default class Bitcoin {
  constructor (/* TODO: pass config in via ctor */) {
    this.client = new NodeClient({
      host: config.bitcoinNode.host,
      network: config.bitcoinNode.network,
      port: config.bitcoinNode.port,
    });
    this.name = 'bitcoin';
    this.shortcode = 'BTC';
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
      balance /= 10 ** 8;
    }
    return {
      utxos, balance
    };
  }

  broadcast(txData, cb) {
    let { tx, txHash } = txData;
    if (!txHash) txHash = getTxHash(tx);
    this.client.broadcast(tx)
    .then((success) => {
      if (!success.success) return cb('Could not broadcast transaction. Please try again later.');
      return this.client.execute('getmempoolentry', [txHash])
    })
    .then((mempoolEntry) => {
      if (!mempoolEntry || !mempoolEntry.time) {
        return cb('Could not find broadcasted transaction. Try resubmitting it.');
      }
      return cb(null, { txHash, timestamp: mempoolEntry.time });
    })
    .catch((err) => {
      return cb(err);
    })
  }

  getBalance ({ address, sat = true }, cb) {
    let balances;
    if (typeof address === 'string') {
      this.getUtxosSingleAddr(address)
        .then((utxos) => { 
          balances = this.addBalanceSingle(utxos, sat);
          return this.getTxsSingleAddr(address)
        })
        .then((txs) => {
          balances.txs = txs;
          cb(null, balances);
        })
        .catch((err) => { cb(err); })
    } else {
      // TODO: Get this to work with the testnet. Unfortunately, regtest
      // addresses show up differently in bcoin (even though it is happy)
      // to process the ones we give it. Our testnet addrs start with 2,
      // while bcoin's regtest addrs start with R. I don't know how to get
      // theirs from a public key
      /*this.getUtxosMultipleAddrs(address)
        .then((utxos) => { 
          balances = this.addBalanceMultiple(utxos);
          return this.getTxsMultipleAddrs(address)
        })
        .then((txs) => {
          // balances.txs 
          cb(null, balances);
        })
        .catch((err) => { cb(err); })
      */
      cb(null, null);
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
/*
  getUtxosMultipleAddrs(addrs) {
    return new Promise((resolve, reject) => {
      const utxos = {}
      // Make sure there is a list for UTXOs of each address
      addrs.forEach((a) => {
        if (utxos[a] === undefined) utxos[a] = [];
      });
      console.log('addrs', addrs, '\n\n')
      this.client.getCoinsByAddresses(addrs)
      .then((bulkUtxos) => {
        console.log('bulkUtxos', bulkUtxos.length)
        // Reconstruct data, indexed by address
        bulkUtxos.forEach((u) => {
          console.log('u.ad', u.address)
          utxos[u.address].push(u);
        });
        return resolve(utxos);
      })
      .catch((err) => {
        return reject(err);
      })
    })
  }
*/
  getTxsSingleAddr(addr) {
    return new Promise((resolve, reject) => {
      this.client.getTXByAddress(addr)
      .then((txs) => {
        const sortedTxs = this._sortByHeight(txs);
        return resolve(sortedTxs);
      })
      .catch((err) => {
        return reject(err);
      })
    })
  }
/*
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
          txs[u.address].push(this._sortByHeight(u));
        });
        return resolve(txs);
      })
      .catch((err) => {
        return reject(err);
      })
    })
  }
*/
  initialize (cb) {
    this.client.getInfo()
      .then((info) => {
        if (!info || !info.network) return cb(new Error('Could not connect to node'));
        return cb(null, info);
      })
      .catch((err) => cb(err))
  }

  _sortByHeight(_utxos) {
    return _utxos.sort((a, b) => {
      return (a.height > b.height) ? 1 : ((b.height > a.height) ? -1 : 0)
    });
  }
}