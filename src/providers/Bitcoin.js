import { NodeClient } from '@gridplus/bclient';
import config from '../config.js';
import { getTxHash, sortByHeight } from '../util';
import { BlockCypherApi, BcoinApi } from './apis'

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
      this.provider = new BlockCypherApi(opts);
    } else {
      // Use bcoin client
      this.provider = new BcoinApi(opts);
    }
  }

  broadcast(txData, cb) {
    return this.provider.broadcast(txData.tx, cb)
  }

  buildTx ({amount, to, addresses, perByteFee, changeIndex=null, network=null, scriptType='p2sh(p2wpkh)'}, cb) {
    this.getBalance({ address: addresses }, (err, account) => {
      if (err) return cb(err);
      
      const utxos = [];
      let utxoSum = 0;
  
      if (account.utxos) { 
        // Blockcypher api
        account.utxos.forEach((utxo) => {
          const i = addresses.indexOf(utxo.address);
          if (i > -1) {
            utxos.push([i, utxo]);
            utxoSum += utxo.value;
          }
        });
      } else {
        // Bcoin api
        addresses.forEach((address, i) => {
          if (account[address] && account[address].utxos && account[address].utxos.length > 0) {
            account[address].utxos.forEach((utxo) => {
              utxos.push([i, utxo]);
              utxoSum += utxo.value;
            })
          }
        })
      }
      
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
            utxo[1].value,
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
    return this.provider.getBalance({ address, sat }, cb);
  }

  getTxHistory(opts, cb) {
    if (!opts.address && !opts.addresses) return cb('No address or addresses included in options.');
    const address = opts.address ? opts.address : opts.addresses;
    console.log('address', address)
    return this.provider.getTxHistory({ address }, cb);
  }

  getTx(hashes, cb, opts={}, filled=[]) {
    this.provider.getTxs(hashes, (err, txs) => {
      if (err) return cb(err)
      else     return cb(null, txs);
    }, opts);
  }
  
  getTxsMultipleAddrs(addrs) {
    
  }

  initialize (cb) {
    return this.provider.initialize(cb);
  }

  _getTx(hash, cb, opts={}) {
    return this.provider.getTx(hash, cb);
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

}