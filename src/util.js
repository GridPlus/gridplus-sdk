// Static utility functions
const Bitcoin = require('bitcoinjs-lib');
const bs58 = require('bs58');
const EthereumTx = require('ethereumjs-tx');
const ethereum = require('./ethereum');
const rlp = require('rlp');
const bs58check = require('bs58check')
const Buffer = require('buffer/').Buffer
const aes = require('aes-js');
const crc32 = require('crc-32');
const leftPad = require('left-pad');
const elliptic = require('elliptic');
const config = require('../config');
const constants = require('./constants');
const { AES_IV, responseCodes, OPs, VERSION_BYTE } = require('./constants');
const EC = elliptic.ec;
const ec = new EC('p256');

//--------------------------------------------------
// LATTICE UTILS
//--------------------------------------------------

// Parse a response from the Lattice1
function parseLattice1Response(r) {
  const parsed = {
    err: null,
    data: null,
  }
  const b = Buffer.from(r, 'hex');
  let off = 0;
  
  // Get protocol version
  const protoVer = b.readUInt8(off); off++;
  if (protoVer !== VERSION_BYTE) {
    parsed.err = 'Incorrect protocol version. Please update your SDK';
    return parsed;
  }

  // Get the type of response
  // Should always be 0x00
  const msgType = b.readUInt8(off); off++;
  if (msgType != 0x00) {
    parsed.err = 'Incorrect response from Lattice1';
    return parsed;
  }

  // Get the payload
  const id = b.readUInt32BE(off); off+=4;
  const len = b.readUInt16BE(off); off+=2;
  const payload = b.slice(off, off+len); off+=len;

  // Get response code
  const responseCode = payload.readUInt8(0);
  if (responseCode !== responseCodes.SUCCESS) {
    parsed.err = `Error from device: ${responseCodes[responseCode] ? responseCodes[responseCode] : 'Unknown Error'}`;
    return parsed;
  } else {
    parsed.data = payload.slice(1, payload.length);
  }

  // Verify checksum
  const cs = b.readUInt32BE(off);
  const expectedCs = checksum(b.slice(0, b.length - 4));
  if (cs !== expectedCs) {
    parsed.err = 'Invalid checksum from device response'
    parsed.data = null;
    return parsed;
  }
  
  return parsed;
}

function checksum(x) {
  // crc32 returns a signed integer - need to cast it to unsigned
  // Note that this uses the default 0xedb88320 polynomial
  return crc32.buf(x) >>> 0; // Need this to be a uint, hence the bit shift
}

// Get a 74-byte padded DER-encoded signature buffer
// `sig` must be the signature output from elliptic.js
function toPaddedDER(sig) {
  // We use 74 as the maximum length of a DER signature. All sigs must
  // be right-padded with zeros so that this can be a fixed size field
  const b = Buffer.alloc(74);
  const ds = Buffer.from(sig.toDER());
  ds.copy(b);
  return b;
}

//--------------------------------------------------
// TRANSACTION UTILS
//--------------------------------------------------
function buildEthereumTxRequest(data) {
  try {
    const { txData, signerIndex } = data;
    // Ensure all fields are 0x-prefixed hex strings
    Object.keys(txData).forEach((k) => {
      txData[k] = ensureHex(txData[k]);
    })
    // Ensure data field isn't too long
    if (txData.data && Buffer.from(txData.data, 'hex').length > constants.ETH_DATA_MAX_SIZE) {
      return { err: `Data field too large (must be <=${constants.ETH_DATA_MAX_SIZE} bytes)` }
    }
    // RLP-encode the transaction request
    const tx = new EthereumTx(txData);
    const encoded = rlp.encode(tx.raw);
    // Build the payload to send to the Lattice
    const payload = Buffer.alloc(encoded.length + 4);
    payload.writeUInt32BE(signerIndex, 0);
    encoded.copy(payload, 4);
    return { 
      payload,
      schema: constants.signingSchema.ETH_TRANSFER,  // We will use eth transfer for all ETH txs for v1 
    };
  } catch (err) {
    return { err };
  }
}

// We need to build two different objects here:
// 1. bitcoinjs-lib TransactionBuilder object, which will be used in conjunction
//    with the returned signatures to build and serialize the transaction before
//    broadcasting it. We will replace `bitcoinjs-lib`'s signatures with the ones
//    we get from the Lattice
// 2. The serialized Lattice request, which includes data (outlined in the specification)
//    that is needed to sign all of the inputs and build a change output. 
// @inputs (contained in `data`)
// `prevOuts`: an array of objects with the following properties:
//           a. txHash
//           b. value
//           c. index          -- the index of the output in the transaction
//           d. recipientIndex -- the index of the address in our wallet
// `recipient`: Receiving address, which must be converted to a pubkeyhash
// `value`:     Number of satoshis to send the recipient
// `fee`:       Number of satoshis to use for a transaction fee (should have been calculated)
//              already based on the number of inputs plus two outputs
// `version`:   Transaction version of the inputs. All inputs must be of the same version! 
// `isSegwit`: a boolean which determines how we serialize the data and parameterize txb
function buildBitcoinTxRequest(data) {
  try {
    const { prevOuts, recipient, value, changeIndex=0, fee, isSegwit } = data;
    // Start building the transaction
    const txb = new Bitcoin.TransactionBuilder();
    prevOuts.forEach((o) => {
      txb.addInput(o.txHash, o.index);
    })
    txb.addOutput(recipient, value);

    // Serialize the request
    const payload = Buffer.alloc(37 + (51 * prevOuts.length));
    let off = 0;
    payload.writeUInt32LE(changeIndex, off); off += 4;
    payload.writeUInt32LE(fee, off); off += 4;
    const recipientVersionByte = bs58.decode(recipient)[0];
    const recipientPubkeyhash = bs58check.decode(recipient).slice(1);
    payload.writeUInt8(recipientVersionByte, off); off++;
    recipientPubkeyhash.copy(payload, off); off += recipientPubkeyhash.length;
    writeUInt64LE(value, payload, off); off += 8;
    
    // Build the inputs from the previous outputs
    payload.writeUInt8(prevOuts.length, off); off++;
    const scriptType = isSegwit === true ? 
                        constants.bitcoinScriptTypes.P2SH : 
                        constants.bitcoinScriptTypes.P2PKH; // No support for multisig p2sh in v1 (p2sh == segwit here)
    prevOuts.forEach((input) => {
      payload.writeUInt32LE(input.recipientIndex, off); off += 4;
      payload.writeUInt32LE(input.index, off); off += 4;
      writeUInt64LE(input.value, payload, off); off += 8;
      payload.writeUInt8(scriptType, off); off++;
      if (!Buffer.isBuffer(input.txHash)) input.txHash = Buffer.from(input.txHash, 'hex');
      input.txHash.copy(payload, off); off += input.txHash.length;
    })
    // Send them back!
    return { 
      txb, 
      payload, 
      schema: constants.signingSchema.BTC_TRANSFER 
    };
  } catch (err) {
    return { err };
  }
}

function writeUInt64LE(n, buf, off) {
  const preBuf = Buffer.alloc(8);
  const nStr = n.length % 2 == 0 ? n.toString(16) : `0${n.toString(16)}`;
  const nBuf = Buffer.from(nStr, 'hex');
  nBuf.reverse().copy(preBuf, 0);
  preBuf.copy(buf, off);
  return preBuf;
}

function ensureHex(x) {
  if (typeof x == 'number') return `0x${x.toString(16)}`
  else if (Buffer.isBuffer(x)) return `0x${x.toString('hex')}`
  else if (typeof x == 'string' && x.slice(0, 2) !== '0x') return `0x${x}`;
  return x;
}


const txBuildingResolver = {
  'BTC': buildBitcoinTxRequest,
  'ETH': buildEthereumTxRequest,
}

//--------------------------------------------------
// CRYPTO UTILS
//--------------------------------------------------
function aes256_encrypt(data, key) {
  const iv = Buffer.from(AES_IV);
  const aesCbc = new aes.ModeOfOperation.cbc(key, iv);
  const paddedData = (data.length) % 16 == 0 ? data : aes.padding.pkcs7.pad(data);
  return Buffer.from(aesCbc.encrypt(paddedData));
}

function aes256_decrypt(data, key) {
  const iv = Buffer.from(AES_IV);
  const aesCbc = new aes.ModeOfOperation.cbc(key, iv);
  return Buffer.from(aesCbc.decrypt(data));
}

// Convert a pubkeyhash to a bitcoin base58check address with a version byte
function getBitcoinAddress(pubkeyhash, version) {
  const vb = constants.bitcoinVersionByte[version];
  if (vb === undefined) {
    return null;
  }
  return bs58check.encode(Buffer.concat([Buffer.from([vb]), pubkeyhash]));
}

// Decode a DER signature. Returns signature object {r, s } or null if there is an error
function parseDER(sigBuf) {
  if (sigBuf[0] != 0x30 || sigBuf[2] != 0x02) return null;
  let off = 3;
  let sig = { r: null, s: null }
  const rLen = sigBuf[off]; off++;
  sig.r = sigBuf.slice(off, off + rLen); off += rLen
  if (sigBuf[off] != 0x02) return null;
  off++;
  const sLen = sigBuf[off]; off++;
  sig.s = sigBuf.slice(off, off + sLen);
  return sig;
}

// Given a 64-byte signature [r,s] we need to figure out the v value.
// We can brute force since v is a single bit.
function buildFullEthSig(payload, sig, address) {
  // EthUtil doesn't like our UInt8 buffers :\
  return ethereum.addRecoveryParam(payload, sig, address);
}


function getOutputScriptType(s, multisig=false) {
  const OP_first = s.slice(0, 2);
  const OP_last = s.slice(s.length - 2, s.length);
  const p2pkh = (OPs[OP_first] === 'OP_DUP' && OPs[OP_last] === 'OP_CHECKSIG');
  const p2sh = (OPs[OP_first] === 'OP_HASH160' && OPs[OP_last] === 'OP_EQUAL');
  if (p2pkh) {
    return 'p2pkh';
  } else if (p2sh && multisig === true) {
    return 'p2sh';
  } else if (p2sh && multisig !== true) {
    return 'p2sh(p2wpkh)';
  } else {
    return null;
  }
}


function getP256KeyPair (priv) {
  return ec.keyFromPrivate(priv, 'hex');
}

function getP256KeyPairFromPub(pub) {
  return ec.keyFromPublic(pub, 'hex');
}

// left-pad with zeros up to 64 bytes
function pad64 (x) {
  if (typeof x === 'number') x = x.toString(16);
  return leftPad(x.substr(0, 2) === '0x' ? x.slice(2) : x, 64, '0');
}

// Remove all leading zeros in piece of data
 function unpad (x) {
  if (x.substr(0, 2) === '0x') x = x.slice(2);
  return x.slice(24);
}

function parseSigResponse(res) {
  if (res.result && res.result.status === 200) {    
    switch (res.result.data.schemaIndex) {
      case 0: // ETH
        return _parseEthTx(res);
      case 1: // BTC
        return _parseBtcTx(res);
      default:
        return null;
    }
  } else {
    return null;
  }
}

const sortByHeight = (_utxos) => {
  if (!_utxos) return [];
  return _utxos.sort((a, b) => {
    return (a.height > b.height) ? 1 : ((b.height > a.height) ? -1 : 0)
  });
}

// Get the serialized transaction and the appropriate txHash
function _parseBtcTx(res) {
  const sigData = res.result.data.sigData.split(config.api.SPLIT_BUF);
  const witnessData = res.result.witnessData;
  const d = {
    tx: sigData[0],
  }
  if (witnessData) {
    // Remove `marker` and `flag`
    let legacyTx = d.tx.slice(0, 9) + d.tx.slice(13);
    // Remove witness data
    const wi = legacyTx.indexOf(witnessData);
    legacyTx = legacyTx.slice(0, wi) + legacyTx.slice(wi + witnessData.length);
    // Double hash
    d.txHash = getTxHash(legacyTx);
    d.stxHash = getTxHash(d.tx);
  } else {
    d.txHash = getTxHash(d.tx);
  }
  return d;
}

function _parseEthTx(res) {
  const sigData = res.result.data.sigData.split(config.api.SPLIT_BUF);
  const { params, typeIndex } = res.result.data;
  const s = sigData[1];
  const d = {
    sig: s,
    vrs: [ parseInt(s.slice(-1)) + 27, s.slice(0, 64), s.slice(64, 128) ],
    to: _getEthRecipient(params, typeIndex),
    value: _getEthValue(params),
    height: -1,  // Everything passing through here will be unmined
  }

  // Transaction should be an array of all the original params plus the v,r,s array (there should only be one of those)
  const vrsToUse = [ d.vrs[0], Buffer.from(d.vrs[1], 'hex'), Buffer.from(d.vrs[2], 'hex') ];
  // d.tx = `0x${_rlpEncode(params.concat(vrsToUse)).toString('hex')}`;
  d.tx = _getEthTx(params, typeIndex, vrsToUse);
  d.txHash = null;
  d.unsignedTx = sigData[0];
  return d;
}

function _getEthRecipient(params, typeIndex) {
  if (typeIndex === 0) {
    return params[3];
  } else if (typeIndex === 1) {
    // ERC20
    return params[3]
  }
}

function _getEthValue(params) {
  const gasPrice = params[1];
  const gas = params[2];
  const value = params[4];
  return -1 * ((gas * gasPrice) - value);
}

function _getEthTx(params, typeIndex, vrs) {
  if (typeIndex === 1) {
    const amount = params.pop();
    const recipient = params.pop();
    const fCode = params.pop();
    const d = `${fCode}${pad64(recipient)}${pad64(amount)}`;
    params.push(d);
  }
  return `0x${_rlpEncode(params.concat(vrs)).toString('hex')}`
}

function getTxHash(x) {
  if (typeof x === 'string') x = Buffer.from(x, 'hex');
  const h1 = ec.hash().update(x).digest();
  const h2 = ec.hash().update(h1).digest('hex');
  return Buffer.from(h2, 'hex').reverse().toString('hex');
}

function _encodeLength (len, offset) {
  if (len < 56) {
    return Buffer.from([len + offset])
  } else {
    const hexLength = _intToHex(len)
    const lLength = hexLength.length / 2
    const firstByte = _intToHex(offset + 55 + lLength)
    return Buffer.from(firstByte + hexLength, 'hex')
  }
}

function _intToHex (i) {
  let hex = i.toString(16)
  if (hex.length % 2) {
    hex = '0' + hex
  }
  return hex
}

function _intToBuffer (i) {
  const hex = _intToHex(i)
  return Buffer.from(hex, 'hex')
}

function _isHexPrefixed (str) {
  return str.slice(0, 2) === '0x'
}

function _padToEven (a) {
  if (a.length % 2) a = '0' + a
  return a
}

function _stripHexPrefix (str) {
  if (typeof str !== 'string') {
    return str
  }
  return _isHexPrefixed(str) ? str.slice(2) : str
}

function _toBuffer (v) {
  if (!Buffer.isBuffer(v)) {
    if (typeof v === 'string') {
      if (_isHexPrefixed(v)) {
        v = Buffer.from(_padToEven(_stripHexPrefix(v)), 'hex')
      } else {
        v = Buffer.from(v)
      }
    } else if (typeof v === 'number') {
      if (!v) {
        v = Buffer.from([])
      } else {
        v = _intToBuffer(v)
      }
    } else if (v === null || v === undefined) {
      v = Buffer.from([])
    } else if (v.toArray) {
      // converts a BN to a Buffer
      v = Buffer.from(v.toArray())
    } else if (v instanceof Uint8Array) {
      v = Buffer.from(v)
    } else {
      throw new Error('invalid type')
    }
  }
  return v
}

function _rlpEncode(input) {
  if (input instanceof Array) {
    const output = []
    for (let i = 0; i < input.length; i++) {
      output.push(_rlpEncode(input[i]))
    }
    const buf = Buffer.concat(output)
    return Buffer.concat([_encodeLength(buf.length, 192), buf])
  } else {
    input = _toBuffer(input)
    if (input.length === 1 && input[0] < 128) {
      return input
    } else {
      return Buffer.concat([_encodeLength(input.length, 128), input])
    }
  }
}

module.exports = {
  txBuildingResolver,
  aes256_decrypt,
  aes256_encrypt,
  parseDER,
  buildFullEthSig,
  checksum,
  getBitcoinAddress,
  parseLattice1Response,
  getOutputScriptType,
  getP256KeyPair,
  getP256KeyPairFromPub,
  pad64,
  unpad,
  parseSigResponse,
  sortByHeight,
  getTxHash,
  toPaddedDER,
}