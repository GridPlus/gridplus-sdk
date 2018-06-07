const leftPad = require('left-pad');

exports.defaultWeb3Provider = 'http://localhost:7545';

exports.erc20 = {
  // balanceOf(address tokenOwner)
  balanceOf: function(addr) { return `0x70a08231${leftPad(addr, '0', 64)}` },
  decimals: function() { return `0x313ce567` },
};