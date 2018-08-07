import ethers from 'ethers';
import config from '../config.js';
import { pad64, unpad } from '../util.js';

const erc20Decimals = {};

export default class Ethereum {

  constructor ({ provider = new ethers.providers.JsonRpcProvider(config.defaultWeb3Provider) } = {}) {
    this.name = 'ethereum';
    this.provider = provider;
    this.shortcode = 'ETH';
  }

  broadcast (tx, cb) {
    if (typeof tx !== 'string') return cb('Error: transaction should be a 0x-prefixed hex string.');
    this.provider.sendTransaction(tx)
    .then((txHash) => {  
      return cb(null, { hash: txHash, timestamp: new Date().getTime() });
    })
    .catch((err) => { 
      return cb(err);
    })
  }


  buildTx (from, to, value, opts = {}, cb) {
    if (typeof from !== 'string') {
      cb('Please specify a single address to transfer from');
    } else {
      this.getNonce(this.provider, from)
        .then((nonce) => {
          const tx = [ nonce, null, null, to, null, null ];
          // Fill in `value` and `data` if this is an ERC20 transfer
          if (opts.ERC20Token !== undefined) {
            tx[5] = config.erc20.transfer(to, value);
            tx[4] = 0;
            tx[3] = opts.ERC20Token;
            tx[2] = 100000; // gas=100,000 to be safe
          } else {
            tx[5] = '';
            tx[4] = value;
            tx[2] = 22000; // gas=22000 for ETH transfers
          }
          // Check for a specified gas price (should be in decimal)
          if (opts.gasPrice !== undefined) {
            tx[1] = opts.gasPrice;
          } else {
            tx[1] = config.defaults.gasPrice;
          }
          cb(null, tx);
        })
        .catch((err) => {
          cb(err);
        });
    }
  }

  getBalance ({ address, erc20Address = null}, cb) {
    const data = {
      balance: 0,
      transfers: {}
    };
    if (erc20Address !== null) {
      if (erc20Decimals[erc20Address] === undefined) {
        // Save the contract as an object
        this.provider.call({ to: erc20Address, data: config.erc20.decimals() })
        .then((decimals) => {
          erc20Decimals[erc20Address] = parseInt(decimals);
          data.decimals = parseInt(decimals);
          // Get the balance
          return this.provider.call({ to: erc20Address, data: config.erc20.balanceOf(address) })
        })
        .then((balance) => {
          data.balance = parseInt(balance) / 10 ** erc20Decimals[erc20Address];
          return this.getTransfers(this.provider, address, erc20Address)
        })
        .then((transfers) => {
          data.transfers = transfers;
          cb(null, data);
          })
        .catch((err) => { cb(err); });
      } else {
        // If the decimals are cached, we can just query the balance
        this.provider.call({ to: erc20Address, data: config.erc20.balanceOf(address) })
        .then((balance) => {
          data.decimals = erc20Decimals[erc20Address];
          data.balance = parseInt(balance);
          return this.provider.getTransactionCount(address)
        })
        .then((nonce) => {
          data.nonce = parseInt(nonce);
          // data.balance = parseInt(balance) / 10 ** erc20Decimals[erc20Address];
          return this.getTransfers(this.provider, address, erc20Address);
        })
        .then((transfers) => {
          data.transfers = transfers;
          cb(null, data);
        })
        .catch((err) => { cb(err); });
      }
    } else {
      // Otherwise query for the ETH balance
      this.provider.getBalance(address)
      .then((balance) => {
        data.balance = parseInt(balance);
        return this.provider.getTransactionCount(address)
      })
      .then((nonce) => {
        data.nonce = parseInt(nonce);
        return this.getTransfers(this.provider, address, erc20Address)
      })
      .then((transfers) => {
        data.transfers = transfers;
        cb(null, data);
      })
      .catch((err) => { cb(err); })
    }
  }

  initialize (cb) {
    return cb(null, this.provider);
  }

  getTransfers(provider, addr, ERC20Addr=null) {
    return new Promise((resolve, reject) => {
      if (ERC20Addr === null) {
        // TODO: Need to figure out how to pull transfers for ETH
        return resolve({})
      } else {
        return this.getERC20TransferHistory(provider, addr, ERC20Addr)
        .then((transfers) =>  { return resolve(transfers); })
        .catch((err) => { return reject(err); })
      }
    });
  }

  getERC20TransferHistory(provider, user, contractAddr) {
    return new Promise((resolve, reject) => {
      const events = {}
      // Get transfer "out" events
      this._getEvents(provider, contractAddr, [ null, `0x${pad64(user)}`, null ])
        .then((outEvents) => {
          events.out = outEvents;
          return this._getEvents(provider, contractAddr, [ null, null, `0x${pad64(user)}` ])
        })
        .then((inEvents) => {
          events.in = inEvents;
          return resolve(this._parseTransferLogs(events, 'ERC20', erc20Decimals[contractAddr]));
        })
        .catch((err) => { return reject(err); })
    });
  }

  getNonce (provider, user) {
    return new Promise((resolve, reject) => {
      this.provider.getTransactionCount(user)
      .then((nonce) => { return resolve(nonce); })
      .catch((err) => { return reject(err); })
    });
  }

  _getEvents(provider, address, topics, fromBlock=0, toBlock='latest') {
    return new Promise((resolve, reject) => {
      this.provider.getLogs({ address, topics, fromBlock, toBlock })
      .then((events) => { return resolve(events); })
      .catch((err) => { return reject(err); })
    });
  }

  _parseLog(log, type, decimals=0) {
    switch (type) {
      case 'ERC20':
        return {
          transactionHash: log.transactionHash,
          contract: log.address,
          from: `0x${unpad(log.topics[1])}`,
          to: `0x${unpad(log.topics[2])}`,
          value: parseInt(log.data) / (10 ** decimals),
        };
      default:
        return {};
    }
  }

  _parseTransferLogs(logs, type, decimals=0) {
    const newLogs = { in: [], out: [] };
    logs.out.forEach((log) => {
      newLogs.out.push(this._parseLog(log, type, decimals));
    });
    logs.in.forEach((log) => {
      newLogs.in.push(this._parseLog(log, type, decimals));
    });
    return newLogs;
  }

}