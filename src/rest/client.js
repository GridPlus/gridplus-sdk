import superagent from 'superagent';
import {
  decrypt,
  encrypt,
  deriveSecret,
  ecdhKeyPair,
  ecdsaKeyPair,
} from '../util';
const config = require('../config');
const debug = require('debug')('@gridplus/sdk:rest/client');

export default class Client {
  constructor({ baseUrl, crypto, name, privKey, httpRequest } = {}) {
    // if (!baseUrl) throw new Error('baseUrl is required');
    if (!name) throw new Error('name is required');
    if (!crypto) throw new Error('crypto provider is required');
    if (httpRequest) this.httpRequest = httpRequest;
    this.baseUrl = baseUrl || config.api.baseUrl;
    this.crypto = crypto;
    this.name = name;
    this.privKey = privKey || this.crypto.generateEntropy();

    this.key = ecdsaKeyPair(this.privKey);
    this.pubKey = this.key.getPublic().encode('hex');
    // The ECDH public key will be used for creating usage tokens by the k81
    // It is a DIFFERENT public key than the one being used to sign messages!
    this.ecdhPub = ecdhKeyPair(this.privKey).getPublic().encode('hex');

    this.counter = 5;
    this.sharedSecret = null;

    this.timeout = null;
    this.timeoutMs = 5000;

    debug(`created rest client for ${this.baseUrl}`);
  }

  // `Connect` will attempt to contact a device based on its serial number
  // The response should include an ephemeral public key, which is used to
  // pair with the device in a later request
  connect(serial, cb) {
    this._request({ method: `connect/${serial}`, params: this.pubKey }, (err, res) => {
      if (err) return cb(err);
      try {
        // Save the ephemeral public key for use with `pair`
        const data = JSON.parse(res);
        deriveSecret(this.privKey, data.Key);
        return cb(null);
      } catch (e) {
        return cb(e);
      }
    });
  }

  pair(appSecret, cb) {
    if (typeof appSecret === 'function') {
      cb = appSecret;
      appSecret = null;
    }

    if (appSecret) {
      this.appSecret = appSecret;
    }

    const id = this._newId();
    const type = 'addPairing';
    const preImage = `${this.sharedSecret}${this.appSecret}`;

    try {
      const hash = this.crypto.createHash(preImage);
      const sig = this.key.sign(hash).toDER();
      const param = { name: this.name , sig };
      const req = this._createRequestData(param, id, type);
      return this.request('pair', req, (err, res) => {
        if (err) return cb(err);
        return this._decryptResponse(res, cb);
      });
    } catch (err) {
      return cb(err);
    }
  }

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

  _genAppSecret() {
    if (! this.appSecret) {
      this.appSecret = process.env.APP_SECRET; // temp step toward refactoring out to env var
    }
    return this.appSecret;
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