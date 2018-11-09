import config from '../config.js';
import { BlockCypherApi, BcoinApi } from './apis'
const schemas = require('../permissions/codes.json');
const BASE_SEGWIT_SIZE = 134; // see: https://www.reddit.com/r/Bitcoin/comments/7m8ald/how_do_i_calculate_my_fees_for_a_transaction_sent/
const defaultOpts = {
  host: config.bitcoinNode.host,
  network: config.bitcoinNode.network,
  port: config.bitcoinNode.port,
};
const DEFAULT_FEE = 3;

export default class Bitcoin {
  constructor (opts=defaultOpts) {
    this.name = 'bitcoin';
    this.shortcode = 'BTC';
    if (opts.blockcypher === true) {
      // Use blockcypher api client
      this.provider = new BlockCypherApi(opts);
    } else {
      // Use bcoin client
      this.provider = new BcoinApi(opts);
    }
  }

  broadcast(txData, cb) {
    return this.provider.broadcast(txData, cb)
  }

  getBalance ({ address, sat = true }, cb) {
    return this.provider.getBalance({ address, sat }, cb);
  }

  getStatefulParams(opts, cb) {
    if (opts.sender) {
      const schema = schemas.schemaNames[opts.schemaIndex];
      const valueIndex = schema.indexOf('value');
      const changeIndex = schema.indexOf('change');
      const value = opts.params[valueIndex];
      this._getUtxos(opts.sender, opts.accountIndex, value, (err, utxos) => {
        if (err) return cb(err);
        const inputs = this.provider.buildInputs(utxos);
        const change = this._getChange(opts, utxos, value);
        opts.params[changeIndex] = change;
        const newOpts = {
          schemaIndex: opts.schemaIndex,
          typeIndex: opts.typeIndex,
          params: opts.params.concat(inputs),
          network: opts.network || 'bitcoin',
        };
        return cb(null, newOpts);
      })
    } else {
      return cb(null, opts);
    }
  }

  getTxHistory(opts, cb) {
    if (!opts.address && !opts.addresses) return cb('No address or addresses included in options.');
    const address = opts.address ? opts.address : opts.addresses;
    return this.provider.getTxHistory({ address }, cb);
  }

  getTx(hashes, cb, opts={}) {
    this.provider.getTx(hashes, (err, txs) => {
      if (err) return cb(err)
      else     return cb(null, txs);
    }, opts);
  }

  initialize (cb) {
    return this.provider.initialize(cb);
  }

  _getChange(opts, utxos, value) {
    const feeRate = opts.perByteFee === undefined ? DEFAULT_FEE : opts.perByteFee;
    // Estimate the number of bytes of a transaction with (10 + 180*n_inputs + 32*n_outputs)
    // There are various ways to do this: (https://bitcoin.stackexchange.com/questions/1195/how-to-calculate-transaction-size-before-sending-legacy-non-segwit-p2pkh-p2sh)
    // but this is fine for now
    const nBytes = 10 + utxos.length * 180 + 2 * 32;  // Always 2 outputs for now
    let utxoSum = 0;
    utxos.forEach((utxo) => { utxoSum += utxo.value; });
    return utxoSum - value - Math.ceil(feeRate * nBytes)
  }

  _getTx(hash, cb) {
    return this.provider.getTx(hash, cb);
  }

  _getUtxos(addresses, accountIndices, value, cb) {
    this.getBalance({ address: addresses }, (err, account) => {
      if (err) return cb(err);
      
      const utxos = [];
      let utxoSum = 0;
  
      if (account.utxos) { 
        // Blockcypher api
        account.utxos.forEach((utxo) => {
          if (utxoSum <= value) {
            // Find the accountIndex corresponding to the address of the recipient
            utxo.accountIndex = accountIndices[addresses.indexOf(utxo.address)];
            utxos.push(utxo);
            utxoSum += utxo.value;
          }
        });
      } else {
        // Bcoin api
        addresses.forEach((address, i) => {
          if (account[address] && account[address].utxos && account[address].utxos.length > 0) {
            account[address].utxos.forEach((utxo) => {
              if (utxoSum <= value) {
                // Find the accountIndex corresponding to the address of the recipient
                utxo.accountIndex = accountIndices[addresses.indexOf(utxo.address)];
                utxos.push(utxo);
                utxoSum += utxo.value;
              }
            })
          }
        })
      }
      return cb(null, utxos);
    })
  }



}