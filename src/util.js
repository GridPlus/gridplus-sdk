// Static utility functions
const bitcoin = require('./bitcoin');
const ethereum = require('./ethereum');
const Buffer = require('buffer/').Buffer
const aes = require('aes-js');
const crc32 = require('crc-32');
const elliptic = require('elliptic');
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
const txBuildingResolver = {
  'BTC': bitcoin.buildBitcoinTxRequest,
  'ETH': ethereum.buildEthereumTxRequest,
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

function getP256KeyPair (priv) {
  return ec.keyFromPrivate(priv, 'hex');
}

function getP256KeyPairFromPub(pub) {
  return ec.keyFromPublic(pub, 'hex');
}


module.exports = {
  txBuildingResolver,
  aes256_decrypt,
  aes256_encrypt,
  parseDER,
  checksum,
  parseLattice1Response,
  getP256KeyPair,
  getP256KeyPairFromPub,
  toPaddedDER,
}