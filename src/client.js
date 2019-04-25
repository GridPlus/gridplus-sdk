const crc32 = require('crc-32');
const superagent = require('superagent');
const {
  // decrypt,
  // encrypt,
  // deriveSecret,
  getP256KeyPair,
  parseLattice1Response,
} = require('./util');
const {
  deviceCodes,
  responseCodes,
  deviceResponses,
  REQUEST_TYPE_BYTE,
  VERSION_BYTE,
} = require('./constants');
const leftPad = require('left-pad');
const Buffer = require('buffer/').Buffer;
const config = require('../config');
const debug = require('debug')('@gridplus/sdk:client');

class Client {
  constructor({ baseUrl, crypto, name, privKey, httpRequest, providers } = {}) {
    // Definitions
    // if (!baseUrl) throw new Error('baseUrl is required');
    if (name && name.length > 20) throw new Error('name must be <20 characters');
    if (!crypto) throw new Error('crypto provider is required');
    if (httpRequest) this.httpRequest = httpRequest;
    this.baseUrl = baseUrl || config.api.baseUrl;
    this.crypto = crypto;
    this.name = name || 'Unknown';
    
    // Derive an ECDSA keypair using the p256 curve. The public key will
    // be used as an identifier
    this.privKey = privKey || this.crypto.randomBytes(32);
    this.pubKey = getP256KeyPair(this.privKey).getPublic();//.encode('hex');

    // Pairing salt is retrieved from calling `connect` on the device. This
    // is only valid for 60 seconds and is not used once we pair.
    this.pairingSalt = null;

    // Config stuff
    this.counter = 5;
    this.timeoutMs = 5000;

    // Stateful params
    this.ephemeralPub = null;
    this.sharedSecret = null;
    this.timeout = null;
    this.deviceId = null;

    // Crypto node providers
    this.providers = {};
    (providers || []).map((provider) => {
      this.providers[provider.shortcode] = provider;
    });

    debug(`created rest client for ${this.baseUrl}`);
  }
  //=======================================================================
  // LATTICE FUNCTIONS
  //=======================================================================

  // `Connect` will attempt to contact a device based on its deviceId.
  // The response should include an ephemeral public key, which is used to
  // pair with the device in a later request
  connect(deviceId, cb) {
    this.deviceId = deviceId;
    // Build the request
    const param = this._buildRequest(deviceCodes.CONNECT, this.pubKeyBytes());
    // const param = this._buildRequest(deviceCodes.CONNECT, null);    
    this._request(param, (err, res) => {
      if (err) return cb(err);
      try {
        if (res[0] !== deviceCodes.CONNECT) return cb('Incorrect code returned from device. Please try again.');
        // If there are no errors, recover the salt
        const success = this._handleConnect(res);
        if (!success) return cb('Could not handle response from device. Please try again.');
        return cb(null);
      } catch (e) {
        return cb(e);
      }
    });
  }

  // `Pair` requires a `pairingSalt` and a secret
  pair(pairingSecret, cb) {
    // Ensure app secret is valid
    if (
      typeof pairingSecret !== 'string' || 
      pairingSecret.length !== config.APP_SECRET_LEN || 
      !util.checkPairingSecret(pairingSecret)
    ) return cb('Invalid app secret.');

    // Ensure we have a pairing secret
    if (!this.pairingSecret) return cb('Unable to pair. Please call `connect` to initialize pairing process.');

    // Build the secret hash from the salt
    const preImage = `${this.pubKey}${this.name}${pairingSecret}${this.pairingSalt}`;
    const hash = this.crypto.createHash(preImage);
    const sig = this.key.sign(hash).toDER();
    
    // The payload adheres to the serialization format of the PAIR route
    const payload = `${this.pubKey}${sig}${this.name}`;
    
    // Build the request
    const param = this._buildRequest(deviceCodes.FINALIZE_PAIRING, Buffer.from(payload, 'hex'));

    return this._request(param, (err, res) => {
      if (err) return cb(err);
      try {
        if (res[0] !== deviceCodes.FINALIZE_PAIRING) return cb('Incorrect code returned from device. Please try again.');
        // Recover the ephemeral key
        const success = this._handlePair(res);
        if (!success) return cb('Could not handle response from device. Please try again.');
        return cb(null);
      } catch (e) {
        return cb(e);
      }
    })
  }

  //=======================================================================
  // PROVIDER FUNCTIONS
  // These functions interact directly with the node providers (e.g. BTC or ETH)
  // and do not interact with the lattice. They will only work if the 
  // client has been instantated with providers
  //=======================================================================

  getBalance(shortcode, options, cb) {
    if (!this.providers[shortcode])
      return cb(new Error(`no provider loaded for shortcode ${shortcode}`));
    return this.providers[shortcode].getBalance(options, cb);
  }

  getTokenBalance(options, cb) {
    if (!this.providers['ETH'])
      return cb(new Error('Cannot request token balance. ETH provider is not set.'))
    return this.providers['ETH'].getTokenBalance(options, cb);
  }

  getTxHistory(shortcode, options, cb) {
    if (!this.providers[shortcode])
      return cb(new Error(`no provider loaded for shortcode ${shortcode}`));
    return this.providers[shortcode].getTxHistory(options, cb);
  }

  // Get (one or more) transaction(s) and return (one or more) object(s) that conform to a common schema across currencies
  getTx(shortcode, hashes, opts, cb) {
    if (!this.providers[shortcode])
      return cb(new Error(`no provider loaded for shortcode ${shortcode}`));
    return this.providers[shortcode].getTx(hashes, cb, opts);
  }

  //=======================================================================
  // INTERNAL FUNCTIONS
  // These handle the logic around building requests and consuming
  // responses. They take into account the Lattice's serialization scheme
  // among other protocols.
  //=======================================================================

  // Build a request to send to the device.
  // @param [request_code] {uint8}  - 8-bit unsigned integer representing the message request code
  // @param [payload] {buffer} - serialized payload
  // @returns {buffer}
  _buildRequest(request_code, payload) {
    // Length of payload;
    // we add 1 to the payload length to account for the request_code byte
    const L = payload && Buffer.isBuffer(payload) ? payload.length + 1 : 1;
    let i = 0;
    const preReq = Buffer.alloc(L + 8);
    const id = this.crypto.randomBytes(4);
    // Build the header
    i = preReq.writeUInt8(VERSION_BYTE, i);
    i = preReq.writeUInt8(REQUEST_TYPE_BYTE, i);
    i = preReq.writeUInt32BE(parseInt(`0x${id.toString('hex')}`), i);
    i = preReq.writeUInt16BE(L, i);
    // Build the payload
    i = preReq.writeUInt8(request_code, i);
    if (L > 1) i = payload.copy(preReq, i);
    // Add the checksum
    // crc32 returns a signed integer - need to cast it to unsigned
    // Note that this uses the default 0xedb88320 polynomial
    const cs = crc32.buf(preReq) >>> 0; // Need this to be a uint, hence the bit shift
    const req = Buffer.alloc(preReq.length + 4); // 4-byte checksum
    i = preReq.copy(req);
    req.writeUInt32BE(cs, i);
    return req;
  }

/*
  pairedRequest(method, { param = {}, id = this._newId() }, cb) {
    try {
      const req = this._createRequestData(param, id, method);
      return this.request(method, req, (err, res) => {
        if (err) return cb(err);
        return this._decryptResponse(res, cb);
      });
    } catch (err) {
      return cb(err);
    }
  }

  request(method, param, cb) {
    if (typeof param === 'function') {
      cb = param;
      param = null;
    }
    param = param || {};

    param.key = param.key || this.ecdhPub;
    // param.key = this.ecdhPub;
    param.data = param.data || null;
    param.id = param.id || this._newId();

    debug(`requesting ${method} ${JSON.stringify(param)}`);

    return this._request({ method, param }, (err, res) => {
      if (err) return cb(err)
      else if (!res || !res.body || !res.body.result) return cb('Could not get a response from the device.');
      try {
        this._prepareNextRequest(res.body.result);
      } catch (err) {
        return cb(err);
      }
      return cb(null, res.body);
    });
  }

  _createRequestData(data, id, type) {
    const req = JSON.stringify(data);
    const msg = this.crypto.createHash(`${id}${type}${req}`);
    const body = JSON.stringify({
      data: req,
      sig: this.key.sign(msg).toDER(),
      type,
    });

    debug(`creating request data: ${JSON.stringify(data)} id: ${id} type: ${type}`);

    const encBody = encrypt(body, this.sharedSecret, this.counter);
    return {
      body: encBody,
      id,
    };
  }

  _decryptResponse(res, cb) {
    try {
      res.result = JSON.parse(res.result);
    } catch (err) {
      return cb(err);
    }
    return cb(null, res);
  }

  _newId() {
    // if we have a shared secret, derive a new id from it. else use random bytes.
    if (this.sharedSecret === null) {
      return this.crypto.randomBytes(32);
    }
    return this.crypto.createHash(this.sharedSecret).toString('hex');
  }

  _prepareNextRequest(result) {
    token = JSON.parse(result.newToken);

    if (token.data.status && token.data.status !== 200) throw new Error(`remote agent signing error: status code: ${token.data.status} message: ${token.data.message}`);
    if (
      (token.data && token.data.counter && token.data.ephemPublicKey) ||
      (token.data.newToken && token.data.newToken.counter && token.data.newToken.ephemPublicKey)
    ) {
      this.counter = token.data.counter || token.data.newToken.counter;
      this.sharedSecret = deriveSecret(this.privKey, token.data.ephemPublicKey || token.data.newToken.ephemPublicKey).toString('hex');
    }
  }
*/
  _request(data, cb) {
    if (!this.deviceId) return cb('Serial is not set. Please set it and try again.');
    const url = `${this.baseUrl}/${this.deviceId}`;
    if (this.httpRequest) {
      this.httpRequest(url, data)
      .then((res) => {
        // Check for an error code
        parseLattice1Response(res);
        const resCode = this._getResponseCode(res);
        if (resCode) return cb(`Error from device: ${resCode}`)
        // If there is no error, return the response payload
        return cb(null, res) 
      })
      .catch((err) => { return cb(err); })
    } else {
      superagent.post(url)
      .send({data})
      // .set('Accept', 'application/json')
      .then(res => {
        if (!res || !res.body) return cb(`Invalid response: ${res}`)
        else if (res.body.status !== 200) return cb(`Error code ${res.body.status}: ${res.body.message}`)
        console.log('res.body.message', res.body.message)
        const resCode = this._getResponseCode(res.body.message);
        if (resCode) return cb(`Error from device: ${resCode}`);
        cb(null, res.body); 
      })
      .catch(err => { cb(err)});
    }
  }

  // Determine the response code
  _getResponseCode(res) {
    if (res.length < deviceResponses.START_DATA_IDX) return 'Invalid Response';
    try {
      const code = parseInt(res.slice(deviceResponses.START_CODE_IDX, deviceResponses.START_DATA_IDX)).toString('hex');
      if (code == responseCodes.SUCCESS) return null;
      return responseCodes[code];
    } catch (err) {
      return 'Could not parse response from device';
    }
  }

  // ----- Device response handlers -----

  // Connect will call `StartPairingMode` on the device, which returns salt
  // which is good for 60 seconds to make a pairing with
  _handleConnect(res) {
    const salt = res.slice(deviceResponses.START_DATA_IDX);
    if (salt.length !== 32) return false;
    this.pairingSalt = salt;
    return true;
  }

  // Pair will create a new pairing if the user successfully enters the secret
  // into the device in time. If successful (status=0), the device will return
  // a new ephemeral public key, which is used to derive a shared secret
  // for the next request
  _handlePair(res) {
    const newEphemPubKey = res.slice(deviceResponses.START_DATA_IDX);
    if (newEphemKey.length !== 33) return false;
    this.ephemPub = newEphemPubKey;
    this.pairingSecret = null;
    return true;
  }

  pubKeyBytes() {
    const x = this.pubKey.getX().toBuffer();
    const y = this.pubKey.getY().toBuffer();
    return Buffer.concat([x, y])
  }

}

module.exports = Client;