const { bitcoinNode } = require('../../config.js');
const { BlockCypherApi, BcoinApi } = require('./apis');
const schemas = require('../permissions/codes.json');
const defaultOpts = {
  host: bitcoinNode.host,
  network: bitcoinNode.network,
  port: bitcoinNode.port,
};
const DEFAULT_FEE = 3;

class Bitcoin {
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
      const schema = schemas.schemaNames[opts.schemaIndex][opts.typeIndex];
      const valueIndex = this._getParamIndex(schema, 'value');
      const changeIndex = this._getParamIndex(schema, 'change');
      const value = opts.params[valueIndex];
      this._getUtxos(opts.sender, opts.accountIndex, opts, value, (err, utxos) => {
        if (err) return cb(err);
        this.provider.buildInputs(utxos, (err, inputs) => {
          if (err) return cb(err);
          const change = this._getChange(opts, utxos, value);
          if (change < 0) {
            return cb('You are not sending enough to cover ')
          }
          opts.params[changeIndex] = change;
          const newOpts = {
            schemaIndex: opts.schemaIndex,
            typeIndex: opts.typeIndex,
            params: opts.params.concat(inputs),
            network: opts.network || 'bitcoin',
          };
          return cb(null, newOpts);
        });
      })
    } else {
      return cb(null, opts);
    }
  }

  _getParamIndex(schema, name) {
    let paramIndex = 0;
    schema.forEach((x, i) => {
      if (x[0] === name) paramIndex = i;
    })
    return paramIndex;
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

  _getUtxos(addresses, accountIndices, opts, value, cb) {
    if (!Array.isArray(accountIndices)) accountIndices = [ accountIndices ];
    if (!Array.isArray(addresses))      addresses = [ addresses ];
    
    this.getBalance({ address: addresses }, (err, account) => {
      if (err) return cb(err);
      const utxos = [];
      let utxoSum = 0;
      let change;
      if (account.utxos) { 
        // Blockcypher api
        account.utxos.forEach((utxo) => {
          if (utxoSum <= value || change < 0) {
            // Find the accountIndex corresponding to the address of the recipient
            utxo.accountIndex = accountIndices[addresses.indexOf(utxo.address)];
            utxos.push(utxo);
            utxoSum += utxo.value;
            change = this._getChange(opts, utxos, value);
          }
        });
      }
      return cb(null, utxos);
    })
  }

}

exports.default = Bitcoin;
exports.Bitcion = Bitcoin;