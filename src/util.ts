// Static utility functions
import aes from 'aes-js';
import BN from 'bignumber.js';
import { Buffer } from 'buffer/';
import crc32 from 'crc-32';
import elliptic from 'elliptic';
import {
  AES_IV,
  BIP_CONSTANTS,
  HARDENED_OFFSET,
  responseCodes,
  responseMsgs,
  VERSION_BYTE
} from './constants';
const { COINS, PURPOSES } = BIP_CONSTANTS;
const EC = elliptic.ec;
const ec = new EC('p256');
//--------------------------------------------------
// LATTICE UTILS
//--------------------------------------------------

// Parse a response from the Lattice1
export const parseLattice1Response = function(r) {
  const parsed: any = {
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

export const checksum = function(x) {
  // crc32 returns a signed integer - need to cast it to unsigned
  // Note that this uses the default 0xedb88320 polynomial
  return crc32.buf(x) >>> 0; // Need this to be a uint, hence the bit shift
}

// Get a 74-byte padded DER-encoded signature buffer
// `sig` must be the signature output from elliptic.js
export const toPaddedDER = function(sig) {
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
export const isValidAssetPath = function(path, fwConstants) {
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

export const splitFrames = function(data, frameSz) {
  const frames = [];
  const n = Math.ceil(data.length / frameSz);
  let off = 0;
  for (let i = 0; i < n; i++) {
    frames.push(data.slice(off, off + frameSz));
    off += frameSz;
  }
  return frames;
}

function isBase10NumStr(x) {
  const bn = new BN(x).toString().split('.').join('');
  const s = new String(x);
  // Note that the JS native `String()` loses precision for large numbers, but we only
  // want to validate the base of the number so we don't care about far out precision.
  return bn.slice(0, 8) === s.slice(0, 8);
}

// Ensure a param is represented by a buffer
export const ensureHexBuffer = function(x, zeroIsNull = true) {
  try {
    // For null values, return a 0-sized buffer. For most situations we assume
    // 0 should be represented with a zero-length buffer (e.g. for RLP-building
    // txs), but it can also be treated as a 1-byte buffer (`00`) if needed
    if (x === null || (x === 0 && zeroIsNull === true)) return Buffer.alloc(0);
    const isNumber = typeof x === 'number' || isBase10NumStr(x);
    // Otherwise try to get this converted to a hex string
    if (isNumber) {
      // If this is a number or a base-10 number string, convert it to hex
      x = `${new BN(x).toString(16)}`;
    } else if (typeof x === 'string' && x.slice(0, 2) === '0x') {
      x = x.slice(2);
    } else {
      x = x.toString('hex');
    }
    if (x.length % 2 > 0) x = `0${x}`;
    if (x === '00' && !isNumber) return Buffer.alloc(0);
    return Buffer.from(x, 'hex');
  } catch (err) {
    throw new Error(
      `Cannot convert ${x.toString()} to hex buffer (${err.toString()})`
    );
  }
}

export const fixLen = function(msg, length) {
  const buf = Buffer.alloc(length);
  if (msg.length < length) {
    msg.copy(buf, length - msg.length);
    return buf;
  }
  return msg.slice(-length);
}

//--------------------------------------------------
// CRYPTO UTILS
//--------------------------------------------------
export const aes256_encrypt = function(data, key) {
  const iv = Buffer.from(AES_IV);
  const aesCbc = new aes.ModeOfOperation.cbc(key, iv);
  const paddedData =
    data.length % 16 === 0 ? data : aes.padding.pkcs7.pad(data);
  return Buffer.from(aesCbc.encrypt(paddedData));
}

export const aes256_decrypt = function(data, key) {
  const iv = Buffer.from(AES_IV);
  const aesCbc = new aes.ModeOfOperation.cbc(key, iv);
  return Buffer.from(aesCbc.decrypt(data));
}

// Decode a DER signature. Returns signature object {r, s } or null if there is an error
export const parseDER = function(sigBuf) {
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

export const getP256KeyPair = function(priv) {
  return ec.keyFromPrivate(priv, 'hex');
}

export const getP256KeyPairFromPub = function(pub) {
  return ec.keyFromPublic(pub, 'hex');
}

export const buildSignerPathBuf = function(signerPath, varAddrPathSzAllowed) {
  const buf = Buffer.alloc(24);
  let off = 0;
  if (varAddrPathSzAllowed && signerPath.length > 5)
    throw new Error('Signer path must be <=5 indices.');
  if (!varAddrPathSzAllowed && signerPath.length !== 5)
    throw new Error(
      'Your Lattice firmware only supports 5-index derivation paths. Please upgrade.'
    );
  buf.writeUInt32LE(signerPath.length, off);
  off += 4;
  for (let i = 0; i < 5; i++) {
    if (i < signerPath.length) buf.writeUInt32LE(signerPath[i], off);
    else buf.writeUInt32LE(0, off);
    off += 4;
  }
  return buf;
}

//--------------------------------------------------
// OTHER UTILS
//--------------------------------------------------
export const isAsciiStr = function(str, allowFormatChars=false) {
  if (typeof str !== 'string') {
    return false;
  }
  const extraChars =  allowFormatChars ?
                      [
                        0x0020, // Space
                        0x000a, // New line
                      ] : [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (extraChars.indexOf(c) < 0 && (c < 0x0020 || c > 0x007f)) {
      return false;
    }
  }
  return true;
}

// Check if a value exists in an object. Only checks first level of keys.
export const existsIn = function(val, obj) {
  return Object.keys(obj).some(key => obj[key] === val);
}