import { pad64 } from './util.js';

const erc20Abi = [{'constant':true,'inputs':[],'name':'name','outputs':[{'name':'','type':'string'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'name':'_spender','type':'address'},{'name':'_value','type':'uint256'}],'name':'approve','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'totalSupply','outputs':[{'name':'','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'name':'_from','type':'address'},{'name':'_to','type':'address'},{'name':'_value','type':'uint256'}],'name':'transferFrom','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[],'name':'decimals','outputs':[{'name':'','type':'uint8'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'version','outputs':[{'name':'','type':'string'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[{'name':'_owner','type':'address'}],'name':'balanceOf','outputs':[{'name':'balance','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':true,'inputs':[],'name':'symbol','outputs':[{'name':'','type':'string'}],'payable':false,'stateMutability':'view','type':'function'},{'constant':false,'inputs':[{'name':'_recipient','type':'address'},{'name':'_value','type':'uint256'}],'name':'transfer','outputs':[],'payable':false,'stateMutability':'nonpayable','type':'function'},{'constant':true,'inputs':[{'name':'_spender','type':'address'},{'name':'_owner','type':'address'}],'name':'allowance','outputs':[{'name':'balance','type':'uint256'}],'payable':false,'stateMutability':'view','type':'function'},{'inputs':[],'payable':false,'stateMutability':'nonpayable','type':'constructor'},{'anonymous':false,'inputs':[{'indexed':true,'name':'from','type':'address'},{'indexed':true,'name':'to','type':'address'},{'indexed':false,'name':'value','type':'uint256'}],'name':'Transfer','type':'event'},{'anonymous':false,'inputs':[{'indexed':true,'name':'owner','type':'address'},{'indexed':true,'name':'spender','type':'address'},{'indexed':false,'name':'value','type':'uint256'}],'name':'Approval','type':'event'}];

export const defaultWeb3Provider = process.env.ETHEREUM_NODE_URI || 'http://localhost:8545';

export const SPLIT_BUF = '22222222222222222222222222222222';

export const defaults = {
  gasPrice: 10 * 10**9
}
export const erc20 = {
  abi: erc20Abi,
  balanceOf: function(addr) { return `0x70a08231${pad64(addr)}` },
  transfer: function(addr, value) { return `0xa9059cbb${pad64(addr)}${pad64(value.toString(16))}` },
  decimals: function() { return '0x313ce567' },
};

export const api = {
  baseUrl: process.env.BASE_URL || 'http://localhost',
  SPLIT_BUF: '22222222222222222222222222222222',
}

export const bitcoinNode = {
  host: 'localhost',
  network: 'regtest',
  port: 48332,
}

// For testing purposes
export const testing = {
  // An account which holds some ether. This corresponds with the following mnemonic:
  // finish oppose decorate face calm tragic certain desk hour urge dinosaur mango
  ethHolder: {
    address: '0x1c96099350f13D558464eC79B9bE4445AA0eF579',
    privKey: 'd3cc16948a02a91b9fcf83735653bf3dfd82c86543fdd1e9a828bd25e8a7b68d'
  },
  // You can generate a privkey in WIF format (and an address in the network format) via bitcoinjs-lib:
  // see: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/addresses.js#L123
  btcHolder: {
    address: 'moVVsb2KUaQKgigofdap3Cep183Rwjn5yK',
    wif: 'cNFp1KBiHmKdPrSPYK4DJP73Zz674xdxcVrircAws6LMqgjV1yMj',
    regtestAddress: 'RGagGW23MVPdDPBeMbPexBVKHHmZNdApE3',
    regtestWif: 'ENH8D3xGLQ8fg249pZBT6bnyXNUeJcNSbxH6yZWNfpcx6dSPeEui'
  },
  erc20Src: '0x608060405234801561001057600080fd5b5064174876e8006000819055506040805190810160405280600581526020017f546f6b656e00000000000000000000000000000000000000000000000000000081525060019080519060200190610068929190610168565b506004600260006101000a81548160ff021916908360ff1602179055506040805190810160405280600381526020017f544b4e0000000000000000000000000000000000000000000000000000000000815250600390805190602001906100d0929190610168565b506040805190810160405280600381526020017f312e3000000000000000000000000000000000000000000000000000000000008152506004908051906020019061011c929190610168565b50600054600560003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000208190555061020d565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106101a957805160ff19168380011785556101d7565b828001600101855582156101d7579182015b828111156101d65782518255916020019190600101906101bb565b5b5090506101e491906101e8565b5090565b61020a91905b808211156102065760008160009055506001016101ee565b5090565b90565b610c458061021c6000396000f3006080604052600436106100a4576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff16806306fdde03146100a9578063095ea7b31461013957806318160ddd1461018657806323b872dd146101b1578063313ce5671461021e57806354fd4d501461024f57806370a08231146102df57806395d89b4114610336578063a9059cbb146103c6578063dd62ed3e14610413575b600080fd5b3480156100b557600080fd5b506100be61048a565b6040518080602001828103825283818151815260200191508051906020019080838360005b838110156100fe5780820151818401526020810190506100e3565b50505050905090810190601f16801561012b5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34801561014557600080fd5b50610184600480360381019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610528565b005b34801561019257600080fd5b5061019b610612565b6040518082815260200191505060405180910390f35b3480156101bd57600080fd5b5061021c600480360381019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610618565b005b34801561022a57600080fd5b50610233610888565b604051808260ff1660ff16815260200191505060405180910390f35b34801561025b57600080fd5b5061026461089b565b6040518080602001828103825283818151815260200191508051906020019080838360005b838110156102a4578082015181840152602081019050610289565b50505050905090810190601f1680156102d15780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b3480156102eb57600080fd5b50610320600480360381019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610939565b6040518082815260200191505060405180910390f35b34801561034257600080fd5b5061034b610982565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561038b578082015181840152602081019050610370565b50505050905090810190601f1680156103b85780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b3480156103d257600080fd5b50610411600480360381019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610a20565b005b34801561041f57600080fd5b50610474600480360381019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610b92565b6040518082815260200191505060405180910390f35b60018054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156105205780601f106104f557610100808354040283529160200191610520565b820191906000526020600020905b81548152906001019060200180831161050357829003601f168201915b505050505081565b80600660003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508173ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925836040518082815260200191505060405180910390a35050565b60005481565b80600560008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054101580156106e3575080600660008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410155b80156106ef5750600081115b15156106fa57600080fd5b80600560008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000828254019250508190555080600560008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000828254039250508190555080600660008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825403925050819055508173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040518082815260200191505060405180910390a3505050565b600260009054906101000a900460ff1681565b60048054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156109315780601f1061090657610100808354040283529160200191610931565b820191906000526020600020905b81548152906001019060200180831161091457829003601f168201915b505050505081565b6000600560008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b60038054600181600116156101000203166002900480601f016020809104026020016040519081016040528092919081815260200182805460018160011615610100020316600290048015610a185780601f106109ed57610100808354040283529160200191610a18565b820191906000526020600020905b8154815290600101906020018083116109fb57829003601f168201915b505050505081565b6040600481016000369050141515610a3457fe5b81600560003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410158015610a835750600082115b1515610a8e57600080fd5b81600560003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000828254039250508190555081600560008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040518082815260200191505060405180910390a3505050565b6000600660008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050929150505600a165627a7a723058201e3a5824933120fc92abe21bd3092e6273d45230accbaadb4963b440394dfc970029',
};

export default {
  defaultWeb3Provider,
  SPLIT_BUF,
  defaults,
  erc20,
  api,
  bitcoinNode,
  testing
}