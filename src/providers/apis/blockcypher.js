// Blockcypher API
import { httpReq } from '../../util';

export default class BlockCypherApi {
  constructor(opts) {
    this.network = opts.network ? opts.network : 'main';
    this.blockcypherBaseUrl = `https://api.blockcypher.com/v1/btc/${this.network}`;
  }

  getBalance({ address, sat = true }, cb) {
    if (typeof address === 'string') {
      return httpReq(`${this.blockcypherBaseUrl}/addrs/${address}/full`)
      .then((res) => { 
        const toReturn = {
          balance: res.balance,
          utxos: this._filterTxs(res.txs, address),
        }
        return cb(null, toReturn); })
      .catch((err) => { return cb(err); })
    } else {
      return httpReq(`${this.blockcypherBaseUrl}/addrs/${address.join(';')}/full`)
      .then((res) => {
        const toReturn = {};
        res.forEach((b) => {
          toReturn[b.address] = {
            balance: b.balance,
            utxos: this._filterTxs(b.txs, b.address),
          };
        })
        return cb(null, toReturn);
      })
      .catch((err) => { return cb(err);})
    }
  }

  _filterTxs(txs, address) {
    const newTxs = [];
    const addresses = typeof address === 'string' ? [ address ] : address;
    txs.forEach((tx) => {
      tx.outputs.forEach((o) => {
        // Really not sure why output.addresses is an array. I don't know when you would
        // send an output with multiple recipients...
        const outputAddress = o.addresses[0];
        if (addresses.indexOf(outputAddress) > -1) {
          const newTx = {
            version: tx.ver,
            height: tx.block_height,
            value: o.value,
            script: o.script,
            address: outputAddress,
            coinbase: false,
            hash: tx.hash,
            index: tx.block_index,
          };
          newTxs.push(newTx);
        }
      })
    })
    return newTxs;
  }

}