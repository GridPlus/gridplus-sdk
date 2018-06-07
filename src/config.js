const leftPad = require('left-pad');

exports.defaultWeb3Provider = 'http://localhost:7545';

exports.erc20 = {
  // balanceOf(address tokenOwner)
  balanceOf: function(addr) { return `0x70a08231${leftPad(addr, '0', 64)}` },
  decimals: function() { return `0x313ce567` },
};

// For testing purposes
exports.testing = {
  // An account which holds some ether. This corresponds with the following mnemonic:
  // finish oppose decorate face calm tragic certain desk hour urge dinosaur mango
  ethHolder: {
    address: '0x1c96099350f13D558464eC79B9bE4445AA0eF579',
    privKey: 'd3cc16948a02a91b9fcf83735653bf3dfd82c86543fdd1e9a828bd25e8a7b68d'
  }
};