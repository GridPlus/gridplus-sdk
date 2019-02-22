import superagent from 'superagent';
import {
  decrypt,
  encrypt,
  deriveSecret,
  getKeyPair,
} from '../util';
const config = require('../config');
const debug = require('debug')('@gridplus/sdk:rest/client');

export default class Client {
  constructor({ baseUrl, crypto, name, privKey, httpRequest } = {}) {

    // Definitions
    // if (!baseUrl) throw new Error('baseUrl is required');
    if (!name) throw new Error('name is required');
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

    debug(`created rest client for ${this.baseUrl}`);
  }

  // `Connect` will attempt to contact a device based on its serial number
  // The response should include an ephemeral public key, which is used to
  // pair with the device in a later request
  connect(serial, cb) {
    this._request({ method: `connect/${serial}` }, (err, res) => {
      if (err) return cb(err);
      try {
        // Save the ephemeral public key for use with `pair`
        const data = JSON.parse(res);
        if (data.Err !== "") return cb(data.Err)
        else if (data.PairingSalt.length !== 64) return cb('Could not get salt from connect call. Please try again.');
        // If we have a pairing salt, save it as a buffer
        this.pairingSalt = Buffer.from(data.Salt, 'hex');
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
    const type = 'addPairing';
    const preImage = `${this.pairingSalt}${appSecret}`;
    const hash = this.crypto.createHash(preImage);
    const sig = this.key.sign(hash).toDER();
    const param = { Name: this.name , Sig: sig };

    return this._request('pair', param, (err, res) => {
      if (err) return cb(err);
      try {
        // Get the ephemeral public key
        const data = JSON.parse(res);
        if (data.Err !== "") return cb(data.Err);
        else if (data.NewEphemPubKey.length !== 66) return cb('Invalid response from device. Please call `connect` again.');
        this.ephemPub = data.newEphemPubKey;
        this.pairingSecret = null;
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
  _request({ method, param }, cb) {
    const url = `${this.baseUrl}/${method}`;
    if (this.httpRequest) {
      this.httpRequest(url, param)
      .then((res) => { cb(null, res) })
      .catch((err) => { cb(err); })
    } else {
      superagent.post(url)
      .send(param)
      .set('Accept', 'application/json')
      .then(res => { cb(null, res) })
      .catch(err => cb(err));
    }
  }

}