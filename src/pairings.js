// Add, update, delete, or get pairings with devices
const internalCrypto = require('./internalCrypto.js');

// Add a pairing by signing the secret shown on the device (and typed into the app)
exports.add = function(appSecret, deviceSecret, name, privKey, reqFunc, cb) {
  const fullSecret = `${deviceSecret}${appSecret}`;
  internalCrypto.ecsign(fullSecret, privKey, (err, sig) => {
    if (err) { cb(err); }
    else {
      const payload = {
        name: name,
        sig: sig,
      }
      reqFunc('addPairing', payload, cb);
    }
  })
}

// Remove a pairing
exports.del = function(reqFunc, cb) {
  reqFunc('delPairing', {}, cb);
}
