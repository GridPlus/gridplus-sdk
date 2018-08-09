import superagent from 'superagent';
import {
  decrypt,
  encrypt,
  deriveSecret,
  ecdhKeyPair,
  ecdsaKeyPair,
} from '../util';

const debug = require('debug')('@gridplus/sdk:rest/client');

export default class Client {
  constructor({ baseUrl, crypto, name, privKey } = {}) {
    if (!baseUrl) throw new Error('baseUrl is required');
    if (!name) throw new Error('name is required');
    if (!crypto) throw new Error('crypto provider is required');

    this.baseUrl = baseUrl;
    this.crypto = crypto;
    this.name = name;
    this.privKey = privKey || this.crypto.generateEntropy();

    this.key = ecdsaKeyPair(this.privKey);
    this.pubKey = this.key.getPublic().encode('hex');
    // The ECDH public key will be used for creating usage tokens by the k81
    // It is a DIFFERENT public key than the one being used to sign messages!
    this.ecdhPub = ecdhKeyPair(this.privKey).getPublic().encode('hex');

    this.counter = 5;
    this.headerSecret = null;
    this.sharedSecret = null;

    this.timeout = null;
    this.timeoutMs = 5000;

    debug(`created rest client for ${this.baseUrl}`);
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
      const data = this._createRequestData(param, id, type);
      return this.request('pair', { key: this.ecdhPub, data, id }, (err, res) => {
        if (err) return cb(err);
        return this._decryptResponse(res, cb);
      });
    } catch (err) {
      return cb(err);
    }
  }

  pairedRequest(method, { param = {}, id = this._newId() }, cb) {
    try {
      const data = this._createRequestData(param, id, method);
      return this.request(method, { key: this.ecdhPub, data, id }, (err, res) => {
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
      if (err) return cb(err);
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
    const request = {
      ecdhKey: this.ecdhPub,
      body: encBody,
      id,
      pubKey: this.pubKey.toString('hex'),
    };
    return encrypt(JSON.stringify(request), this.headerSecret, this.counter);
  }

  _decryptResponse(res, cb) {
    const encryptedResult = decrypt(res.result, this.headerSecret, this.counter);
    try {
      res.result = JSON.parse(encryptedResult);
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
    if (result.headerKey) {
      this.headerSecret = deriveSecret(this.privKey, result.headerKey);
    }
    let token = decrypt(result.newToken || result, this.headerSecret, this.counter);
    token = JSON.parse(token);

    // Hacky parsing of different return schema
    // MWW NOTE: Alex, can we replace this with just always replying with the same return param structure (json)?
    // MWW NOTE: Actually, I'm not noticing any string tokens returned. Can we nuke this and use the object version only?
    if (typeof token === 'string') {
      token = JSON.parse(decrypt(token, this.headerSecret, this.counter));
    } else if (token.data === undefined) {
      token = { data: token };
    }

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
    superagent.post(url)
      .send(param)
      .set('Accept', 'application/json')
      .then(res => cb(null, res))
      .catch(err => cb(err));
  }
}