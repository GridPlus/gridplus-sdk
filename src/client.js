const superagent = require('superagent');
const bitcoin = require('./bitcoin');
const ethereum = require('./ethereum');
const {
  txBuildingResolver,
  aes256_decrypt,
  aes256_encrypt,
  parseDER,
  checksum,
  getP256KeyPair,
  getP256KeyPairFromPub,
  parseLattice1Response,
  toPaddedDER,
} = require('./util');
const {
  ENC_MSG_LEN,
  addressSizes,
  currencyCodes,
  decResLengths,
  deviceCodes,
  encReqCodes,
  responseCodes,
  deviceResponses,
  REQUEST_TYPE_BYTE,
  VERSION_BYTE,
  messageConstants,
  BASE_URL,
} = require('./constants');
const Buffer = require('buffer/').Buffer;

class Client {
  constructor({ baseUrl, crypto, name, privKey, providers, timeout } = {}) {
    // Definitions
    // if (!baseUrl) throw new Error('baseUrl is required');
    if (name && name.length > 24) throw new Error('name must be less than 24 characters');
    if (!crypto) throw new Error('crypto provider is required');
    this.baseUrl = baseUrl || BASE_URL;
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
    const { currency, startPath, n, version="SEGWIT" } = opts;
    if (currency === undefined || startPath == undefined || n == undefined || startPath.length != 5) {
      return cb('Please provide `currency`, `startPath`, and `n` options');
    } else if (currencyCodes[currency] === undefined) {
      return cb('Unsupported currency');
    }
    // Bitcoin requires a version byte
    if (currency === 'BTC' && bitcoin.addressVersion[version] === undefined) {
      return cb('Unsupported Bitcoin version. Options are: LEGACY, SEGWIT, TESTNET, SEGWIT_TESTNET');
    }
    // Bitcoin segwit addresses require a P2SH_P2WPKH script type -- the script type
    // is otherwise ignored and is only needed for BTC
    const bitcoinScriptType = (version === 'SEGWIT' || version === 'SEGWIT_TESTNET') ? 
                              bitcoin.scriptTypes.P2SH_P2WPKH: 0;

    const payload = Buffer.alloc(3 + startPath.length * 4);
    let off = 0;
    payload.writeUInt8(currencyCodes[currency]); off++;
    for (let i = 0; i < startPath.length; i++) {
      payload.writeUInt32BE(startPath[i], off);
      off += 4;
    }
    payload.writeUInt8(n, off); off++;
    payload.writeUInt8(bitcoinScriptType || 0, off); off++;
    const param = this._buildEncRequest(encReqCodes.GET_ADDRESSES, payload);
    return this._request(param, (err, res) => {
      if (err) return cb(err);
      const parsedRes = this._handleGetAddresses(res, currency, n, bitcoin.addressVersion[version]);
      if (parsedRes.err) return cb(parsedRes.err);
      return cb(null, parsedRes.data);
    })
  }

  sign(opts, cb) {
    // [TODO] Build transaction serialization util for Bitcoin
    //        (note that version=2 and lockTime=0)
    // [TODO] Return serialized transations + signatures (if necessary)
    //        (the response should be all the user needs to broadcast the tx)
    const { currency, data } = opts;
    if (currency == undefined || data == undefined) {
      return cb('Please provide `currency` and `data` options');
    } else if (currencyCodes[currency] === undefined) {
      return cb('Unsupported currency');
    }

    // Build the transaction payload to send to the device. If we catch
    // bad params, return an error instead
    const tx = txBuildingResolver[currency](data);
    if (tx.err !== undefined) return cb({ err: tx.err });
    // All transaction requests must be put into the same sized buffer
    // so that checksums may be validated. The full size is 530 bytes,
    // but that includes a 1-byte prefix (`SIGN_TRANSACTION`), 2 bytes
    // indicating the schema type, and 4 bytes for a checksum.
    // That leaves 514 bytes for the transaction request. It will be
    // deserialized according to the schema type and extra zeros will be
    // discarded.
    const MAX_TX_REQ_DATA_SIZE = 557;
    if (tx.payload.length > MAX_TX_REQ_DATA_SIZE) {
      return cb('Transaction is too large');
    }

    // Build the payload
    const payload = Buffer.alloc(2 + MAX_TX_REQ_DATA_SIZE);
    payload.writeUInt16BE(tx.schema, 0);
    tx.payload.copy(payload, 2);

    // Construct the encrypted request and send it
    const param = this._buildEncRequest(encReqCodes.SIGN_TRANSACTION, payload);
    return this._request(param, (err, res) => {
      if (err) return cb(err);
      const parsedRes = this._handleSign(res, currency, tx);
      if (parsedRes.err) return cb(parsedRes.err);
      return cb(null, parsedRes.data);
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
    
    // Build the payload and checksum
    const payloadPreCs = Buffer.concat([Buffer.from([enc_request_code]), payload]);
    const cs = checksum(payloadPreCs);
    const payloadBuf = Buffer.alloc(payloadPreCs.length + 4);

    // Lattice validates checksums in little endian
    payloadPreCs.copy(payloadBuf, 0);
    payloadBuf.writeUInt32LE(cs, payloadPreCs.length);

    // Encrypt this payload
    const secret = this._getSharedSecret();
    const newEncPayload = aes256_encrypt(payloadBuf, secret);

    // Write to the overall payload. We must use the same length
    // for every encrypted request and must include a 32-bit ephemId
    // along with the encrypted data
    const newPayload = Buffer.alloc(ENC_MSG_LEN + 4);
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

  // All encrypted responses must be decrypted with the previous shared secret. Per specification,
  // decrypted responses will all contain a 65-byte public key as the prefix, which becomes the 
  // new ephemeralPub.
  _handleEncResponse(encRes, len) {
    // Decrypt response
    const secret = this._getSharedSecret();
    const encData = encRes.slice(0, ENC_MSG_LEN);
    const res = aes256_decrypt(encData, secret);
    // len does not include a 65-byte pubkey that prefies each encResponse
    len += 65;

    // Validate checksum. It will be the last 4 bytes of the decrypted payload.
    // The length of the decrypted payload will be fixed for each given message type.
    const toCheck = res.slice(0, len);
    const cs = parseInt(`0x${res.slice(len, len+4).toString('hex')}`);
    const csCheck = checksum(toCheck);
    if (cs !== csCheck) return { err: `Checksum mismatch in response from Lattice (calculated ${csCheck}, wanted ${cs})` };

    // First 65 bytes is the next ephemeral pubkey
    const pub = res.slice(0, 65).toString('hex');
    try {
      this.ephemeralPub = getP256KeyPairFromPub(pub);
      return { err: null, data: res };
    } catch (e) {
      return { err: `Error handling getAddresses response: ${e.toString()}` };
    }
  }

  // Pair will create a new pairing if the user successfully enters the secret
  // into the device in time. If successful (status=0), the device will return
  // a new ephemeral public key, which is used to derive a shared secret
  // for the next request
  // @returns error (or null)
  _handlePair(encRes) {
    const d = this._handleEncResponse(encRes, decResLengths.finalizePair);
    if (d.err) return d.err;
    // Remove the pairing salt - we're paired!
    this.pairingSalt = null;
    this.isPaired = true;
    return null;
  }

  // GetAddresses will return an array of pubkey hashes
  _handleGetAddresses(encRes, currency, numAddr, version) {
    // Get the size of each expected address
    if (addressSizes[currency] === undefined) return { err: 'Unsupported currency' };
    const addrSize = addressSizes[currency];

    // Handle the encrypted response
    const decrypted = this._handleEncResponse(encRes, decResLengths.getAddresses);
    if (decrypted.err !== null ) return decrypted;

    let off = 65; // Skip past pubkey prefix
    const res = decrypted.data;
    // After that, we can start parsing the addresses
    let addrs = [];
    // Get the addresses
    for (let i = 0; i < numAddr; i++) {
      // Get the address-like data (depends on currnecy) -- data is in little endian
      // so we need to endian flip it
      const d = res.slice(off, off + addrSize);
      let addr;
      switch (currency) {
        case 'BTC':
          addr = bitcoin.getBitcoinAddress(d, version);
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
    return { data: addrs, err: null };
  }

  _handleSign(encRes, currencyType, tx=null) {
    // Handle the encrypted response
    const decrypted = this._handleEncResponse(encRes, decResLengths.sign);
    if (decrypted.err !== null ) return { err: decrypted.err };

    let off = 65; // Skip past pubkey prefix
    const res = decrypted.data;
    
    // Get the change data if we are making a BTC transaction
    let changeRecipient;
    if (currencyType === 'BTC') {
      const changeVersion = bitcoin.addressVersion[tx.changeData.changeVersion];
      const changePubkeyhash = res.slice(off, off + 20); off += 20;
      changeRecipient = bitcoin.getBitcoinAddress(changePubkeyhash, changeVersion);
    }
    // Start building return data
    const returnData = { err: null, data: null };
    const DERLength = 74; // max size of a DER signature -- all Lattice sigs are this long
    
    switch (currencyType) {
      case 'BTC':
        const compressedPubLength = 33;  // Size of compressed public key
        let pubkeys = [];
        let sigs = [];
        // Parse the signature for each output -- they are returned
        // in the serialized payload in form [pubkey, sig]
        // There is one signature per output
        while (off < res.length) {
          // Exit out if we have seen all the returned sigs and pubkeys
          if (res[off] != 0x02 && res[off] != 0x03) break;
          // Otherwise grab another set
          pubkeys.push(res.slice(off, off + compressedPubLength)); off += compressedPubLength;
          sigs.push(res.slice(off, (off + 2 + res[off + 1]))); off += DERLength;
        }

        // Build the transaction data to be serialized
        let preSerializedData = {
          inputs: [],
          outputs: [],
          isSegwitSpend: tx.origData.isSegwit,
          network: tx.origData.network,
          crypto: this.crypto,
        };

        // First output comes from request dta
        preSerializedData.outputs.push({
          value: tx.origData.value,
          recipient: tx.origData.recipient,
        });
        // Second output comes from change data
        preSerializedData.outputs.push({
          value: tx.changeData.value,
          recipient: changeRecipient,
        });
        
        // Add the inputs
        for (let i = 0; i < sigs.length; i++) {
          preSerializedData.inputs.push({
            hash: tx.origData.prevOuts[i].txHash,
            index: tx.origData.prevOuts[i].index,
            sig: sigs[i],
            pubkey: pubkeys[i],
          });
        }

        // Finally, serialize the transaction
        const serializedTx = bitcoin.serializeTx(preSerializedData);

        // Generate the transaction hash so the user can look this transaction up later
        let preImageTxHash = serializedTx;
        if (preSerializedData.isSegwitSpend === true) {
          // Segwit transactions need to be re-serialized using legacy serialization
          // before the transaction hash is calculated. This allows legacy clients
          // to validate the transactions.
          preSerializedData.isSegwitSpend = false;
          preImageTxHash = bitcoin.serializeTx(preSerializedData);
        }  
        let txHash = this.crypto.createHash('sha256').update(Buffer.from(preImageTxHash, 'hex')).digest();
        txHash = this.crypto.createHash('sha256').update(txHash).digest().reverse().toString('hex');
        
        // Add extra data for debugging/lookup purposes
        returnData.data = {
          tx: serializedTx,
          txHash,
          changeRecipient,
        }
        break;
      case 'ETH':
        const sig = parseDER(res.slice(off, (off + 2 + res[off + 1]))); off += DERLength;
        // Ethereum returns an address as well
        const ethAddr = res.slice(off, off + 20);
        // Determine the `v` param and add it to the sig before returning
        const rawTx = ethereum.buildEthRawTx(tx, sig, ethAddr, tx.useEIP155);
        returnData.data = {
          tx: `0x${rawTx}`,
          txHash: `0x${ethereum.hashTransaction(rawTx)}`,
        };
        break;
    }

    return returnData;
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