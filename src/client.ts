import bitwise from 'bitwise';
import { Byte } from 'bitwise/types';
import { Buffer } from 'buffer/';
import superagent from 'superagent';
import bitcoin from './bitcoin';
import {
  ADDR_STR_LEN,
  ASCII_REGEX,
  BASE_URL,
  decResLengths,
  deviceCodes,
  encReqCodes,
  ENC_MSG_LEN,
  getFwVersionConst,
  messageConstants,
  REQUEST_TYPE_BYTE,
  responseCodes,
  signingSchema,
  VERSION_BYTE
} from './constants';
import ethereum from './ethereum';
import { abiParsers, buildAddAbiPayload, MAX_ABI_DEFS } from './ethereumAbi';
import {
  aes256_decrypt,
  aes256_encrypt,
  checksum,
  ensureHexBuffer,
  getP256KeyPair,
  getP256KeyPairFromPub,
  isValidAssetPath,
  parseDER,
  parseLattice1Response,
  signReqResolver,
  toPaddedDER
} from './util';

const EMPTY_WALLET_UID = Buffer.alloc(32);

type ClientParams = {
  baseUrl?: string;
  crypto: string;
  name: string;
  privKey?: string;
  key?: string;
  pairingSalt?: string;
  retryCount?: number;
  timeout?: number;
}
export class Client {
  baseUrl: any;
  crypto: any;
  name: any;
  privKey: any;
  key: any;
  ephemeralPub: any;
  sharedSecret: any;
  timeout: any;
  deviceId: any;
  isPaired: boolean;
  retryCount: any;
  activeWallets: {
    internal: {
      uid: Buffer; // 32 byte id
      name: any; // 20 char (max) string
      capabilities: any; // 4 byte flag
      external: boolean;
    }; external: {
      uid: Buffer; // 32 byte id
      name: any; // 20 char (max) string
      capabilities: any; // 4 byte flag
      external: boolean;
    };
  };
  pairingSalt: any;

  constructor({ baseUrl, crypto, name, privKey, timeout, retryCount }: ClientParams) {
    // Definitions
    // if (!baseUrl) throw new Error('baseUrl is required');
    if (name && (name.length < 5 || name.length > 24)) {
      throw new Error('`name` must be 5-24 characters');
    }
    if (!crypto) {
      throw new Error('crypto provider is required');
    }
    this.baseUrl = baseUrl || BASE_URL;
    this.crypto = crypto;
    this.name = name || 'Unknown';

    // Derive an ECDSA keypair using the p256 curve. The public key will
    // be used as an identifier
    this.privKey = privKey || this.crypto.randomBytes(32);
    this.key = getP256KeyPair(this.privKey); //.encode('hex');

    // Stateful params
    this.ephemeralPub = null;
    this.sharedSecret = null;
    this.timeout = timeout || 60000;
    this.deviceId = null;
    this.isPaired = false;
    this.retryCount = retryCount || 3;

    // Information about the current wallet. Should be null unless we know a wallet is present
    this.activeWallets = {
      internal: {
        uid: EMPTY_WALLET_UID, // 32 byte id
        name: null, // 20 char (max) string
        capabilities: null, // 4 byte flag
        external: false,
      },
      external: {
        uid: EMPTY_WALLET_UID, // 32 byte id
        name: null, // 20 char (max) string
        capabilities: null, // 4 byte flag
        external: true,
      },
    };
  }

  //=======================================================================
  // LATTICE FUNCTIONS
  //=======================================================================

  // `Connect` will attempt to contact a device based on its deviceId.
  // The response should include an ephemeral public key, which is used to
  // pair with the device in a later request
  connect(deviceId, cb) {
    // User may "re-connect" if a device ID has previously been stored
    if (typeof deviceId === 'function') {
      if (!this.deviceId)
        return cb(
          'No device ID has been stored. Please connect with your device ID first.'
        );
      cb = deviceId;
    } else {
      // If the user passes in a device ID, connect to that device and save
      // the new ID for future use.
      this.deviceId = deviceId;
    }
    const param = this._buildRequest(deviceCodes.CONNECT, this.pubKeyBytes());
    this._request(param, (err, res) => {
      if (err) return cb(err);
      this.isPaired = this._handleConnect(res) || false;
      // Check for an active wallet. This will get bypassed if we are not paired.
      if (this.isPaired) {
        this._getActiveWallet((err) => {
          return cb(err, this.isPaired);
        }, true);
      } else {
        return cb(null);
      }
    });
  }

  pair(pairingSecret, cb) {
    // Build the secret hash from the salt
    const pubKey = this.pubKeyBytes();
    const nameBuf = Buffer.alloc(25);
    if (this.name.length < 5 || this.name.length > 24) {
      return cb('Invalid length for name provided. Must be 5-24 characters.');
    }
    if (pairingSecret.length > 0) {
      // If a pairing secret of zero length is passed in, it usually indicates
      // we want to cancel the pairing attempt. In this case we pass a zero-length
      // name buffer so the firmware can know not to draw the error screen.
      // Note that we still expect an error to come back (RESP_ERR_PAIR_FAIL)
      nameBuf.write(this.name);
    }
    // Make sure we add a null termination byte to the pairing secret
    const preImage = Buffer.concat([
      pubKey,
      nameBuf,
      Buffer.from(pairingSecret),
    ]);
    const hash = this.crypto.createHash('sha256').update(preImage).digest();
    const sig = this.key.sign(hash); // returns an array, not a buffer
    const derSig = toPaddedDER(sig);
    const payload = Buffer.concat([nameBuf, derSig]);

    // Build the request
    const param = this._buildEncRequest(encReqCodes.FINALIZE_PAIRING, payload);
    this._request(param, (err, res) => {
      if (err) return cb(err);
      // Recover the ephemeral key
      const errStr = this._handlePair(res);
      if (errStr) return cb(errStr);
      // Try to get the active wallet once pairing is successful
      this._getActiveWallet((err) => {
        if (err) return cb(err);
        return cb(null, this.hasActiveWallet());
      }, true);
    });
  }

  test(data, cb) {
    if (!data.payload)
      return cb('First argument must contain `testID` and `payload` fields.');
    const TEST_DATA_SZ = 500;
    const payload = Buffer.alloc(TEST_DATA_SZ + 6);
    payload.writeUInt32BE(data.testID, 0);
    payload.writeUInt16BE(data.payload.length, 4);
    data.payload.copy(payload, 6);
    const param = this._buildEncRequest(encReqCodes.TEST, payload);
    this._request(param, (err, res) => {
      if (err) return cb(err);
      const decrypted = this._handleEncResponse(res, decResLengths.test);
      if (decrypted.err !== null) return cb(decrypted.err);
      return cb(null, decrypted.data.slice(65)); // remove ephem pub
    });
  }

  getAddresses(opts, cb) {
    const SKIP_CACHE_FLAG = 1;
    const MAX_ADDR = 10;
    const { startPath, n } = opts;
    if (startPath === undefined || n === undefined)
      return cb('Please provide `startPath` and `n` options');
    if (startPath.length < 2 || startPath.length > 5)
      return cb('Path must include between 2 and 5 indices');
    if (n > MAX_ADDR)
      return cb(`You may only request ${MAX_ADDR} addresses at once.`);

    const fwConstants = getFwVersionConst(this.fwVersion);
    if (!isValidAssetPath(startPath, fwConstants))
      return cb('Parent derivation path is not supported');

    let sz = 32 + 20 + 1; // walletUID + 5 u32 indices + count/flag
    if (fwConstants.varAddrPathSzAllowed) {
      sz += 1; // pathDepth
    } else if (startPath.length !== 5) {
      return cb(
        'Your Lattice firmware only supports derivation paths with 5 indices. Please upgrade.'
      );
    }
    const payload = Buffer.alloc(sz);
    let off = 0;

    // WalletUID
    const wallet = this.getActiveWallet();
    if (wallet === null) return cb('No active wallet.');
    wallet.uid.copy(payload, off);
    off += 32;
    // Build the start path (5x u32 indices)
    if (fwConstants.varAddrPathSzAllowed) {
      payload.writeUInt8(startPath.length, off);
      off += 1;
    }
    for (let i = 0; i < 5; i++) {
      if (i <= startPath.length) payload.writeUInt32BE(startPath[i], off);
      off += 4;
    }
    // Specify the number of subsequent addresses to request.
    // We also allow the user to skip the cache and request any address related to the asset
    // in the wallet.
    let val;
    if (true === fwConstants.addrFlagsAllowed) {
      // Address caching was removed in 0.13.0 so this flag is now deprecated.
      // All requests against older devices also use the skipFlag=true now.
      const flag = bitwise.nibble.read(SKIP_CACHE_FLAG);
      const count = bitwise.nibble.read(n);
      val = bitwise.byte.write(flag.concat(count) as Byte);
    } else {
      val = n;
    }
    payload.writeUInt8(val, off);
    off++;
    const param = this._buildEncRequest(encReqCodes.GET_ADDRESSES, payload);
    return this._request(param, (err, res) => {
      if (err) return cb(err);
      const parsedRes = this._handleGetAddresses(res);
      if (parsedRes.err) return cb(parsedRes.err);
      return cb(null, parsedRes.data);
    });
  }

  fwVersion (fwVersion: any) { // eslint-disable-line 
    throw new Error('Method not implemented.');
  }

  sign(opts, cb, cachedData = null, nextCode = null) {
    const { currency } = opts;
    let { data } = opts;
    if (currency === undefined || data === undefined) {
      return cb('Please provide `currency` and `data` options');
    } else if (signReqResolver[currency] === undefined) {
      return cb('Unsupported currency');
    }
    // All transaction requests must be put into the same sized buffer.
    // This comes from sizeof(GpTransactionRequest_t), but note we remove
    // the 2-byte schemaId since it is not returned from our resolver.
    // Note that different firmware versions may have different data sizes.
    const fwConstants = getFwVersionConst(this.fwVersion);
    // Build the signing request payload to send to the device. If we catch
    // bad params, return an error instead
    data = { fwConstants, ...data };
    let req, reqPayload;
    let schema;
    if (cachedData !== null && nextCode !== null) {
      req = cachedData;
      reqPayload = Buffer.concat([nextCode, req.extraDataPayloads.shift()]);
      schema = signingSchema.EXTRA_DATA;
    } else {
      try {
        req = signReqResolver[currency](data);
      } catch (err) {
        return cb(`Error building BTC transaction request: ${err.message}`);
      }
      if (req.err !== undefined) return cb(req.err);
      if (req.payload.length > fwConstants.reqMaxDataSz)
        return cb('Transaction is too large');
      reqPayload = req.payload;
      schema = req.schema;
    }
    // Build the payload
    const payload = Buffer.alloc(2 + fwConstants.reqMaxDataSz);
    let off = 0;
    // Whether there will be follow up requests
    const hasExtraPayloads =
      req.extraDataPayloads && Number(req.extraDataPayloads.length > 0);
    payload.writeUInt8(hasExtraPayloads, off);
    off += 1;
    // Copy request schema (e.g. ETH or BTC transfer)
    payload.writeUInt8(schema, off);
    off += 1;
    // Copy the wallet UID
    const wallet = this.getActiveWallet();
    if (wallet === null) return cb('No active wallet.');
    wallet.uid.copy(payload, off);
    off += wallet.uid.length;
    // Build data based on the type of request
    // Copy the payload of the request
    reqPayload.copy(payload, off);
    // Construct the encrypted request and send it
    const param = this._buildEncRequest(encReqCodes.SIGN_TRANSACTION, payload);
    return this._request(param, (err, res, responseCode) => {
      if (responseCode === responseCodes.RESP_ERR_WALLET_NOT_PRESENT) {
        // If we catch a case where the wallet has changed, try getting the new active wallet
        // and recursively make the original request.
        this._getActiveWallet((err) => {
          if (err) return cb(err);
          else return this.sign(opts, cb, cachedData, nextCode);
        });
      } else if (err) {
        // If there was another error caught, return it
        if (err) return cb(err);
      } else if (hasExtraPayloads) {
        const decrypted = this._handleEncResponse(res, decResLengths.sign);
        nextCode = decrypted.data.slice(65, 73);
        if (!cachedData) cachedData = req;
        return this.sign(opts, cb, cachedData, nextCode);
      } else {
        // Correct wallet and no errors -- handle the response
        const parsedRes = this._handleSign(res, currency, req);
        // @ts-expect-error - TODO: should handle case where parsedRes does not contain data
        return cb(parsedRes.err, parsedRes.data);
      }
    });
  }

  addAbiDefs(defs, cb, nextCode = null) {
    const defsToAdd = defs.slice(0, MAX_ABI_DEFS);
    defs = defs.slice(MAX_ABI_DEFS);
    let abiPayload;
    try {
      abiPayload = buildAddAbiPayload(defsToAdd);
    } catch (err) {
      return cb(err);
    }
    const payload = Buffer.alloc(abiPayload.length + 10);
    // Let the firmware know how many defs are remaining *after this one*.
    // If this is a positive number, firmware will send us a temporary code
    // to bypass user authorization if the user has configured easy ABI loading.
    payload.writeUInt16LE(defs.length, 0);
    // If this is a follow-up request, we don't need to ask for user authorization
    // if we use the correct temporary u64
    if (nextCode !== null) nextCode.copy(payload, 2);
    abiPayload.copy(payload, 10);
    const param = this._buildEncRequest(encReqCodes.ADD_ABI_DEFS, payload);
    return this._request(param, (err, res, responseCode) => {
      if (responseCode && responseCode !== responseCodes.RESP_SUCCESS)
        return cb('Error making request.');
      else if (err) return cb(err);
      const decrypted = this._handleEncResponse(res, decResLengths.addAbiDefs);
      // Grab the 8 byte code to fast track our next request, if needed
      nextCode = decrypted.data.slice(65, 73);
      // No defs left? Return success
      if (defs.length === 0) return cb(null);
      // Add the next set
      this.addAbiDefs(defs, cb, nextCode);
    });
  }

  addPermissionV0(opts, cb) {
    const { currency, timeWindow, limit, decimals, asset } = opts;
    if (
      !currency ||
      timeWindow === undefined ||
      limit === undefined ||
      decimals === undefined ||
      timeWindow === null ||
      limit === null ||
      decimals === null
    )
      return cb(
        'currency, timeWindow, decimals, and limit are all required options.'
      );
    else if (timeWindow === 0 || limit === 0)
      return cb('Time window and spending limit must be positive.');
    // Build the name of the permission
    let name = currency;
    if (asset) name += `_${asset}`;
    // Start building the payload
    const payload = Buffer.alloc(293);
    // Copy the name
    if (Buffer.from(name).length > 255) return cb('Asset name too long.');
    Buffer.from(name).copy(payload, 0);
    // Convert the limit to a 32 byte hex buffer and copy it in
    const limitBuf = ensureHexBuffer(limit);
    if (limitBuf.length > 32) return cb('Limit too large.');
    limitBuf.copy(payload, 256 + (32 - limitBuf.length));
    // Copy the time window (seconds)
    payload.writeUInt32BE(timeWindow, 288);
    payload.writeUInt8(decimals, 292);
    // Encrypt the request and send it to the Lattice.
    const param = this._buildEncRequest(encReqCodes.ADD_PERMISSION_V0, payload);
    return this._request(param, (err, res, responseCode) => {
      if (responseCode === responseCodes.RESP_ERR_WALLET_NOT_PRESENT) {
        // If we catch a case where the wallet has changed, try getting the new active wallet
        // and recursively make the original request.
        this._getActiveWallet((err) => {
          if (err) return cb(err);
          else return this.addPermissionV0(opts, cb);
        });
      } else if (err) {
        // If there was another error caught, return it
        if (err) return cb(err);
      } else {
        // Correct wallet and no errors -- handle the response
        const d = this._handleEncResponse(res, decResLengths.empty);
        if (d.err) return cb(d.err);
        return cb(null);
      }
    });
  }

  getKvRecords(opts, cb) {
    const { type = 0, n = 1, start = 0 } = opts;
    const fwConstants = getFwVersionConst(this.fwVersion);
    if (!fwConstants.kvActionsAllowed) {
      return cb('Unsupported. Please update firmware.');
    } else if (n < 1) {
      return cb('You must request at least one record.');
    } else if (n > fwConstants.kvActionMaxNum) {
      return cb(
        `You may only request up to ${fwConstants.kvActionMaxNum} records at once.`
      );
    }
    const payload = Buffer.alloc(9);
    payload.writeUInt32LE(type, 0);
    payload.writeUInt8(n, 4);
    payload.writeUInt32LE(start, 5);
    // Encrypt the request and send it to the Lattice.
    const param = this._buildEncRequest(encReqCodes.GET_KV_RECORDS, payload);
    return this._request(param, (err, res, responseCode) => {
      if (responseCode === responseCodes.RESP_ERR_WALLET_NOT_PRESENT) {
        // If we catch a case where the wallet has changed, try getting the new active wallet
        // and recursively make the original request.
        this._getActiveWallet((err) => {
          if (err) return cb(err);
          else return this.getKvRecords(opts, cb);
        });
      } else if (err) {
        // If there was another error caught, return it
        if (err) return cb(err);
      } else {
        // Correct wallet and no errors -- handle the response
        const d = this._handleEncResponse(res, decResLengths.getKvRecords);
        if (d.err) return cb(d.err);
        // Decode the response
        let off = 65; // Skip 65 byte pubkey prefix
        const nTotal = parseInt(d.data.slice(off, off + 4).toString('hex'), 16);
        off += 4;
        const nFetched = parseInt(
          d.data.slice(off, off + 1).toString('hex'),
          16
        );
        off += 1;
        if (nFetched > fwConstants.kvActionMaxNum)
          return cb('Too many records fetched. Firmware error.');
        const records = [];
        for (let i = 0; i < nFetched; i++) {
          const r: any = {};
          r.id = parseInt(d.data.slice(off, off + 4).toString('hex'), 16);
          off += 4;
          r.type = parseInt(d.data.slice(off, off + 4).toString('hex'), 16);
          off += 4;
          r.caseSensitive =
            parseInt(d.data.slice(off, off + 1).toString('hex'), 16) === 1
              ? true
              : false;
          off += 1;
          const keySz = parseInt(
            d.data.slice(off, off + 1).toString('hex'),
            16
          );
          off += 1;
          r.key = d.data.slice(off, off + keySz - 1).toString();
          off += fwConstants.kvKeyMaxStrSz + 1;
          const valSz = parseInt(
            d.data.slice(off, off + 1).toString('hex'),
            16
          );
          off += 1;
          r.val = d.data.slice(off, off + valSz - 1).toString();
          off += fwConstants.kvValMaxStrSz + 1;
          records.push(r);
        }
        return cb(null, { records, total: nTotal, fetched: nFetched });
      }
    });
  }

  addKvRecords(opts, cb) {
    const { type = 0, records = {}, caseSensitive = false } = opts;
    const fwConstants = getFwVersionConst(this.fwVersion);
    if (!fwConstants.kvActionsAllowed) {
      return cb('Unsupported. Please update firmware.');
    } else if (
      typeof records !== 'object' ||
      Object.keys(records).length === 0
    ) {
      return cb(
        'One or more key-value mapping must be provided in `records` param.'
      );
    } else if (Object.keys(records).length > fwConstants.kvActionMaxNum) {
      return cb(
        `Too many keys provided. Please only provide up to ${fwConstants.kvActionMaxNum}.`
      );
    } else if (Object.keys(records).length < 1) {
      return cb('You must provide at least one key to add.');
    }
    const payload = Buffer.alloc(1 + 139 * fwConstants.kvActionMaxNum);
    payload.writeUInt8(Object.keys(records).length, 0);
    let off = 1;
    try {
      Object.keys(records).forEach((key) => {
        if (
          typeof key !== 'string' ||
          String(key).length > fwConstants.kvKeyMaxStrSz
        ) {
          throw new Error(
            `Key ${key} too large. Must be <=${fwConstants.kvKeyMaxStrSz} characters.`
          );
        } else if (
          typeof records[key] !== 'string' ||
          String(records[key]).length > fwConstants.kvValMaxStrSz
        ) {
          throw new Error(
            `Value ${records[key]} too large. Must be <$={fwConstants.kvValMaxStrSz} characters.`
          );
        } else if (
          String(key).length === 0 ||
          String(records[key]).length === 0
        ) {
          throw new Error('Keys and values must be >0 characters.');
        } else if (!ASCII_REGEX.test(key) || !ASCII_REGEX.test(records[key])) {
          throw new Error('Unicode characters are not supported.');
        }
        // Skip the ID portion. This will get added by firmware.
        payload.writeUInt32LE(0, off);
        off += 4;
        payload.writeUInt32LE(type, off);
        off += 4;
        // @ts-expect-error - TODO: writeUInt8 cannot take a boolean. It will always be coerced to undefined.
        payload.writeUInt8(caseSensitive === true, off);
        off += 1;
        payload.writeUInt8(String(key).length + 1, off);
        off += 1;
        Buffer.from(String(key)).copy(payload, off);
        off += fwConstants.kvKeyMaxStrSz + 1;
        payload.writeUInt8(String(records[key]).length + 1, off);
        off += 1;
        Buffer.from(String(records[key])).copy(payload, off);
        off += fwConstants.kvValMaxStrSz + 1;
      });
    } catch (err) {
      return cb(`Error building request: ${err.message}`);
    }
    // Encrypt the request and send it to the Lattice.
    const param = this._buildEncRequest(encReqCodes.ADD_KV_RECORDS, payload);
    return this._request(param, (err, res, responseCode) => {
      if (responseCode === responseCodes.RESP_ERR_WALLET_NOT_PRESENT) {
        // If we catch a case where the wallet has changed, try getting the new active wallet
        // and recursively make the original request.
        this._getActiveWallet((err) => {
          if (err) return cb(err);
          else return this.addKvRecords(opts, cb);
        });
      } else if (err) {
        // If there was another error caught, return it
        if (err) return cb(err);
      } else {
        // Correct wallet and no errors -- handle the response
        const d = this._handleEncResponse(res, decResLengths.empty);
        if (d.err) return cb(d.err);
        return cb(null);
      }
    });
  }

  removeKvRecords(opts, cb) {
    const { type = 0, ids = [] } = opts;
    const fwConstants = getFwVersionConst(this.fwVersion);
    if (!fwConstants.kvActionsAllowed) {
      return cb('Unsupported. Please update firmware.');
    } else if (!Array.isArray(ids) || ids.length < 1) {
      return cb('You must include one or more `ids` to removed.');
    } else if (ids.length > fwConstants.kvRemoveMaxNum) {
      return cb(
        `Only up to ${fwConstants.kvRemoveMaxNum} records may be removed at once.`
      );
    }
    const payload = Buffer.alloc(5 + 4 * fwConstants.kvRemoveMaxNum);
    payload.writeUInt32LE(type, 0);
    payload.writeUInt8(ids.length, 4);
    for (let i = 0; i < ids.length; i++) {
      payload.writeUInt32LE(ids[i], 5 + 4 * i);
    }
    // Encrypt the request and send it to the Lattice.
    const param = this._buildEncRequest(encReqCodes.REMOVE_KV_RECORDS, payload);
    return this._request(param, (err, res, responseCode) => {
      if (responseCode === responseCodes.RESP_ERR_WALLET_NOT_PRESENT) {
        // If we catch a case where the wallet has changed, try getting the new active wallet
        // and recursively make the original request.
        this._getActiveWallet((err) => {
          if (err) return cb(err);
          else return this.removeKvRecords(opts, cb);
        });
      } else if (err) {
        // If there was another error caught, return it
        if (err) return cb(err);
      } else {
        // Correct wallet and no errors -- handle the response
        const d = this._handleEncResponse(res, decResLengths.empty);
        if (d.err) return cb(d.err);
        return cb(null);
      }
    });
  }

  //=======================================================================
  // INTERNAL FUNCTIONS
  // These handle the logic around building requests and consuming
  // responses. They take into account the Lattice's serialization scheme
  // among other protocols.
  //=======================================================================

  // Get the active wallet in the device. If we already have one recorded,
  // we don't need to do anything
  // returns cb(err) -- err is a string
  _getActiveWallet(cb, forceRefresh = false) {
    if (
      forceRefresh !== true &&
      (this.hasActiveWallet() === true || this.isPaired !== true)
    ) {
      // If the active wallet already exists, or if we are not paired, skip the request
      return cb(null);
    } else {
      // No active wallet? Get it from the device
      const payload = Buffer.alloc(0);
      const param = this._buildEncRequest(encReqCodes.GET_WALLETS, payload);
      return this._request(param, (err, res) => {
        if (err) {
          this._resetActiveWallets();
          return cb(err);
        }
        return cb(this._handleGetWallets(res));
      });
    }
  }

  // Get the shared secret, derived via ECDH from the local private key
  // and the ephemeral public key
  // @returns Buffer
  _getSharedSecret() {
    // Once every ~256 attempts, we will get a key that starts with a `00` byte, which
    // can lead to problems initializing AES if we don't force a 32 byte BE buffer.
    return Buffer.from(
      this.key.derive(this.ephemeralPub.getPublic()).toArray('be', 32)
    );
  }

  // Get the ephemeral id, which is the first 4 bytes of the shared secret
  // generated from the local private key and the ephemeral public key from
  // the device.
  // @returns Buffer
  _getEphemId() {
    if (this.ephemeralPub === null) return null;
    // EphemId is the first 4 bytes of the hash of the shared secret
    const secret = this._getSharedSecret();
    const hash = this.crypto.createHash('sha256').update(secret).digest();
    return hash.slice(0, 4);
  }

  _buildEncRequest(enc_request_code, payload) {
    // Get the ephemeral id - all encrypted requests require there to be an
    // epehemeral public key in order to send
    const ephemId = parseInt(this._getEphemId().toString('hex'), 16);
    // Build the payload and checksum
    const payloadPreCs = Buffer.concat([
      Buffer.from([enc_request_code]),
      payload,
    ]);
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
    newPayload.writeUInt32LE(ephemId, 0);
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
    if (request_code === deviceCodes.ENCRYPTED_REQUEST) {
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

  _request(data, cb, retryCount = this.retryCount) {
    if (!this.deviceId)
      return cb('Serial is not set. Please set it and try again.');
    const url = `${this.baseUrl}/${this.deviceId}`;
    superagent
      .post(url)
      .timeout(this.timeout)
      .send({ data })
      .then((res) => {
        if (!res || !res.body) return cb(`Invalid response: ${res}`);
        else if (res.body.status !== 200)
          return cb(`Error code ${res.body.status}: ${res.body.message}`);
        const parsed: any = parseLattice1Response(res.body.message);
        const deviceBusy =
          parsed.responseCode === responseCodes.RESP_ERR_DEV_BUSY ||
          parsed.responseCode === responseCodes.RESP_ERR_GCE_TIMEOUT;
        const walletMissing =
          parsed.responseCode === responseCodes.RESP_ERR_WALLET_NOT_PRESENT;
        const invalidEphemId =
          parsed.responseCode === responseCodes.RESP_ERR_INVALID_EPHEM_ID;
        const canRetry = retryCount > 0;
        if (deviceBusy && canRetry) {
          // Wait a few seconds and retry
          setTimeout(() => {
            this._request(data, cb, retryCount - 1);
          }, 3000);
        } else if (walletMissing && canRetry) {
          // If we caugh a `ErrWalletNotPresent` make sure we aren't caching an old active walletUID
          this._resetActiveWallets();
          return this._request(data, cb, retryCount - 1);
        } else if (invalidEphemId && canRetry) {
          // Reconnect and retry
          this.connect(this.deviceId, (err, isPaired) => {
            if (err) {
              cb(err);
            } else if (!isPaired) {
              cb('Not paired to device.');
            } else {
              // Retry
              this._request(data, cb, retryCount - 1);
            }
          });
        } else if (parsed.err) {
          // If there was an error in the response, return it
          cb(parsed.err);
        } else {
          // All good
          cb(null, parsed.data, parsed.responseCode);
        }
      })
      .catch((err) => {
        const isTimeout = err.code === 'ECONNABORTED' && err.errno === 'ETIME';
        if (isTimeout)
          return cb(
            'Timeout waiting for device. Please ensure it is connected to the internet and try again in a minute.'
          );
        else return cb(`Failed to make request to device: ${err.message}`);
      });
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
    const pairingStatus = res.readUInt8(off);
    off++;
    // If we are already paired, we get the next ephemeral key
    const pub = res.slice(off, off + 65).toString('hex');
    off += 65;
    // Grab the firmware version (will be 0-length for older fw versions)
    // It is of format |fix|minor|major|reserved|
    this.fwVersion = res.slice(off, off + 4);
    // Set the public key
    this.ephemeralPub = getP256KeyPairFromPub(pub);
    // return the state of our pairing
    return pairingStatus === messageConstants.PAIRED;
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
    const cs = parseInt(`0x${res.slice(len, len + 4).toString('hex')}`);
    const csCheck = checksum(toCheck);
    if (cs !== csCheck)
      return {
        err: `Checksum mismatch in response from Lattice (calculated ${csCheck}, wanted ${cs})`,
      };

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
    const d = this._handleEncResponse(encRes, decResLengths.empty);
    if (d.err) return d.err;
    // Remove the pairing salt - we're paired!
    this.pairingSalt = null;
    this.isPaired = true;
    return null;
  }

  // GetAddresses will return an array of address strings
  _handleGetAddresses(encRes) {
    // Handle the encrypted response
    const decrypted = this._handleEncResponse(
      encRes,
      decResLengths.getAddresses
    );
    if (decrypted.err !== null) return decrypted;

    const addrData = decrypted.data;
    let off = 65; // Skip 65 byte pubkey prefix
    // Look for addresses until we reach the end (a 4 byte checksum)
    const addrs = [];
    while (off + 4 < decResLengths.getAddresses) {
      const addrBytes = addrData.slice(off, off + ADDR_STR_LEN);
      off += ADDR_STR_LEN;
      // Return the UTF-8 representation
      const len = addrBytes.indexOf(0); // First 0 is the null terminator
      if (len > 0) addrs.push(addrBytes.slice(0, len).toString());
    }
    return { data: addrs, err: null };
  }

  _handleGetWallets(encRes) {
    const decrypted = this._handleEncResponse(encRes, decResLengths.getWallets);
    if (decrypted.err !== null) return decrypted;
    const res = decrypted.data;
    let walletUID;
    // Read the external wallet data first. If it is non-null, the external wallet will
    // be the active wallet of the device and we should save it.
    // If the external wallet is blank, it means there is no card present and we should
    // save and use the interal wallet.
    // If both wallets are empty, it means the device still needs to be set up.
    const walletDescriptorLen = 71;
    // Skip 65byte pubkey prefix. WalletDescriptor contains 32byte id + 4byte flag + 35byte name
    let off = 65;
    // Internal first
    let hasActiveWallet = false;
    walletUID = res.slice(off, off + 32);
    this.activeWallets.internal.uid = walletUID;
    this.activeWallets.internal.capabilities = res.readUInt32BE(off + 32);
    this.activeWallets.internal.name = res.slice(
      off + 36,
      off + walletDescriptorLen
    );
    if (!walletUID.equals(EMPTY_WALLET_UID)) hasActiveWallet = true;

    // Offset the first item
    off += walletDescriptorLen;

    // External
    walletUID = res.slice(off, off + 32);
    this.activeWallets.external.uid = walletUID;
    this.activeWallets.external.capabilities = res.readUInt32BE(off + 32);
    this.activeWallets.external.name = res.slice(
      off + 36,
      off + walletDescriptorLen
    );
    if (!walletUID.equals(EMPTY_WALLET_UID)) hasActiveWallet = true;
    if (hasActiveWallet === true) return null;
    else return 'No active wallet.';
  }

  _handleSign(encRes, currencyType, req = null) {
    // Handle the encrypted response
    const decrypted = this._handleEncResponse(encRes, decResLengths.sign);
    if (decrypted.err !== null) return { err: decrypted.err };
    const PUBKEY_PREFIX_LEN = 65;
    const PKH_PREFIX_LEN = 20;
    let off = PUBKEY_PREFIX_LEN; // Skip past pubkey prefix
    const res = decrypted.data;
    // Get the change data if we are making a BTC transaction
    let changeRecipient;
    if (currencyType === 'BTC') {
      const changeVersion = bitcoin.getAddressFormat(req.origData.changePath);
      const changePubkeyhash = res.slice(off, off + PKH_PREFIX_LEN);
      off += PKH_PREFIX_LEN;
      changeRecipient = bitcoin.getBitcoinAddress(
        changePubkeyhash,
        changeVersion
      );
    }
    // Start building return data
    const returnData = { err: null, data: null };
    const DERLength = 74; // max size of a DER signature -- all Lattice sigs are this long
    const SIGS_OFFSET = 10 * DERLength; // 10 signature slots precede 10 pubkey slots
    const PUBKEYS_OFFSET = PUBKEY_PREFIX_LEN + PKH_PREFIX_LEN + SIGS_OFFSET;

    if (currencyType === 'BTC') {
      const compressedPubLength = 33; // Size of compressed public key
      const pubkeys = [];
      const sigs = [];
      let n = 0;
      // Parse the signature for each output -- they are returned
      // in the serialized payload in form [pubkey, sig]
      // There is one signature per output
      while (off < res.length) {
        // Exit out if we have seen all the returned sigs and pubkeys
        if (res[off] !== 0x30) break;
        // Otherwise grab another set
        // Note that all DER sigs returned fill the maximum 74 byte buffer, but also
        // contain a length at off+1, which we use to parse the non-zero data.
        // First get the signature from its slot
        const sigStart = off;
        const sigEnd = off + 2 + res[off + 1];
        sigs.push(res.slice(sigStart, sigEnd));
        // Next, shift by the full set of signatures to hit the respective pubkey
        // NOTE: The data returned is: [<sig0>, <sig1>, ... <sig9>][<pubkey0>, <pubkey1>, ... <pubkey9>]
        const pubStart = n * compressedPubLength + PUBKEYS_OFFSET;
        const pubEnd = (n + 1) * compressedPubLength + PUBKEYS_OFFSET;
        pubkeys.push(res.slice(pubStart, pubEnd));
        // Update offset to hit the next signature slot
        off += DERLength;
        n += 1;
      }
      // Build the transaction data to be serialized
      const preSerializedData: any = {
        inputs: [],
        outputs: [],
        crypto: this.crypto,
      };

      // First output comes from request dta
      preSerializedData.outputs.push({
        value: req.origData.value,
        recipient: req.origData.recipient,
      });
      if (req.changeData.value > 0) {
        // Second output comes from change data
        preSerializedData.outputs.push({
          value: req.changeData.value,
          recipient: changeRecipient,
        });
      }

      // Add the inputs
      for (let i = 0; i < sigs.length; i++) {
        preSerializedData.inputs.push({
          hash: req.origData.prevOuts[i].txHash,
          index: req.origData.prevOuts[i].index,
          sig: sigs[i],
          pubkey: pubkeys[i],
          signerPath: req.origData.prevOuts[i].signerPath,
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
      let txHash = this.crypto
        .createHash('sha256')
        .update(Buffer.from(preImageTxHash, 'hex'))
        .digest();
      txHash = this.crypto
        .createHash('sha256')
        .update(txHash)
        .digest()
        .reverse()
        .toString('hex');

      // Add extra data for debugging/lookup purposes
      returnData.data = {
        tx: serializedTx,
        txHash,
        changeRecipient,
        sigs,
      };
    } else if (currencyType === 'ETH') {
      const sig: any = parseDER(res.slice(off, off + 2 + res[off + 1]));
      off += DERLength;
      const ethAddr = res.slice(off, off + 20);
      // Determine the `v` param and add it to the sig before returning
      const rawTx = ethereum.buildEthRawTx(req, sig, ethAddr);
      returnData.data = {
        tx: `0x${rawTx}`,
        txHash: `0x${ethereum.hashTransaction(rawTx)}`,
        sig: {
          v: sig.v,
          r: sig.r.toString('hex'),
          s: sig.s.toString('hex'),
        },
        signer: ethAddr,
      };
    } else if (currencyType === 'ETH_MSG') {
      const sig = parseDER(res.slice(off, off + 2 + res[off + 1]));
      off += DERLength;
      const signer = res.slice(off, off + 20);
      const validatedSig = ethereum.validateEthereumMsgResponse(
        { signer, sig },
        req
      );
      returnData.data = {
        sig: {
          v: validatedSig.v,
          r: validatedSig.r.toString('hex'),
          s: validatedSig.s.toString('hex'),
        },
        signer,
      };
    }

    return returnData;
  }

  _resetActiveWallets() {
    this.activeWallets.internal.uid = EMPTY_WALLET_UID;
    this.activeWallets.internal.name = null;
    this.activeWallets.internal.capabilities = null;
    this.activeWallets.external.uid = EMPTY_WALLET_UID;
    this.activeWallets.external.name = null;
    this.activeWallets.external.capabilities = null;
    return;
  }

  getActiveWallet() {
    if (!EMPTY_WALLET_UID.equals(this.activeWallets.external.uid)) {
      return this.activeWallets.external;
    } else if (!EMPTY_WALLET_UID.equals(this.activeWallets.internal.uid)) {
      return this.activeWallets.internal;
    } else {
      return null;
    }
  }

  hasActiveWallet() {
    return this.getActiveWallet() !== null;
  }

  // Get 64 bytes representing the public key
  // This is the uncompressed key without the leading 04 byte
  pubKeyBytes(LE = false) {
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

  // TODO: Find a better way to export this.
  parseAbi(source, data, skipErrors = false) {
    switch (source) {
      case 'etherscan':
        return abiParsers[source](data, skipErrors);
      default:
        return { err: `No ${source} parser available.` };
    }
  }
}

