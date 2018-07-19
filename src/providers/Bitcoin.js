import { NodeClient } from 'bclient';
import config from '../config.js';

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

  getBalance ({ address }, cb) {
    if (typeof address === 'string') {
      this.getUtxosSingleAddr(address)
        .then((utxos) => { cb(null, this.addBalanceSingle(utxos)); })
        .catch((err) => { cb(err); })
    } else {
      this.getUtxosMultipleAddrs(address)
        .then((utxos) => { cb(null, this.addBalanceMultiple(utxos)); })
        .catch((err) => { cb(err); })
    }
  }

  getUtxosSingleAddr(addr) {
    return new Promise((resolve, reject) => {
      this.client.getCoinsByAddress(addr)
        .then((utxos) => {
          const sortedUtxos = this._sortUtxos(utxos);
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

  initialize (cb) {
    this.client.getInfo()
      .then((info) => {
        if (!info || !info.network) return cb(new Error('Could not connect to node'));
        return cb(null, info);
      })
      .catch((err) => cb(err))
  }

  _sortUtxos(_utxos) {
    return _utxos.sort((a, b) => {
      return (a.height > b.height) ? 1 : ((b.height > a.height) ? 1 : 0)
    });
  }
}