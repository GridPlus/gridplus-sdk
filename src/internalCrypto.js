// Encrypt and decrypt payloads
const crypto = require('crypto');
const eccrypto = require('eccrypto');

// Decrypt a payload
exports.decrypt = function(data, privKey, cb) {
  if (typeof data != 'object' || data.iv == undefined || data.ephemPublicKey == undefined
  || data.ciphertext == undefined || data.mac == undefined) {
    cb('Problem decrypting data');
  } else {
    eccrypto.decrypt(privKey, data)
    .then((text) => { cb(null, text); })
    .catch((err) => { cb(err); })
  }
}

// Make a signature
exports.ecsign = function(data, privKey, cb) {
  const msg = crypto.createHash('sha256').update(data).digest();
  eccrypto.sign(privKey, msg)
  .then((sig) => { cb(null, sig); })
  .catch((err) => { cb(err); }
}
