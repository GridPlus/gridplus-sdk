// Static utility functions
const { buildBitcoinTxRequest } = require('./bitcoin');
const {
  buildEthereumTxRequest,
  buildEthereumMsgRequest,
  ensureHexBuffer,
} = require('./ethereum');
const Buffer = require('buffer/').Buffer;
const aes = require('aes-js');
const crc32 = require('crc-32');
const elliptic = require('elliptic');
const {
  AES_IV,
  BIP_CONSTANTS,
  HARDENED_OFFSET,
  responseCodes,
  responseMsgs,
  VERSION_BYTE,
} = require('./constants');
const { COINS, PURPOSES } = BIP_CONSTANTS;
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
  };
  const b = Buffer.from(r, 'hex');
  let off = 0;

  // Get protocol version
  const protoVer = b.readUInt8(off);
  off++;
  if (protoVer !== VERSION_BYTE) {
    parsed.err = 'Incorrect protocol version. Please update your SDK';
    return parsed;
  }

  // Get the type of response
  // Should always be 0x00
  const msgType = b.readUInt8(off);
  off++;
  if (msgType !== 0x00) {
    parsed.err = 'Incorrect response from Lattice1';
    return parsed;
  }

  // Get the payload
  b.readUInt32BE(off);
  off += 4; // First 4 bytes is the id, but we don't need that anymore
  const len = b.readUInt16BE(off);
  off += 2;
  const payload = b.slice(off, off + len);
  off += len;

  // Get response code
  const responseCode = payload.readUInt8(0);
  if (responseCode !== responseCodes.RESP_SUCCESS) {
    parsed.err = `Error from device: ${
      responseMsgs[responseCode] ? responseMsgs[responseCode] : 'Unknown Error'
    }`;
    parsed.responseCode = responseCode;
    return parsed;
  } else {
    parsed.data = payload.slice(1, payload.length);
  }

  // Verify checksum
  const cs = b.readUInt32BE(off);
  const expectedCs = checksum(b.slice(0, b.length - 4));
  if (cs !== expectedCs) {
    parsed.err = 'Invalid checksum from device response';
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
const signReqResolver = {
  BTC: buildBitcoinTxRequest,
  ETH: buildEthereumTxRequest,
  ETH_MSG: buildEthereumMsgRequest,
};

function isValidAssetPath(path, fwConstants) {
  const allowedPurposes = [
    PURPOSES.ETH,
    PURPOSES.BTC_LEGACY,
    PURPOSES.BTC_WRAPPED_SEGWIT,
    PURPOSES.BTC_SEGWIT,
  ];
  const allowedCoins = [COINS.ETH, COINS.BTC, COINS.BTC_TESTNET];
  // These coin types were given to us by MyCrypto. They should be allowed, but we expect
  // an Ethereum-type address with these coin types.
  // These all use SLIP44: https://github.com/satoshilabs/slips/blob/master/slip-0044.md
  const allowedMyCryptoCoins = [
    60, 61, 966, 700, 9006, 9000, 1007, 553, 178, 137, 37310, 108, 40, 889,
    1987, 820, 6060, 1620, 1313114, 76, 246529, 246785, 1001, 227, 916, 464,
    2221, 344, 73799, 246,
  ];
  // Make sure firmware supports this Bitcoin path
  const isBitcoin = path[1] === COINS.BTC || path[1] === COINS.BTC_TESTNET;
  const isBitcoinNonWrappedSegwit =
    isBitcoin && path[0] !== PURPOSES.BTC_WRAPPED_SEGWIT;
  if (isBitcoinNonWrappedSegwit && !fwConstants.allowBtcLegacyAndSegwitAddrs)
    return false;
  // Make sure this path is otherwise valid
  return (
    allowedPurposes.indexOf(path[0]) >= 0 &&
    (allowedCoins.indexOf(path[1]) >= 0 ||
      allowedMyCryptoCoins.indexOf(path[1] - HARDENED_OFFSET) > 0)
  );
}

//--------------------------------------------------
// CRYPTO UTILS
//--------------------------------------------------
function aes256_encrypt(data, key) {
  const iv = Buffer.from(AES_IV);
  const aesCbc = new aes.ModeOfOperation.cbc(key, iv);
  const paddedData =
    data.length % 16 === 0 ? data : aes.padding.pkcs7.pad(data);
  return Buffer.from(aesCbc.encrypt(paddedData));
}

function aes256_decrypt(data, key) {
  const iv = Buffer.from(AES_IV);
  const aesCbc = new aes.ModeOfOperation.cbc(key, iv);
  return Buffer.from(aesCbc.decrypt(data));
}

// Decode a DER signature. Returns signature object {r, s } or null if there is an error
function parseDER(sigBuf) {
  if (sigBuf[0] !== 0x30 || sigBuf[2] !== 0x02) return null;
  let off = 3;
  const sig = { r: null, s: null };
  const rLen = sigBuf[off];
  off++;
  sig.r = sigBuf.slice(off, off + rLen);
  off += rLen;
  if (sigBuf[off] !== 0x02) return null;
  off++;
  const sLen = sigBuf[off];
  off++;
  sig.s = sigBuf.slice(off, off + sLen);
  return sig;
}

function getP256KeyPair(priv) {
  return ec.keyFromPrivate(priv, 'hex');
}

function getP256KeyPairFromPub(pub) {
  return ec.keyFromPublic(pub, 'hex');
}

module.exports = {
  isValidAssetPath,
  ensureHexBuffer,
  signReqResolver,
  aes256_decrypt,
  aes256_encrypt,
  parseDER,
  checksum,
  parseLattice1Response,
  getP256KeyPair,
  getP256KeyPairFromPub,
  toPaddedDER,
};
