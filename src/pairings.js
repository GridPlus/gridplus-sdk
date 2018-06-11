/*
// Add, update, delete, or get pairings with devices
const internalCrypto = require('./internalCrypto.js');
const enums = require('./enums.js');

// Add a pairing by signing the secret shown on the device (and typed into the app)
exports.add = function(opts, privKey, reqFunc, cb) {
  const { appSecret, deviceSecret, name, device } = opts;
  const fullSecret = `${deviceSecret}${appSecret}`;
  internalCrypto.ecsign(fullSecret, privKey, (err, sig) => {
    if (err) { cb(err); }
    else {
      const payload = [name, sig];
      const data = enums.formatArr(payload);
      reqFunc('addPairing', data, device, cb);
    }
  })
}

// Remove a pairing
exports.del = function(device, reqFunc, cb) {
  reqFunc('delPairing', {}, device, cb);
}
*/