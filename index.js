const eccrypto = require('eccrypto');
const internalCrypto = require('./src/internalCrypto.js');

class GridPlusSDK {
  constructor(opts) {
    this.host = opts.host;
    if (opts.key.length != 32) { throw new Error('Wrong key size (must be 32 bytes)'); }
    else {
      this.privKey = Buffer.from(opts.key, 'hex');
      this.pubKey = eccrypto.getPublic(privKey);
    }
    // Devices can be indexed using whatever key the user desires.
    this.devices = {};
  }

  //============================================================================
  // COMMS WITH AGENT
  //============================================================================

  request(endpoint, payload, cb) {

  }

  //============================================================================
  // SYNC REQUESTS
  //
  // These requests are synchronous in that the response is returned with the
  // request (i.e. the request is not queued in the agent)
  //============================================================================

  // Get the public header key to encrypt async requests
  getHeaderKey(cb) {
    this.request('getHeaderKey', {}, (err, key) => {
      if (err) { cb(err); }
      else {
        this.headerKey = key;
        cb(null, key);
      }
    });
  }

  // Get an access token once you are paired
  getToken(cb) {
    this.request('getToken', { pubKey: this.pubKey }, (err, encToken) => {
      if (err) { cb(err); }
      else {
        // Returns an encrypted token
        internalCrypto.decrypt(encToken, this.privKey, (err, decToken) => {
          if (err) { cb(err); }
          else {
            this.token = decToken;
            cb(null, decToken);
          }
        });
      }
    });
  }

  // Get the response of a request given an id
  getResponse(id, cb) {
    this.request('getResponse', { id: id }, cb);
  }

  //============================================================================
  // ASYNC REQUESTS
  //
  // Each of these requires a token to be generated and then stored (via getToken).
  // The response will contain a request id, which can be used with getResponse
  // to get the return payload once the request passes through the agent's queue.
  //============================================================================

  // Add a pairing
  addPairing(opts, cb) {
    const { deviceSecret, appSecret, name } = opts;
    pairings.add(deviceSecret, appSecret, name, this.privKey, this.request, cb);
  }

  // Remove a pairing
  deletePairing(cb) {
    pairings.del(this.request, cb);
  }

  // Create a permission given a pairing
  addPermission(opts, cb) {
    const { schema, type, rules, timeLimit } = opts;

  }


}
