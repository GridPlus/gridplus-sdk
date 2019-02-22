import { pad64 } from './util.js';
const erc20Abi = [{'constant':true,'inputs':[],'name':'name','outputs':[{'name':'','type':'string'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'name':'_spender','type':'address'},{'name':'_value','type':'uint256'}],'name':'approve','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'totalSupply','outputs':[{'name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'name':'_from','type':'address'},{'name':'_to','type':'address'},{'name':'_value','type':'uint256'}],'name':'transferFrom','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'decimals','outputs':[{'name':'','type':'uint8'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'version','outputs':[{'name':'','type':'string'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'name':'_owner','type':'address'}],'name':'balanceOf','outputs':[{'name':'balance','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'symbol','outputs':[{'name':'','type':'string'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'name':'_recipient','type':'address'},{'name':'_value','type':'uint256'}],'name':'transfer','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[{'name':'_spender','type':'address'},{'name':'_owner','type':'address'}],'name':'allowance','outputs':[{'name':'balance','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'inputs':[],'payable':false,'stateMutability':'nonpayable','type':'constructor'},{'anonymous':false,'inputs':[{'indexed':true,'name':'from','type':'address'},{'indexed':true,'name':'to','type':'address'},{'indexed':false,'name':'value','type':'uint256'}],'name':'Transfer','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'name':'owner','type':'address'},{'indexed':true,'name':'spender','type':'address'},{'indexed':false,'name':'value','type':'uint256'}],'name':'Approval','type':'event'}];
export const defaultWeb3Provider = process.env.ETHEREUM_NODE_URI || 'http://localhost:8545';

export const SPLIT_BUF = 'qqq';

export const defaults = {
  gasPrice: 10 * Math.pow(10, 9)
}

export const erc20 = {
  abi: erc20Abi,
  balanceOf: function(addr) { return `0x70a08231${pad64(addr)}` },
  transfer: function(addr, value) { return `0xa9059cbb${pad64(addr)}${pad64(value.toString(16))}` },
  decimals: function() { return '0x313ce567' },
};

export const ethFunctionCodes = {
  ERC20Transfer: 'a9059cbb'
}

export const api = {
  baseUrl: process.env.BASE_URL || 'http://localhost',
  SPLIT_BUF,
}

export const bitcoinNode = {
  host: process.env.BITCOIN_NODE_HOST || 'localhost',
  network: 'regtest',
  port: 48332,
}

// Number of bytes for app secret (using base25 dictionary)
export const APP_SECRET_LEN = 9;

export default {
  APP_SECRET_LEN,
  SPLIT_BUF,
  defaults,
  ethFunctionCodes,
  erc20,
  api,
  bitcoinNode,
  defaultWeb3Provider,
}