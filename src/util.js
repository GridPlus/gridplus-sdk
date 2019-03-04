// Static utility functions
const Buffer = require('buffer/').Buffer
import aes from 'aes-js';
import leftPad from 'left-pad';
import elliptic from 'elliptic';
import config from './config';
import { dict, OPs } from './constants';
const EC = elliptic.ec;
const ec = new EC('p256');

// Create a new appSecret of specified length
export function genAppSecret(L) {
  let secret = '';
  for (i = 0; i < L; i++) {
    const j = Math.floor(Math.random() * dict.length);
    secret += dict[j];
  }
  return secret;
}

// Ensure provided app secret is a string and matches
// the desired dictionary
export function checkAppSecret(s) {
  if (typeof s !== 'string') return false;
  for (i = 0; i < s.length; i++) {
    if (dict.indexOf(s[i]) === -1) return false;
  }
  return true;
}

export function getProviderShortCode(schemaCode) {
  switch (schemaCode) {
    case 'ETH':
      return 'ETH';
    case 'ETH-ERC20':
      return 'ETH';
    case 'ETH-Unstructured':
      return 'ETH';
    case 'BTC':
      return 'BTC';
  }
}

export function getOutputScriptType(s, multisig=false) {
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

export function getP256KeyPair (priv) {
  return ec.keyFromPrivate(priv, 'hex');
}

// left-pad with zeros up to 64 bytes
export function pad64 (x) {
  if (typeof x === 'number') x = x.toString(16);
  return leftPad(x.substr(0, 2) === '0x' ? x.slice(2) : x, 64, '0');
}

// Remove all leading zeros in piece of data
export function unpad (x) {
  if (x.substr(0, 2) === '0x') x = x.slice(2);
  return x.slice(24);
}

// Derive a shared secret using ECDH via curve25519
export function deriveSecret (privKey, pubKey) {
  if (typeof privKey !== 'string') privKey = privKey.toString('hex');
  if (typeof pubKey !== 'string') pubKey = pubKey.toString('hex');
  const privInst = ec.keyFromPrivate(privKey, 'hex');
  const pubInst = ec.keyFromPublic(pubKey, 'hex');
  return privInst.derive(pubInst.getPublic()).toString('hex');
}

// Decrypt using an AES secret and a counter
export function decrypt (payload, secret, counter=5) {
  if (typeof secret === 'string') secret = Buffer.from(secret, 'hex');
  const b = aes.utils.hex.toBytes(payload);
  const aesCtr = new aes.ModeOfOperation.ctr(secret, new aes.Counter(counter));
  const dec = aesCtr.decrypt(b);
  return aes.utils.utf8.fromBytes(dec);
}

export function encrypt (payload, secret, counter=5) {
  if (typeof secret === 'string') secret = Buffer.from(secret, 'hex');
  const b = aes.utils.utf8.toBytes(payload);
  const aesCtr = new aes.ModeOfOperation.ctr(secret, new aes.Counter(counter));
  const enc = aesCtr.encrypt(b);
  return aes.utils.hex.fromBytes(enc);
}

export function parseSigResponse(res) {
  if (res.result && res.result.status === 200) {    
    switch (res.result.data.schemaIndex) {
      case 0: // ETH
        return parseEthTx(res);
      case 1: // BTC
        return parseBtcTx(res);
      default:
        return null;
    }
  } else {
    return null;
  }
}

export const sortByHeight = (_utxos) => {
  if (!_utxos) return [];
  return _utxos.sort((a, b) => {
    return (a.height > b.height) ? 1 : ((b.height > a.height) ? -1 : 0)
  });
}

// Get the serialized transaction and the appropriate txHash
function parseBtcTx(res) {
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

function parseEthTx(res) {
  const sigData = res.result.data.sigData.split(config.api.SPLIT_BUF);
  const { params, typeIndex } = res.result.data;
  const s = sigData[1];
  const d = {
    sig: s,
    vrs: [ parseInt(s.slice(-1)) + 27, s.slice(0, 64), s.slice(64, 128) ],
    to: getEthRecipient(params, typeIndex),
    value: getEthValue(params),
    height: -1,  // Everything passing through here will be unmined
  }

  // Transaction should be an array of all the original params plus the v,r,s array (there should only be one of those)
  const vrsToUse = [ d.vrs[0], Buffer.from(d.vrs[1], 'hex'), Buffer.from(d.vrs[2], 'hex') ];
  // d.tx = `0x${rlpEncode(params.concat(vrsToUse)).toString('hex')}`;
  d.tx = getEthTx(params, typeIndex, vrsToUse);
  d.txHash = null;
  d.unsignedTx = sigData[0];
  return d;
}

function getEthRecipient(params, typeIndex) {
  if (typeIndex === 0) {
    return params[3];
  } else if (typeIndex === 1) {
    // ERC20
    return params[3]
  }
}

function getEthValue(params) {
  const gasPrice = params[1];
  const gas = params[2];
  const value = params[4];
  return -1 * ((gas * gasPrice) - value);
}

function getEthTx(params, typeIndex, vrs) {
  if (typeIndex === 1) {
    const amount = params.pop();
    const recipient = params.pop();
    const fCode = params.pop();
    const d = `${fCode}${pad64(recipient)}${pad64(amount)}`;
    params.push(d);
  }
  return `0x${rlpEncode(params.concat(vrs)).toString('hex')}`
}


export function getTxHash(x) {
  if (typeof x === 'string') x = Buffer.from(x, 'hex');
  const h1 = ec.hash().update(x).digest();
  const h2 = ec.hash().update(h1).digest('hex');
  return Buffer.from(h2, 'hex').reverse().toString('hex');
}

function encodeLength (len, offset) {
  if (len < 56) {
    return Buffer.from([len + offset])
  } else {
    const hexLength = intToHex(len)
    const lLength = hexLength.length / 2
    const firstByte = intToHex(offset + 55 + lLength)
    return Buffer.from(firstByte + hexLength, 'hex')
  }
}

function intToHex (i) {
  let hex = i.toString(16)
  if (hex.length % 2) {
    hex = '0' + hex
  }
  return hex
}

function intToBuffer (i) {
  const hex = intToHex(i)
  return Buffer.from(hex, 'hex')
}

function isHexPrefixed (str) {
  return str.slice(0, 2) === '0x'
}

function padToEven (a) {
  if (a.length % 2) a = '0' + a
  return a
}

function stripHexPrefix (str) {
  if (typeof str !== 'string') {
    return str
  }
  return isHexPrefixed(str) ? str.slice(2) : str
}

function toBuffer (v) {
  if (!Buffer.isBuffer(v)) {
    if (typeof v === 'string') {
      if (isHexPrefixed(v)) {
        v = Buffer.from(padToEven(stripHexPrefix(v)), 'hex')
      } else {
        v = Buffer.from(v)
      }
    } else if (typeof v === 'number') {
      if (!v) {
        v = Buffer.from([])
      } else {
        v = intToBuffer(v)
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

function rlpEncode(input) {
  if (input instanceof Array) {
    const output = []
    for (let i = 0; i < input.length; i++) {
      output.push(rlpEncode(input[i]))
    }
    const buf = Buffer.concat(output)
    return Buffer.concat([encodeLength(buf.length, 192), buf])
  } else {
    input = toBuffer(input)
    if (input.length === 1 && input[0] < 128) {
      return input
    } else {
      return Buffer.concat([encodeLength(input.length, 128), input])
    }
  }
}