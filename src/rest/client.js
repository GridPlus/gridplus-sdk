import superagent from 'superagent';
import {
  // decrypt,
  // encrypt,
  // deriveSecret,
  getP256KeyPair,
  deviceCodes,
  deviceResponses,
} from '../util';
const Buffer = require('buffer/').Buffer;
const config = require('../config');
const debug = require('debug')('@gridplus/sdk:rest/client');

export default class Client {
  constructor({ baseUrl, crypto, name, privKey, httpRequest } = {}) {
    // Definitions
    // if (!baseUrl) throw new Error('baseUrl is required');
    if (!name) throw new Error('name is required')
    else if (name.length > 20) throw new Error('name must be <20 characters');
    if (!crypto) throw new Error('crypto provider is required');
    if (httpRequest) this.httpRequest = httpRequest;
    this.baseUrl = baseUrl || config.api.baseUrl;
    this.crypto = crypto;
    this.name = name;
    
    // Derive an ECDSA keypair using the p256 curve. The public key will
    // be used as an identifier
    this.privKey = privKey || this.crypto.generateEntropy();
    this.keyPair = getP256KeyPair(this.privKey).getPublic().encode('hex');

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
    this.serial = null;

    debug(`created rest client for ${this.baseUrl}`);
  }

  // `Connect` will attempt to contact a device based on its serial number
  // The response should include an ephemeral public key, which is used to
  // pair with the device in a later request
  connect(serial, cb) {
    this.serial = serial;
    // The payload is simply the START_PAIRING_MODE route code
    const param = deviceCodes.START_PAIRING_MODE;
    this._request(param, (err, res) => {
      if (err) return cb(err);
      try {
        if (res[0] !== deviceCodes.START_PAIRING_MODE) return cb('Incorrect code returned from device. Please try again.');
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
  pair(appSecret, cb) {
    // Ensure app secret is valid
    if (
      typeof appSecret !== 'string' || 
      appSecret.length !== config.APP_SECRET_LEN || 
      !util.checkAppSecret(appSecret)
    ) return cb('Invalid app secret. Please call `newAppSecret` for a valid one.');

    // Ensure we have a pairing secret
    if (!this.pairingSecret) return cb('Unable to pair. Please call `connect` to initialize pairing process.');

    // Build the secret hash from the salt
    const preImage = `${this.pairingSalt}${appSecret}`;
    const hash = this.crypto.createHash(preImage);
    const sig = this.key.sign(hash).toDER();

    // The payload adheres to the serialization format of the PAIR route
    const param = `${deviceCodes.PAIR}${sig}${this.name.length}${this.name}`;

    return this._request(param, (err, res) => {
      if (err) return cb(err);
      try {
        if (res[0] !== deviceCodes.PAIR) return cb('Incorrect code returned from device. Please try again.');
        // Recover the ephemeral key
        const success = this._handlePair(res);
        if (!success) return cb('Could not handle response from device. Please try again.');
        return cb(null);
      } catch (e) {
        return cb(e);
      }
    })
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
    if (!this.serial) return cb('Serial is not set. Please set it and try again.');
    const url = `${this.baseUrl}/${this.serial}`;
    if (this.httpRequest) {
      this.httpRequest(url, data)
      .then((res) => { 
        if (!_responseChecks(res)) return cb('Invalid response from device. Please try again.')
        else if (_responseStatus(res) !== 0) return cb(`Error from device: status ${_responseStatus(res)}`);
        return cb(null, res) 
      })
      .catch((err) => { return cb(err); })
    } else {
      superagent.post(url)
      .send(data)
      .set('Accept', 'application/json')
      .then(res => { 
        if (!_responseChecks(res)) return cb('Invalid response from device. Please try again.')
        else if (_responseStatus(res) !== 0) return cb(`Error from device: status ${_responseStatus(res)}`);
        cb(null, res); 
      })
      .catch(err => cb(err));
    }
  }

  // Pass sanity checks on data returned from the device
  _responseChecks(res) {
    return Buffer.isBuffer(res) && res.length < deviceResponses.START_DATA_IDX && status === 0;
  }
  
  // Check if there is a non-zero status code from the device
  // Success is 0, error is anything else
  _responseStatus(res) {
    return parseInt(res.slice(deviceResponses.START_CODE_IDX, deviceResponses.START_DATA_IDX).toString('hex'));
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

}