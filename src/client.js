const crc32 = require('crc-32');
const superagent = require('superagent');
const {
  aes256_decrypt,
  aes256_encrypt,
  checksum,
  getBitcoinAddress,
  getP256KeyPair,
  getP256KeyPairFromPub,
  parseLattice1Response,
  toPaddedDER,
} = require('./util');
const {
  ENC_MSG_LEN,
  addressSizes,
  currencyCodes,
  deviceCodes,
  encReqCodes,
  responseCodes,
  deviceResponses,
  MAX_NUM_ADDRS,
  REQUEST_TYPE_BYTE,
  VERSION_BYTE,
  messageConstants,
} = require('./constants');
const leftPad = require('left-pad');
const Buffer = require('buffer/').Buffer;
const config = require('../config');
const debug = require('debug')('@gridplus/sdk:client');

class Client {
  constructor({ baseUrl, crypto, name, privKey, providers, timeout } = {}) {
    // Definitions
    // if (!baseUrl) throw new Error('baseUrl is required');
    if (name && name.length > 24) throw new Error('name must be less than 24 characters');
    if (!crypto) throw new Error('crypto provider is required');
    this.baseUrl = baseUrl || config.api.baseUrl;
    this.crypto = crypto;
    this.name = name || 'Unknown';
    
    // Derive an ECDSA keypair using the p256 curve. The public key will
    // be used as an identifier
    this.privKey = privKey || this.crypto.randomBytes(32);
    this.key = getP256KeyPair(this.privKey);//.encode('hex');

    // Stateful params
    this.ephemeralPub = null;
    this.sharedSecret = null;
    this.timeout = timeout || 60000;
    this.deviceId = null;
    this.isPaired = false;

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
    const param = this._buildRequest(deviceCodes.CONNECT, this.pubKeyBytes());
    this._request(param, (err, res) => {
      if (err) return cb(err);
      try {
        this.isPaired = this._handleConnect(res);
        return cb(null);
      } catch (e) {
        return cb(e);
      }
    });
  }

  pair(pairingSecret, cb) {
    // Build the secret hash from the salt
    const pubKey = this.pubKeyBytes();
    const nameBuf = Buffer.alloc(25);
    if (this.name.length > 24) {
      return cb('Name is too many characters. Please change it to <25 characters.');
    }
    nameBuf.write(this.name);
    // Make sure we add a null termination byte to the pairing secret
    const preImage = Buffer.concat([pubKey, nameBuf, Buffer.from(pairingSecret)]);
    const hash = this.crypto.createHash('sha256').update(preImage).digest();
    const sig = this.key.sign(hash); // returns an array, not a buffer
    const derSig = toPaddedDER(sig);
    const payload = Buffer.concat([nameBuf, derSig]);

    // Build the request
    const param = this._buildEncRequest(encReqCodes.FINALIZE_PAIRING, payload);
    return this._request(param, (err, res) => {
      if (err) return cb(err);
      try {
        // Recover the ephemeral key
        const errStr = this._handlePair(res);
        return cb(errStr);
      } catch (e) {
        return cb(e);
      }
    })  
  }

  getAddresses(opts, cb) {
    const { currency, startIndex, n, version } = opts;
    if (currency === undefined || startIndex == undefined || n == undefined) {
      return cb({ err: 'Please provide `currency`, `startIndex`, and `n` options' });
    } else if (currencyCodes[currency] === undefined) {
      return cb({ err: 'Unsupported currency' });
    }
    const payload = Buffer.alloc(6);
    payload.writeUInt8(currencyCodes[currency]);
    payload.writeUInt32BE(startIndex, 1);
    payload.writeUInt8(n, 5);
    const param = this._buildEncRequest(encReqCodes.GET_ADDRESSES, payload);
    return this._request(param, (err, res) => {
      if (err) return cb({ err });
      const parsedRes = this._handleGetAddresses(res, currency, version);
      return cb(parsedRes);
    })
  }

  //=======================================================================
  // INTERNAL FUNCTIONS
  // These handle the logic around building requests and consuming
  // responses. They take into account the Lattice's serialization scheme
  // among other protocols.
  //=======================================================================

  // Get the shared secret, derived via ECDH from the local private key
  // and the ephemeral public key
  // @returns Buffer
  _getSharedSecret() {
    return Buffer.from(this.key.derive(this.ephemeralPub.getPublic()).toArray());
  }

  // Get the ephemeral id, which is the first 4 bytes of the shared secret
  // generated from the local private key and the ephemeral public key from
  // the device.
  // @returns Buffer
  _getEphemId() {
    if (this.ephemeralPub == null) return null;
    // EphemId is the first 4 bytes of the hash of the shared secret
    const secret = this._getSharedSecret();
    const hash = this.crypto.createHash('sha256').update(secret).digest();
    return hash.slice(0, 4);
  }

  _buildEncRequest(enc_request_code, payload) {
    // Get the ephemeral id - all encrypted requests require there to be an
    // epehemeral public key in order to send
    const ephemId = parseInt(this._getEphemId().toString('hex'), 16)
    let i = 0;
    // Prefix the payload with the encrypted request code
    const newPayload = Buffer.alloc(ENC_MSG_LEN + 4); // add 4 bytes for the checksum
    
    // Build the payload to be encrypted
    const payloadBuf = Buffer.alloc(ENC_MSG_LEN);
    const payloadPreCs = Buffer.concat([Buffer.from([enc_request_code]), payload]);
    const cs = checksum(payloadPreCs);
    // Lattice validates checksums in little endian
    payloadBuf.writeUInt8(enc_request_code, 0);
    payload.copy(payloadBuf, 1);

    payloadBuf.writeUInt32LE(cs, 1 + payload.length);
    // Encrypt this payload
    const secret = this._getSharedSecret();
   
    const newEncPayload = aes256_encrypt(payloadBuf, secret);

    // Write to the overall payload
    // First 4 bytes are the ephemeral id (in little endian)
    i = newPayload.writeUInt32LE(ephemId, i);
    // Next N bytes
    newEncPayload.copy(newPayload, 4);
    return this._buildRequest(deviceCodes.ENCRYPTED_REQUEST, newPayload);
  
  }

  // Build a request to send to the device.
  // @param [request_code] {uint8}  - 8-bit unsigned integer representing the message request code
  // @param [id] {buffer} - 4 byte identifier (comes from HSM for subsequent encrypted reqs)
  // @param [payload] {buffer} - serialized payload
  // @returns {buffer}
  _buildRequest(request_code, payload) {
    // Length of payload;
    // we add 1 to the payload length to account for the request_code byte
    let L = payload && Buffer.isBuffer(payload) ? payload.length + 1 : 1;
    if (request_code == deviceCodes.ENCRYPTED_REQUEST) {
      L = 1 + payload.length;
    }
    let i = 0;
    const preReq = Buffer.alloc(L + 8);
    // Build the header
    i = preReq.writeUInt8(VERSION_BYTE, i);
    i = preReq.writeUInt8(REQUEST_TYPE_BYTE, i);
    const id = this.crypto.randomBytes(4);
    i = preReq.writeUInt32BE(parseInt(`0x${id.toString('hex')}`), i);
    i = preReq.writeUInt16BE(L, i);
    // Build the payload
    i = preReq.writeUInt8(request_code, i);
    if (L > 1) i = payload.copy(preReq, i);
    // Add the checksum
    const cs = checksum(preReq);
    const req = Buffer.alloc(preReq.length + 4); // 4-byte checksum
    i = preReq.copy(req);
    req.writeUInt32BE(cs, i);
    return req;
  }

  _request(data, cb) {
    if (!this.deviceId) return cb('Serial is not set. Please set it and try again.');
    const url = `${this.baseUrl}/${this.deviceId}`;
    superagent.post(url).timeout(this.timeout)
    .send({data})
    .then(res => {
      if (!res || !res.body) return cb(`Invalid response: ${res}`)
      else if (res.body.status !== 200) return cb(`Error code ${res.body.status}: ${res.body.message}`)
      const parsed = parseLattice1Response(res.body.message);
      if (parsed.err) return cb(parsed.err);
      return cb(null, parsed.data) 
    })
    .catch(err => { return cb(err)});
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

  // Connect will call `StartPairingMode` on the device, which gives the
  // user 60 seconds to finalize the pairing
  // This will return an ephemeral public key, which is needed for the next
  // request. If the device is already paired, this ephemPub is simply used
  // to encrypt the next request. If the device is not paired, it is needed
  // to pair the device within 60 seconds.
  // @returns true if we are paired to the device already
  _handleConnect(res) {
    let off = 0;
    const pairingStatus = res.readUInt8(off); off++;
    // If we are already paired, we get the next ephemeral key
    const pub = res.slice(off, res.length).toString('hex');
    this.ephemeralPub = getP256KeyPairFromPub(pub);
    // return the state of our pairing
    return (pairingStatus === messageConstants.PAIRED);
  }

  // Pair will create a new pairing if the user successfully enters the secret
  // into the device in time. If successful (status=0), the device will return
  // a new ephemeral public key, which is used to derive a shared secret
  // for the next request
  // @returns error (or null)
  _handlePair(encRes) {
    const secret = this._getSharedSecret();
    const encData = encRes.slice(0, ENC_MSG_LEN);
    const res = aes256_decrypt(encData, secret);
    // Decrypted response is [pubKey|checksum]
    const pubBuf = res.slice(0, 65);
    const pub = pubBuf.toString('hex');
    const cs = parseInt(`0x${res.slice(65, 69).toString('hex')}`);
    // Verify checksum on returned pubkey
    const csCheck = checksum(pubBuf);
    if (cs !== csCheck) return `Checksum mismatch in response from Lattice (got ${cs}, wanted ${csCheck})`;
    try {
      this.ephemeralPub = getP256KeyPairFromPub(pub); 
      // Remove the pairing salt - we're paired!
      this.pairingSalt = null;
      this.isPaired = true;
      return null;
    } catch (err) {
      return `Error handling pairing response: ${err.toString()}`;
    }
  }

  // GetAddresses will return an array of pubkey hashes
  _handleGetAddresses(encRes, currency, version='LEGACY') {
    // Decrypt response
    const secret = this._getSharedSecret();
    const encData = encRes.slice(0, ENC_MSG_LEN);
    const res = aes256_decrypt(encData, secret);
    let off = 0;

    // Get the size of each expected address
    if (addressSizes[currency] === undefined) return { err: 'Unsupported currency' };
    const addrSize = addressSizes[currency];
    
    // Validate checksum
    const resLen = 66 + (addrSize * MAX_NUM_ADDRS); // PubkeyLen (65 bytes) + NumAddrs (1 byte) + Addresses
    const toCheck = res.slice(0, resLen);
    const cs = parseInt(`0x${res.slice(resLen, resLen + 4).toString('hex')}`);
    const csCheck = checksum(toCheck);
    if (cs !== csCheck) return { err: `Checksum mismatch in response from Lattice (calculated ${csCheck}, wanted ${cs})` };

    // First 65 bytes is the next ephemeral pubkey
    const pub = res.slice(off, 65).toString('hex'); off += 65;
    
    // After that, we can start parsing the addresses
    // Number of addresses
    const numAddr = parseInt(res[off]); off++;
    let addrs = [];
    // Get the addresses
    for (let i = 0; i < numAddr; i++) {
      // Get the address-like data (depends on currnecy) -- data is in little endian
      // so we need to endian flip it
      const d = res.slice(off, off + addrSize).reverse();
      let addr;
      switch (currency) {
        case 'BTC':
          addr = getBitcoinAddress(d, version);
          if (addr === null) return { err: 'Unsupported version byte' };
          break;
        case 'ETH':
          addr = `0x${d.toString('hex')}`;
          break;
        default:
          return { err: 'Unsupported currency' };
      }
      addrs.push(addr);
      off += addrSize;
    }
    try {
      this.ephemeralPub = getP256KeyPairFromPub(pub);
      return { data: addrs, err: null };
    } catch (err) {
      return { err: `Error handling getAddresses response: ${err.toString()}` };
    }
  }

  // Get 64 bytes representing the public key
  // This is the uncompressed key without the leading 04 byte
  pubKeyBytes(LE=false) {
    const k = this.key.getPublic();
    const p = k.encode('hex');
    const pb = Buffer.from(p, 'hex');
    if (LE === true) {
      // Need to flip X and Y components to little endian
      const x = pb.slice(1, 33).reverse();
      const y = pb.slice(33, 65).reverse();
      return Buffer.concat([pb[0], x, y]);
    } else {
      return pb;
    }
  }

}

module.exports = Client;