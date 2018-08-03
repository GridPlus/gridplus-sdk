// Static utility functions
const Buffer = require('buffer/').Buffer
import aes from 'aes-js';
import leftPad from 'left-pad';
import elliptic from 'elliptic';
import config from './config';

const EC = elliptic.ec;
const ec = new EC('curve25519');

export function ecdsaKeyPair (privKey) {
  const curve = new EC('secp256k1');
  const key = curve.keyFromPrivate(privKey, 'hex');
  key.getPublic();
  return key;
}

export function ecdhKeyPair (priv) {
  return ec.keyFromPrivate(priv, 'hex');
}

// left-pad with zeros up to 64 bytes
export function pad64 (x) {
  return leftPad(x.substr(0, 2) === '0x' ? x.slice(2) : x, 64, '0');
}

// Remove all leading zeros in piece of data
export function unpad (x) {
  if (x.substr(0, 2) === '0x') x = x.slice(2);
  let _i = 0;
  for (let i = 0; i < x.length; i++) {
    if (x[i] === 0) _i += 1;
    else return x.slice(_i);
  }
  return x.slice(_i);
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
    const sigData = res.result.data.sigData.split(config.api.SPLIT_BUF);
    const witnessData = res.result.witnessData;
    let d = {
      tx: sigData[0],
      sigs: sigData.slice(1),
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
  } else {
    return null;
  }
}

export function getTxHash(x) {
  if (typeof x === 'string') x = Buffer.from(x, 'hex');
  const h1 = ec.hash().update(x).digest();
  const h2 = ec.hash().update(h1).digest('hex');
  return Buffer.from(h2, 'hex').reverse().toString('hex');
}