// Static utility functions
const aes = require('aes-js');
const leftPad = require('left-pad');
const EC = require('elliptic').ec;
const ec = new EC('curve25519');

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

// Derive a shared secret using ECDH via curve25519
exports.deriveSecret = function(privKey, pubKey) {
  if (typeof privKey !== 'string') privKey = privKey.toString('hex');
  if (typeof pubKey !== 'string') pubKey = pubKey.toString('hex');
  const privInst = ec.keyFromPrivate(privKey, 'hex');
  const pubInst = ec.keyFromPublic(pubKey, 'hex');
  return privInst.derive(pubInst.getPublic()).toString('hex');
}

// Decrypt using an AES secret and a counter
exports.decrypt = function(secret, payload, counter=5) {
  if (typeof secret === 'string') secret = Buffer.from(secret, 'hex');
  const b = aes.utils.hex.toBytes(payload);
  const aesCtr = new aes.ModeOfOperation.ctr(secret, new aes.Counter(counter));
  const dec = aesCtr.decrypt(b);
  return aes.utils.utf8.fromBytes(dec);
}

exports.encrypt = function(secret, payload, counter=5) {
  if (typeof secret === 'string') secret = Buffer.from(secret, 'hex');
  const b = aes.utils.utf8.toBytes(payload);
  const aesCtr = new aes.ModeOfOperation.ctr(secret, new aes.Counter(counter));
  const enc = aesCtr.encrypt(b);
  return aes.utils.hex.fromBytes(enc);
}

// Remove 0x-prefix if necessary
function pad0(x) { return x.substr(0, 2) === '0x' ? x.slice(2) : x; }