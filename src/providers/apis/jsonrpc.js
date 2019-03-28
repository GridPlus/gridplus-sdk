const ethers = require('ethers');
const { pad64, unpad } = require('../../util.js');
const { erc20 } = require('../../../config.js');

class JsonRpcApi {
  constructor(opts) {
    const url = typeof opts === 'string' ? opts : (opts && opts.host && opts.port ? `http://${opts.host}:${opts.port}` : 'http://localhost:8545');
    this.provider = new ethers.providers.JsonRpcProvider(url);
  }

  sendTransaction(tx) {
    return this.provider.sendTransaction(tx)
  }

  getBalance(address) {
    return this.provider.getBalance(address)
  }

  getTransaction(hash) {
    return this.provider.getTransaction(hash)
  }

  getTransactionCount(address) {
    return this.provider.getTransactionCount(address)
  }

  getTransactionReceipt(hash) {
    return this.provider.getTransactionReceipt(hash);
  }

  getTokenBalance(address, tokens) {
    return new Promise((resolve, reject) => {
      this._getTokenBalance(address, tokens, (err, balances) => {
        if (err) return reject(err)
        else     return resolve(balances);
      })
    })
  }

  getTxHistory(opts) {
    return new Promise((resolve, reject) => {
      const { address, ERC20Token } = opts;
      if (ERC20Token) {
        // Get transfer "out" events
        const tokens = typeof ERC20Token === 'string' ? [ ERC20Token ] : ERC20Token;
        this.getERC20TransferHistory(address, tokens, (err, txs) => {
          if (err) return reject(err)
          else     return resolve(txs);
        })
      } else {
        // We can't get an ETH transfer history from JSON RPC. Empty for now :/
        return resolve([]);
      }
    })
  }

   // This is only for JSON RPC providers
   getERC20TransferHistory(address, tokens, cb, txs=[]) {
    if (tokens.length === 0) {
      return cb(null, txs.sort((a, b) => { return a.height - b.height }));
    } else {
      const token = tokens.pop();
      if (typeof address === 'string') address = [ address ];
      const addressCopy = JSON.parse(JSON.stringify(address));
      this._getTokenHistoryForAddresses(addressCopy, token, (err, newTxs) => {
        if (err) return cb(err);
        this._getTxsForTokenHistory(newTxs, (err, newTxs2) => {
          if (err) return cb(err);
          this._getTimestampsFromTransfers(newTxs2, (err, newTxs3) => {
            txs = txs.concat(newTxs3);
            return this.getERC20TransferHistory(address, tokens, cb, txs);
          })
        })
      })
    }
  }

  _getTokenHistoryForAddresses(addresses, token, cb, txs=[]) {
    if (addresses.length === 0) {
      return cb(null, txs);
    } else {
      const events = {};
      const address = addresses.shift();
      this._getEvents(token, [ null, `0x${pad64(address)}`, null ])
      .then((outEvents) => {
        events.out = outEvents;
        return this._getEvents(token, [ null, null, `0x${pad64(address)}` ])
      })
      .then((inEvents) => {
        events.in = inEvents;
        const allLogs = this._parseTransferLogs(events, 'ERC20', address);
        const newTxs = allLogs.in.concat(allLogs.out);
        txs = txs.concat(newTxs);
        return this._getTokenHistoryForAddresses(addresses, token, cb, txs);
      })
      .catch((err) => { return cb(err); })
    }
  }

  _getTokenBalance(address, tokens, cb, balances={}) {
    if (tokens.length === 0) {
      return cb(null, balances);
    } else {
      if (typeof tokens === 'string') tokens = [ tokens ];
      const token = tokens.shift();
      const req = {
        to: token,
        data: erc20.balanceOf(address),
      }
      this.provider.call(req)
      .then((res) => {
        balances[token] = parseInt(res);
        return this._getTokenBalance(address, tokens, cb, balances);
      })
      .catch((err) => { return cb(err); })
    }
  }

  _getEvents(address, topics, fromBlock=0, toBlock='latest') {
    return new Promise((resolve, reject) => {
      this.provider.getLogs({ address, topics, fromBlock, toBlock })
      .then((events) => { 
        return resolve(events);
      })
      .catch((err) => { 
        return reject(err); 
      })
    });
  }

  _getTxsForTokenHistory(events, cb, newEvents=[]) {
    if (events.length === 0) return cb(null, newEvents);
    const event = events.pop();
    this.getTransaction(event.hash)
    .then((tx) => {
      event.fee = tx.gasPrice.toNumber() * Math.pow(10, -18) * tx.gasLimit.toNumber();
      event.data = tx;
      newEvents.push(event);
      return this._getTxsForTokenHistory(events, cb, newEvents);
    })
    .catch((err) => { return cb(err); })
  }

  _getTimestampsFromTransfers(txs, cb, blockHeights=null) {
    if (blockHeights === null) {
      const uniqueBlockHeights = [];
      txs.forEach((tx) => {
        if (uniqueBlockHeights.indexOf(tx.height) < 0) uniqueBlockHeights.push(tx.height);
      })
      return this._getTimestampsFromTransfers(txs, cb, uniqueBlockHeights);
    } else if (blockHeights.length === 0) {
      return cb(null, txs);
    } else {
      const blockHeight = blockHeights.pop();
      this.provider.getBlock(blockHeight)
      .then((block) => {
        txs.forEach((tx) => {
          if (tx.height === blockHeight) tx.timestamp = block.timestamp
        })
        return this._getTimestampsFromTransfers(txs, cb, blockHeights);
      })
      .catch((err) => {
        return cb(err);
      })
    }
  }

  _parseLog(log, type, address) {
    if (type === 'ERC20') {
        const from = `0x${unpad(log.topics[1])}`;
        const to = `0x${unpad(log.topics[2])}`;
        const isIn = to.toLowerCase() === address.toLowerCase() ? 1 : 0;
        return {
          currency: 'ETH',
          hash: log.transactionHash,
          height: log.blockNumber,
          // fee: 0,
          in: isIn,
          contractAddress: log.address,
          from,
          to,
          value: parseInt(log.data),
        };
    } else {
      return {};
    }
  }

  _parseTransferLogs(logs, type, address) {
    const newLogs = { in: [], out: [] };
    logs.out.forEach((log) => {
      newLogs.out.push(this._parseLog(log, type, address));
    });
    logs.in.forEach((log) => {
      newLogs.in.push(this._parseLog(log, type, address));
    });
    return newLogs;
  }

}

module.exports = JsonRpcApi;