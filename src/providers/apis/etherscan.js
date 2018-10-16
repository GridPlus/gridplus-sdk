import { BigNumber } from 'bignumber.js';
import ethers from 'ethers';
import config from '../../config.js';

export default class EtherscanApi {

  constructor(opts) {
    this.network = opts.network || 'homestead'; // No idea why mainnet is still being called homestead...
    this.provider = new ethers.providers.EtherscanProvider(this.network, config.etherscanApiKey);
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

  getTxHistory(opts) {
    return new Promise((resolve, reject) => {
      const { address, ERC20Token } = opts;
      let txs = [];
      this.provider.getHistory(address)
      .then((history) => { 
        txs = history;
        return this.provider.tokentx(address)
      })
      .then((tokenHistory) => {
        if (!tokenHistory) tokenHistory = [];
        try {
          txs = txs.concat(this._filterEtherscanTokenHistory(tokenHistory, ERC20Token));
          return resolve(this._filterEtherscanTxs(txs, address));
        } catch (err) {
          return reject(new Error(`Error filtering token transfer history: ${err}`));
        }
      })
      .catch((err) => { return reject(err); })
    })
  }

  _filterEtherscanTokenHistory(transfers, tokenAddresses) {
    if (!tokenAddresses) return transfers;
    if (typeof tokenAddresses === 'string') tokenAddresses = [ tokenAddresses ];
    const addressesToCheck = tokenAddresses.map((a) => { return a.toLowerCase() })
    const filteredTransfers = transfers.filter((t) => { 
      return addressesToCheck.indexOf(t.creates.toLowerCase()) > -1 
    });
    return filteredTransfers;
  }

  _filterEtherscanTxs(txs, address) {
    const newTxs = [];
    const isArray = txs instanceof Array === true;
    if (!isArray) txs = [ txs ];
    const ethFactor = new BigNumber('1e18');
    txs.forEach((tx) => {
      const valString = tx.value.toString();
      const gasPrice = new BigNumber(tx.gasPrice.toString());
      const gasLimit = new BigNumber(tx.gasLimit.toString());
      const to = tx.to ? tx.to : '';
      const contractAddress = tx.creates ? tx.creates : null;
      const value = contractAddress === null ? BigNumber(valString).div(ethFactor).toString() : valString;
      newTxs.push({
        to: to,
        from: tx.from,
        fee: gasPrice.times(gasLimit).div(ethFactor).toString(),
        in: to.toLowerCase() === address.toLowerCase() ? 1 : 0,
        hash: tx.hash,
        currency: 'ETH',
        height: tx.blockNumber,
        timestamp: tx.timestamp,
        value,
        data: tx,
        contractAddress,
      });
    });
    return newTxs;
  }


}