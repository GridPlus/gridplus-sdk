// Static utility functions
const leftPad = require('left-pad');

// left-pad with zeros up to 64 bytes
exports.pad64 = function(x) { 
  return leftPad(x.substr(0, 2) === '0x' ? x.slice(2) : x, 64, '0'); 
}

// Remove all leading zeros in piece of data
exports.unpad = function(x) { 
  if (x.substr(0, 2) === '0x') x = x.slice(2);
  let _i = 0;
  for (let i = 0; i < x.length; i++) {
    if (x[i] == 0) _i += 1;
    else return x.slice(_i);
  }
  return x.slice(_i);
}

// Remove 0x-prefix if necessary
function pad0(x) { return x.substr(0, 2) === '0x' ? x.slice(2) : x; }