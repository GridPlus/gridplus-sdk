import { readFileSync } from 'node:fs';
import type { TypedTransaction } from '@ethereumjs/tx';
import BIP32Factory from 'bip32';
import { wordlists } from 'bip39';
import type { Payment } from 'bitcoinjs-lib';
import bitcoin from 'bitcoinjs-lib';
import BN from 'bn.js';
import { ECPairFactory } from 'ecpair';
import {
  derivePath as deriveEDKey,
  getPublicKey as getEDPubkey,
} from 'ed25519-hd-key';
import { ec as EC } from 'elliptic';
import { privateToAddress } from 'ethereumjs-util';
import { jsonc } from 'jsonc';
import { Hash } from 'ox';
import { ecdsaRecover } from 'secp256k1';
import * as ecc from 'tiny-secp256k1';
import nacl from 'tweetnacl';
import { Constants } from '../..';
import { Client } from '../../client';
import {
  BIP_CONSTANTS,
  ethMsgProtocol,
  HARDENED_OFFSET,
} from '../../constants';
import { ProtocolConstants } from '../../protocol';
import { getPathStr } from '../../shared/utilities';
import {
  ensureHexBuffer,
  getV,
  getYParity,
  parseDER,
  randomBytes,
} from '../../util';
import { getEnv } from './getters';
import { setStoredClient } from './setup';

const SIGHASH_ALL = 0x01;
const secp256k1 = new EC('secp256k1');
const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

const normalizeSigComponent = (component: any): Buffer => {
  if (component === null || component === undefined) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(component)) {
    return component;
  }
  if (component instanceof Uint8Array) {
    return Buffer.from(component);
  }
  if (typeof component === 'bigint') {
    const hex = component.toString(16);
    return Buffer.from(hex.padStart(hex.length + (hex.length % 2), '0'), 'hex');
  }
  if (typeof component === 'number') {
    return ensureHexBuffer(component);
  }
  if (typeof component === 'string') {
    return ensureHexBuffer(component);
  }
  if (typeof component?.toArray === 'function') {
    return Buffer.from(component.toArray('be'));
  }
  if (typeof component?.toBuffer === 'function') {
    return Buffer.from(component.toBuffer());
  }
  if (typeof component?.toString === 'function') {
    return ensureHexBuffer(component.toString());
  }
  throw new Error('Unsupported signature component format');
};

/**
 * Get the appropriate V parameter for a transaction signature based on transaction type.
 * For typed transactions (EIP-1559, EIP-2930, etc.), returns yParity as hex string.
 * For legacy transactions, returns the full V value.
 */
export const getSignatureVParam = (tx: any, resp: any): string => {
  if (tx._type && tx._type > 0) {
    // For EIP-1559 and newer transaction types, use yParity (0 or 1)
    return getYParity(tx, resp).toString(16).padStart(2, '0');
  } else {
    // For legacy transactions, return full V value
    const vBn = getV(tx, resp);
    return vBn.toString(16).padStart(2, '0');
  }
};

/**
 * Get the appropriate V parameter as BN for signature validation based on transaction type.
 * For typed transactions, returns yParity (0 or 1) as BN.
 * For legacy transactions, returns the full V value as BN.
 */
export const getSignatureVBN = (tx: any, resp: any): BN => {
  if (tx._type && tx._type > 0) {
    // For EIP-1559 and newer transaction types, get y-parity (0 or 1)
    return new BN(getYParity(tx, resp));
  } else {
    // For legacy transactions, use the v value from signature
    return new BN(resp.sig.v);
  }
};

// NOTE: We use the HARDEN(49) purpose for p2sh(p2wpkh) address derivations.
//       For p2pkh-derived addresses, we use the legacy 44' purpose
//       For p2wpkh-derived addresse (not yet supported) we will use 84'
export const BTC_PURPOSE_P2WPKH = BIP_CONSTANTS.PURPOSES.BTC_SEGWIT;
export const BTC_PURPOSE_P2SH_P2WPKH =
  BIP_CONSTANTS.PURPOSES.BTC_WRAPPED_SEGWIT;
export const BTC_PURPOSE_P2PKH = BIP_CONSTANTS.PURPOSES.BTC_LEGACY;
export const BTC_COIN = BIP_CONSTANTS.COINS.BTC;
export const BTC_TESTNET_COIN = BIP_CONSTANTS.COINS.BTC_TESTNET;
export const ETH_COIN = BIP_CONSTANTS.COINS.ETH;
export const REUSABLE_KEY =
  '3fb53b677f73e4d2b8c89c303f6f6b349f0075ad88ea126cb9f6632085815dca';

export function setupTestClient(
  env = getEnv() as any,
  stateData?: any,
): Client {
  if (stateData) {
    return new Client({ stateData });
  }
  const setup: any = {
    name: env.APP_NAME || 'SDK Test',
    baseUrl: env.baseUrl || 'https://signing.gridpl.us',
    timeout: 120000,
    setStoredClient,
  };

  // If the user passes a deviceID in the env, we assume they have previously
  // connected to the Lattice.
  if (env.DEVICE_ID) {
    setup.privKey = Buffer.from(REUSABLE_KEY, 'hex');
  }
  // Separate check -- if we are connecting for the first time but want to be able
  // to reconnect quickly with the same device ID as an env var, we need to pair
  // with a reusable key
  if (parseInt(env.REUSE_KEY) === 1) {
    setup.privKey = Buffer.from(REUSABLE_KEY, 'hex');
  }
  // Initialize a global SDK client
  const client = new Client(setup);
  return client;
}

export const unharden = (x) => {
  return x >= HARDENED_OFFSET ? x - HARDENED_OFFSET : x;
};

export const buildPath = (indices) => {
  let path = 'm';
  indices.forEach((idx) => {
    // eslint-disable-next-line quotes
    path += `/${unharden(idx)}${idx >= HARDENED_OFFSET ? "'" : ''}`;
  });
  return path;
};

export function _getSumInputs(inputs) {
  let sum = 0;
  inputs.forEach((input) => {
    sum += input.value;
  });
  return sum;
}

export function _get_btc_addr(pubkey, purpose, network) {
  const pk = Buffer.isBuffer(pubkey) ? pubkey : Buffer.from(pubkey);
  let obj: Payment;
  if (purpose === BTC_PURPOSE_P2SH_P2WPKH) {
    // Wrapped segwit requires p2sh wrapping
    obj = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ pubkey: pk, network }),
      network,
    });
  } else if (purpose === BTC_PURPOSE_P2WPKH) {
    obj = bitcoin.payments.p2wpkh({ pubkey: pk, network });
  } else {
    // Native segwit and legacy addresses are treated teh same
    obj = bitcoin.payments.p2pkh({ pubkey: pk, network });
  }
  return obj.address;
}

export function _start_tx_builder(
  wallet,
  recipient,
  value,
  fee,
  inputs,
  network,
  purpose,
) {
  const tx = new bitcoin.Transaction();
  // Match serialization logic (version 2) used by device and serializer
  tx.version = 2;
  const inputSum = _getSumInputs(inputs);
  const recipientScript = bitcoin.address.toOutputScript(recipient, network);
  tx.addOutput(recipientScript, value);
  const changeValue = inputSum - value - fee;
  if (changeValue > 0) {
    const networkIdx = network === bitcoin.networks.testnet ? 1 : 0;
    const path = buildPath([purpose, harden(networkIdx), harden(0), 1, 0]);
    const btc_0_change = wallet.derivePath(path);
    const btc_0_change_pub = ECPair.fromPublicKey(
      btc_0_change.publicKey,
    ).publicKey;
    const changeAddr = _get_btc_addr(btc_0_change_pub, purpose, network);
    const changeScript = bitcoin.address.toOutputScript(changeAddr, network);
    tx.addOutput(changeScript, changeValue);
  } else if (changeValue < 0) {
    throw new Error('Value + fee > sumInputs!');
  }
  const inputsMeta: { scriptCode: Buffer; value: number }[] = [];
  inputs.forEach((input) => {
    const hashLE = Buffer.from(input.hash, 'hex').reverse();
    tx.addInput(hashLE, input.idx);
    const coin =
      network === bitcoin.networks.testnet ? BTC_TESTNET_COIN : BTC_COIN;
    const path = buildPath([purpose, coin, harden(0), 0, input.signerIdx]);
    const keyPair = wallet.derivePath(path);
    const pubkeyBuf = Buffer.from(keyPair.publicKey);
    const p2pkh = bitcoin.payments.p2pkh({ pubkey: pubkeyBuf, network });
    // For P2WPKH and P2SH-P2WPKH the BIP143 scriptCode is the standard P2PKH script
    const scriptCode = p2pkh.output!;
    inputsMeta.push({ scriptCode, value: input.value });
  });
  return { tx, inputsMeta };
}

function _build_sighashes(txb_or_tx, purpose) {
  const hashes: any = [];
  const txb = txb_or_tx as any;
  const isLegacy = purpose === BTC_PURPOSE_P2PKH;
  if (txb.inputsMeta) {
    txb.inputsMeta.forEach((meta, i) => {
      hashes.push(
        isLegacy
          ? txb.tx.hashForSignature(i, meta.scriptCode, SIGHASH_ALL)
          : txb.tx.hashForWitnessV0(
              i,
              meta.scriptCode,
              meta.value,
              SIGHASH_ALL,
            ),
      );
    });
  } else {
    // Fallback for prior structure (should not be used)
    txb.__inputs.forEach((input, i) => {
      hashes.push(
        isLegacy
          ? txb.__tx.hashForSignature(i, input.signScript, SIGHASH_ALL)
          : txb.__tx.hashForWitnessV0(
              i,
              input.signScript,
              input.value,
              SIGHASH_ALL,
            ),
      );
    });
  }
  return hashes;
}

function _get_reference_sighashes(
  wallet,
  recipient,
  value,
  fee,
  inputs,
  isTestnet,
  purpose,
) {
  const coin = isTestnet ? BTC_TESTNET_COIN : BTC_COIN;
  const network = isTestnet
    ? bitcoin.networks.testnet
    : bitcoin.networks.bitcoin;
  const built = _start_tx_builder(
    wallet,
    recipient,
    value,
    fee,
    inputs,
    network,
    purpose,
  );
  // built has shape { tx, inputsMeta }
  return _build_sighashes(built, purpose);
}

function _btc_tx_request_builder(
  inputs,
  recipient,
  value,
  fee,
  isTestnet,
  purpose,
) {
  const currencyIdx = isTestnet ? BTC_TESTNET_COIN : BTC_COIN;
  const txData = {
    prevOuts: [] as any[],
    recipient,
    value,
    fee,
    changePath: [purpose, currencyIdx, HARDENED_OFFSET, 1, 0],
  };
  inputs.forEach((input) => {
    txData.prevOuts.push({
      txHash: input.hash,
      value: input.value,
      index: input.idx,
      signerPath: [purpose, currencyIdx, HARDENED_OFFSET, 0, input.signerIdx],
    });
  });
  return {
    currency: 'BTC',
    data: txData,
  };
}

// Convert DER signature to buffer of form `${r}${s}`
export function stripDER(derSig) {
  const parsed = parseDER(derSig);
  // Left-pad r and s to 32 bytes and concatenate (no extra normalization)
  const r = Buffer.from(parsed.r.slice(-32));
  const s = Buffer.from(parsed.s.slice(-32));
  const sig = Buffer.alloc(64);
  r.copy(sig, 32 - r.length);
  s.copy(sig, 64 - s.length);
  return sig;
}

function _get_signing_keys(wallet, inputs, isTestnet, purpose) {
  const currencyIdx = isTestnet ? 1 : 0;
  return inputs.map((input) => {
    const path = buildPath([
      purpose,
      harden(currencyIdx),
      harden(0),
      0,
      input.signerIdx,
    ]);
    const node = wallet.derivePath(path);
    const priv = Buffer.from(node.privateKey);
    const key = secp256k1.keyFromPrivate(priv);
    return {
      privateKey: priv,
      verify(hash: Buffer, sig: Buffer) {
        return key.verify(hash, {
          r: sig.slice(0, 32).toString('hex'),
          s: sig.slice(32).toString('hex'),
        });
      },
    };
  });
}

function _generate_btc_address(isTestnet, purpose, rand) {
  const priv = Buffer.alloc(32);
  for (let j = 0; j < 8; j++) {
    // 32 bits of randomness per call
    priv.writeUInt32BE(Math.floor(rand.quick() * 2 ** 32), j * 4);
  }
  const keyPair = ECPair.fromPrivateKey(priv);
  const network =
    isTestnet === true ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
  return _get_btc_addr(keyPair.publicKey, purpose, network);
}

export function setup_btc_sig_test(opts, wallet, inputs, rand) {
  const { isTestnet, useChange, spenderPurpose, recipientPurpose } = opts;
  const recipient = _generate_btc_address(isTestnet, recipientPurpose, rand);
  const sumInputs = _getSumInputs(inputs);
  const fee = Math.floor(rand.quick() * 50000);
  const _value =
    useChange === true ? Math.floor(rand.quick() * sumInputs) : sumInputs;
  const value = _value - fee;
  const sigHashes = _get_reference_sighashes(
    wallet,
    recipient,
    value,
    fee,
    inputs,
    isTestnet,
    spenderPurpose,
  );
  const signingKeys = _get_signing_keys(
    wallet,
    inputs,
    isTestnet,
    spenderPurpose,
  );
  const txReq = _btc_tx_request_builder(
    inputs,
    recipient,
    value,
    fee,
    isTestnet,
    spenderPurpose,
  );
  return {
    sigHashes,
    signingKeys,
    txReq,
  };
}

export const harden = (x) => {
  return x + HARDENED_OFFSET;
};

export const prandomBuf = (prng, maxSz, forceSize = false) => {
  // Build a random payload that can fit in the base request
  const sz = forceSize ? maxSz : Math.floor(maxSz * prng.quick());
  const buf = Buffer.alloc(sz);
  for (let i = 0; i < sz; i++) {
    buf[i] = Math.floor(0xff * prng.quick());
  }
  return buf;
};

export const deriveED25519Key = (path, seed) => {
  const { key } = deriveEDKey(getPathStr(path), seed);
  const pub = getEDPubkey(key, false); // `false` removes the leading zero byte
  return {
    priv: key,
    pub,
  };
};

export const deriveSECP256K1Key = (path, seed) => {
  const wallet = bip32.fromSeed(seed);
  const key = wallet.derivePath(getPathStr(path));
  return {
    priv: key.privateKey,
    pub: key.publicKey,
  };
};

//============================================================
// Wallet Job integration test helpers
// We test "wallet jobs" using a test harness for debug builds
//=============================================================

//---------------------------------------------------
// Relevant test harness constants
//---------------------------------------------------
export const jobTypes = {
  WALLET_JOB_GET_ADDRESSES: 1,
  WALLET_JOB_SIGN_TX: 2,
  WALLET_JOB_LOAD_SEED: 3,
  WALLET_JOB_EXPORT_SEED: 4,
  WALLET_JOB_DELETE_SEED: 5,
};
export const gpErrors = {
  GP_SUCCESS: 0x00,
  GP_EINVAL: 0xffffffff + 1 - 22, // (4294967061)
  GP_ENODATA: 0xffffffff + 1 - 61, // (4294967100)
  GP_EOVERFLOW: 0xffffffff + 1 - 84, // (4294967123)
  GP_EALREADY: 0xffffffff + 1 - 114, // (4294967153)
  GP_ENODEV: 0xffffffff + 1 - 19, // (4294967058)
  GP_EAGAIN: 0xffffffff + 1 - 11, // (4294967050)
  GP_FAILURE: 0xffffffff + 1 - 128, // (4294967168)
  GP_EWALLET: 0xffffffff + 1 - 113, // (4294967183)
};

//---------------------------------------------------
// General helpers
//---------------------------------------------------
export const getCodeMsg = (code, expected) => {
  if (code !== expected) {
    let codeTxt = code,
      expectedTxt = expected;
    Object.keys(gpErrors).forEach((key) => {
      if (code === gpErrors[key]) {
        codeTxt = key;
      }
      if (expected === gpErrors[key]) {
        expectedTxt = key;
      }
    });
    return `Incorrect response code. Got ${codeTxt}. Expected ${expectedTxt}`;
  }
  return '';
};

export const parseWalletJobResp = (res, v) => {
  const jobRes = {
    resultStatus: null,
    result: null,
  };
  jobRes.resultStatus = res.readUInt32LE(0);
  const dataLen = res.readUInt16LE(4);
  if (v.length === 0 || (v[1] < 10 && v[2] === 0)) {
    // Legacy fw versions (<v0.10.0) erroneously add 4 bytes to the front
    // of the data, which is always zeros. This was a mistake in encoding
    // the status code.
    jobRes.result = res.slice(10, 10 + dataLen);
  } else {
    // New fw versions don't have this extra space
    jobRes.result = res.slice(6, 6 + dataLen);
  }
  return jobRes;
};

export const serializeJobData = (job, walletUID, data) => {
  let serData: Buffer;
  switch (job) {
    case jobTypes.WALLET_JOB_GET_ADDRESSES:
      serData = serializeGetAddressesJobData(data);
      break;
    case jobTypes.WALLET_JOB_SIGN_TX:
      serData = serializeSignTxJobDataLegacy(data);
      break;
    case jobTypes.WALLET_JOB_EXPORT_SEED:
      serData = serializeExportSeedJobData();
      break;
    case jobTypes.WALLET_JOB_DELETE_SEED:
      serData = serializeDeleteSeedJobData(data);
      break;
    case jobTypes.WALLET_JOB_LOAD_SEED:
      serData = serializeLoadSeedJobData(data);
      break;
    default:
      throw new Error('Unsupported job type');
  }
  if (
    false === Buffer.isBuffer(serData) ||
    false === Buffer.isBuffer(walletUID) ||
    32 !== walletUID.length
  )
    throw new Error('Invalid params');

  const req = Buffer.alloc(serData.length + 40);
  let off = 0;
  walletUID.copy(req, off);
  off += walletUID.length;
  req.writeUInt32LE(0, off);
  off += 4; // 0 for callback -- it isn't used
  req.writeUInt32LE(job, off);
  off += 4;
  serData.copy(req, off);
  return req;
};

// First byte of the result data is the error code
export const jobResErrCode = (res) => res.result.readUInt32LE(0);

// Have to do this weird copy because `Buffer`s from the client are not real buffers
// which is a vestige of requiring support on react native
export const copyBuffer = (x) => {
  return Buffer.from(x.toString('hex'), 'hex');
};

// Convert a set of indices to a human readable bip32 path
export const stringifyPath = (parent) => {
  const convert = (parent) => {
    return parent >= HARDENED_OFFSET
      ? `${parent - HARDENED_OFFSET}'`
      : `${parent}`;
  };
  if (parent.idx) {
    // BIP32 style encoding
    let s = 'm';
    for (let i = 0; i < parent.pathDepth; i++) {
      s += `/${convert(parent.idx[i])}`;
    }
    return s;
  }

  let d = parent.pathDepth;
  let s = 'm';
  if (d <= 0) return s;
  if (parent.purpose !== undefined) {
    s += `/${convert(parent.purpose)}`;
    d--;
    if (d <= 0) return s;
  }
  if (parent.coin !== undefined) {
    s += `/${convert(parent.coin)}`;
    d--;
    if (d <= 0) return s;
  }
  if (parent.account !== undefined) {
    s += `/${convert(parent.account)}`;
    d--;
    if (d <= 0) return s;
  }
  if (parent.change !== undefined) {
    s += `/${convert(parent.change)}`;
    d--;
    if (d <= 0) return s;
  }
  if (parent.addr !== undefined) s += `/${convert(parent.addr)}`;
  d--;
  return s;
};

//---------------------------------------------------
// Get Addresses helpers
//---------------------------------------------------
export const serializeGetAddressesJobData = (data) => {
  const req = Buffer.alloc(33);
  let off = 0;
  req.writeUInt32LE(data.path.pathDepth, off);
  off += 4;
  for (let i = 0; i < 5; i++) {
    req.writeUInt32LE(i < data.path.pathDepth ? data.path.idx[i] : 0, off);
    off += 4;
  }
  req.writeUInt32LE(data.iterIdx, off);
  off += 4;
  req.writeUInt32LE(data.count, off);
  off += 4;
  // Deprecated skipCache flag. It isn't used by firmware anymore.
  req.writeUInt8(data.flag || 0, off);
  return req;
};

export const deserializeGetAddressesJobResult = (res) => {
  let off = 0;
  const getAddrResult = {
    count: 0,
    addresses: [] as any[],
    pubOnly: undefined,
  };
  getAddrResult.pubOnly = res.readUInt8(off);
  off += 1;
  getAddrResult.count = res.readUInt8(off);
  off += 3; // Skip a 2-byte empty shim value (for backwards compatibility)
  for (let i = 0; i < getAddrResult.count; i++) {
    const _addr = res.slice(off, off + ProtocolConstants.addrStrLen);
    off += ProtocolConstants.addrStrLen;
    for (let j = 0; j < _addr.length; j++)
      if (_addr[j] === 0x00) {
        getAddrResult.addresses.push(_addr.slice(0, j).toString('utf8'));
        break;
      }
  }
  return getAddrResult;
};

export const validateBTCAddresses = (resp, jobData, seed, useTestnet?) => {
  expect(resp.count).toEqual(jobData.count);
  const wallet = bip32.fromSeed(seed);
  const path = JSON.parse(JSON.stringify(jobData.path));
  const network =
    useTestnet === true ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
  for (let i = 0; i < jobData.count; i++) {
    path.idx[jobData.iterIdx] = jobData.path.idx[jobData.iterIdx] + i;
    // Validate the address
    const purpose = jobData.path.idx[0];
    const pubkey = wallet.derivePath(stringifyPath(path)).publicKey;
    let address: string;
    if (purpose === BTC_PURPOSE_P2WPKH) {
      // Bech32
      address = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(pubkey),
        network,
      }).address;
    } else if (purpose === BTC_PURPOSE_P2SH_P2WPKH) {
      // Wrapped segwit
      address = bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({
          pubkey: Buffer.from(pubkey),
          network,
        }),
      }).address;
    } else {
      // Legacy
      // This is the default and any unrecognized purpose will yield a legacy address.
      address = bitcoin.payments.p2pkh({
        pubkey: Buffer.from(pubkey),
        network,
      }).address;
    }
    expect(address).toEqual(resp.addresses[i]);
  }
};

export const validateETHAddresses = (resp, jobData, seed) => {
  expect(resp.count).toEqual(jobData.count);
  // Confirm it is an Ethereum address
  expect(resp.addresses[0].slice(0, 2)).toEqual('0x');
  expect(resp.addresses[0].length).toEqual(42);
  // Confirm we can derive the same address from the previously exported seed
  const wallet = bip32.fromSeed(seed);
  const path = JSON.parse(JSON.stringify(jobData.path));
  for (let i = 0; i < jobData.count; i++) {
    path.idx[jobData.iterIdx] = jobData.path.idx[jobData.iterIdx] + i;
    const priv = wallet.derivePath(stringifyPath(path)).privateKey;
    const addr = `0x${privateToAddress(priv).toString('hex')}`;
    expect(addr).toEqual(resp.addresses[i]);
  }
};

export const validateDerivedPublicKeys = (
  pubKeys,
  firstPath,
  seed,
  flag?: number,
) => {
  const wallet = bip32.fromSeed(seed);
  // We assume the keys were derived in sequential order
  pubKeys.forEach((pub, i) => {
    const path = JSON.parse(JSON.stringify(firstPath));
    path[path.length - 1] += i;
    if (flag === Constants.GET_ADDR_FLAGS.ED25519_PUB) {
      // ED25519 requires its own derivation
      const key = deriveED25519Key(path, seed);
      expect(pub.toString('hex')).toEqualElseLog(
        key.pub.toString('hex'),
        'Exported ED25519 pubkey incorrect',
      );
    } else {
      // Otherwise this is a SECP256K1 pubkey
      const priv = wallet.derivePath(getPathStr(path)).privateKey;
      expect(pub.toString('hex')).toEqualElseLog(
        secp256k1.keyFromPrivate(priv).getPublic().encode('hex', false),
        'Exported SECP256K1 pubkey incorrect',
      );
    }
  });
};

export const ethPersonalSignMsg = (msg) =>
  '\u0019Ethereum Signed Message:\n' + String(msg.length) + msg;

//---------------------------------------------------
// Sign Transaction helpers
//---------------------------------------------------
export const serializeSignTxJobDataLegacy = (data) => {
  // Serialize a signTX request using the legacy option
  // (see `WalletJobData_SignTx_t` and `SignatureRequest_t`)
  // in firmware for more info on legacy vs generic (new)
  // wallet job requests
  const n = data.sigReq.length;
  const req = Buffer.alloc(4 + 56 * n);
  let off = 0;
  req.writeUInt32LE(data.numRequests, 0);
  off += 4;
  for (let i = 0; i < n; i++) {
    const r = data.sigReq[i];
    r.data.copy(req, off);
    off += r.data.length;
    req.writeUInt32LE(r.signerPath.pathDepth, off);
    off += 4;
    req.writeUInt32LE(r.signerPath.purpose, off);
    off += 4;
    req.writeUInt32LE(r.signerPath.coin, off);
    off += 4;
    req.writeUInt32LE(r.signerPath.account, off);
    off += 4;
    req.writeUInt32LE(r.signerPath.change, off);
    off += 4;
    req.writeUInt32LE(r.signerPath.addr, off);
    off += 4;
  }
  return req;
};

export const deserializeSignTxJobResult = (res: any) => {
  let off = 0;
  const getTxResult: any = {
    numOutputs: null,
    outputs: [],
  };
  getTxResult.numOutputs = res.readUInt32LE(off);
  off += 4;
  const PK_LEN = 65; // uncompressed pubkey
  const SIG_LEN = 74; // DER sig
  const outputSz = 6 * 4 + PK_LEN + SIG_LEN;
  let _off = 0;
  for (let i = 0; i < getTxResult.numOutputs; i++) {
    const o = {
      signerPath: {
        pathDepth: null,
        purpose: null,
        coin: null,
        account: null,
        change: null,
        addr: null,
      },
      pubkey: null as any,
      sig: null as any,
    };
    const _o = res.slice(off, off + outputSz);
    off += outputSz;
    _off = 0;
    o.signerPath.pathDepth = _o.readUInt32LE(_off);
    _off += 4;
    o.signerPath.purpose = _o.readUInt32LE(_off);
    _off += 4;
    o.signerPath.coin = _o.readUInt32LE(_off);
    _off += 4;
    o.signerPath.account = _o.readUInt32LE(_off);
    _off += 4;
    o.signerPath.change = _o.readUInt32LE(_off);
    _off += 4;
    o.signerPath.addr = _o.readUInt32LE(_off);
    _off += 4;
    o.pubkey = secp256k1.keyFromPublic(
      _o.slice(_off, _off + 65).toString('hex'),
      'hex',
    );
    _off += PK_LEN;
    // We get back a DER signature in 74 bytes, but not all the bytes are necessarily
    // used. The second byte contains the DER sig length, so we need to use that.
    const derLen = _o[_off + 1];
    o.sig = Buffer.from(
      _o.slice(_off, _off + 2 + derLen).toString('hex'),
      'hex',
    );
    getTxResult.outputs.push(o);
  }

  return getTxResult;
};

//---------------------------------------------------
// Export Seed helpers
//---------------------------------------------------
export const serializeExportSeedJobData = () => Buffer.alloc(0);

export const deserializeExportSeedJobResult = (res) => {
  let off = 0;
  const seed = res.slice(off, 64);
  off += 64;
  const words = [];
  for (let i = 0; i < 24; i++) {
    const wordIdx = res.slice(off, off + 4).readUInt32LE(0);
    words.push(wordlists.english[wordIdx]);
    off += 4;
  }
  const numWords = res.slice(off, off + 4).readUInt32LE(0);
  off += 4;
  return {
    seed,
    mnemonic: words.slice(0, numWords).join(' '),
  };
};

//---------------------------------------------------
// Delete Seed helpers
//---------------------------------------------------
export const serializeDeleteSeedJobData = (data) => {
  const req = Buffer.alloc(1);
  req.writeUInt8(data.iface, 0);
  return req;
};

//---------------------------------------------------
// Load Seed helpers
//---------------------------------------------------
export const serializeLoadSeedJobData = (data) => {
  const req = Buffer.alloc(217);
  let off = 0;
  req.writeUInt8(data.iface, off);
  off += 1;
  data.seed.copy(req, off);
  off += data.seed.length;
  req.writeUInt8(data.exportability, off);
  off += 1;
  if (data.mnemonic) {
    // Serialize the mnemonic
    const mWords = data.mnemonic.split(' ');
    for (let i = 0; i < mWords.length; i++) {
      req.writeUint32LE(wordlists.english.indexOf(mWords[i]), off + i * 4);
    }
    // Strangely the struct is written with the length of
    // words after the words themselves lol (24 words * 4 bytes per word = 96)
    // (Preserved for fear of any unintended consequences to chaning `BIP39Phrase_t` in fw)
    req.writeUInt32LE(mWords.length, off + 96);
    // Ignore the passphrase since we only use this wallet job
    // helper to test loading a mnemonic onto the card's extraData
    // buffer, which does not include the passphrase.
  }
  return req;
};

//---------------------------------------------------
// Struct builders
//---------------------------------------------------
export const buildRandomEip712Object = (randInt) => {
  function randStr(n) {
    const words = wordlists['english'];
    let s = '';
    while (s.length < n) {
      s += `${words?.[randInt(words?.length)]}_`;
    }
    return s.slice(0, n);
  }
  function getRandomName(upperCase = false, sz = 20) {
    const name = randStr(sz);
    if (upperCase === true)
      return `${name.slice(0, 1).toUpperCase()}${name.slice(1)}`;
    return name;
  }
  function getRandomEIP712Type(customTypes: any[] = []) {
    const types = Object.keys(customTypes).concat(
      Object.keys(ethMsgProtocol.TYPED_DATA.typeCodes),
    );
    return {
      name: getRandomName(),
      type: types[randInt(types.length)],
    };
  }
  function getRandomEIP712Val(type) {
    if (type !== 'bytes' && type.slice(0, 5) === 'bytes') {
      return `0x${randomBytes(parseInt(type.slice(5))).toString('hex')}`;
    }

    if (type === 'uint' || type.indexOf('uint') === 0) {
      const bits = parseInt(type.slice(4) || '256', 10);
      const byteLength = Math.max(1, Math.ceil(bits / 8));
      return `0x${randomBytes(byteLength).toString('hex')}`;
    }

    if (type === 'int' || type.indexOf('int') === 0) {
      const bits = parseInt(type.slice(3) || '256', 10);
      const byteLength = Math.max(1, Math.ceil(bits / 8));
      const raw = randomBytes(byteLength).toString('hex');
      const modulus = 1n << BigInt(bits);
      const halfModulus = modulus >> 1n;
      let value = BigInt(`0x${raw}`);
      value = ((value % modulus) + modulus) % modulus;
      if (value >= halfModulus) {
        value -= modulus;
      }
      return value.toString();
    }
    switch (type) {
      case 'bytes':
        return `0x${randomBytes(1 + randInt(50)).toString('hex')}`;
      case 'string':
        return randStr(100);
      case 'bool':
        return randInt(1) > 0 ? true : false;
      case 'address':
        return `0x${randomBytes(20).toString('hex')}`;
      default:
        throw new Error('unsupported eip712 type');
    }
  }
  function buildCustomTypeVal(typeName, msg) {
    const val = {};
    const subTypes = msg.types[typeName];
    subTypes.forEach((subType) => {
      if (Object.keys(msg.types).indexOf(subType.type) > -1) {
        // If this is a custom type we need to recurse
        val[subType.name] = buildCustomTypeVal(subType.type, msg);
      } else {
        val[subType.name] = getRandomEIP712Val(subType.type);
      }
    });
    return val;
  }

  const msg = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
    },
    primaryType: `Primary_${getRandomName(true)}`,
    domain: {
      name: `Domain_${getRandomName(true)}`,
      version: '1',
      chainId: `0x${(1 + randInt(15000)).toString(16)}`,
      verifyingContract: `0x${randomBytes(20).toString('hex')}`,
    },
    message: {},
  };
  msg.types[msg.primaryType] = [];

  // Create custom types and add them to the types definitions
  const numCustomTypes = 1 + randInt(3);
  const numDefaulTypes = 1 + randInt(3);
  const customTypesMap: any = {};
  for (let i = 0; i < numCustomTypes; i++) {
    const subTypes: any[] = [];
    for (let j = 0; j < 1 + randInt(3); j++) {
      subTypes.push(getRandomEIP712Type(customTypesMap));
    }
    // Capitalize custom type names to distinguish them
    let typeName = getRandomName(true);
    typeName = `${typeName.slice(0, 1).toUpperCase()}${typeName.slice(1)}`;
    customTypesMap[typeName] = subTypes;
    // Record the type
    msg.types[typeName] = subTypes;
    // Add a record in the primary type. We will need to create a value later.
    msg.types[msg.primaryType].push({
      name: getRandomName(),
      type: typeName,
    });
  }
  // Generate default (i.e. "atomic") types to mix into the message
  for (let i = 0; i < numDefaulTypes; i++) {
    const t = getRandomEIP712Type();
    // Add to the primary type definition
    msg.types[msg.primaryType].push(t);
  }
  // Generate random values
  msg.types[msg.primaryType].forEach((typeDef) => {
    if (Object.keys(msg.types).indexOf(typeDef.type) === -1) {
      // Normal EIP712 atomic type
      msg.message[typeDef.name] = getRandomEIP712Val(typeDef.type);
    } else {
      // Custom type
      msg.message[typeDef.name] = buildCustomTypeVal(typeDef.type, msg);
    }
  });
  return msg;
};

//---------------------------------------------------
// Generic signing
//---------------------------------------------------
export const validateGenericSig = (seed, sig, payloadBuf, req, pubkey?) => {
  const { signerPath, hashType, curveType } = req;
  const HASHES = Constants.SIGNING.HASHES;
  const CURVES = Constants.SIGNING.CURVES;
  let hash: Buffer;
  if (curveType === CURVES.SECP256K1) {
    if (hashType === HASHES.SHA256) {
      hash = Buffer.from(Hash.sha256(payloadBuf));
    } else if (hashType === HASHES.KECCAK256) {
      hash = Buffer.from(Hash.keccak256(payloadBuf));
    } else {
      throw new Error('Bad params');
    }
    const { priv } = deriveSECP256K1Key(signerPath, seed);
    const key = secp256k1.keyFromPrivate(priv);
    const normalizedSig = {
      r: normalizeSigComponent(sig.r).toString('hex'),
      s: normalizeSigComponent(sig.s).toString('hex'),
    };
    expect(key.verify(hash, normalizedSig)).toEqualElseLog(
      true,
      'Signature failed verification.',
    );
  } else if (curveType === CURVES.ED25519) {
    if (hashType !== HASHES.NONE) {
      throw new Error('Bad params');
    }
    const { pub } = deriveED25519Key(signerPath, seed);
    const signature = Buffer.concat([
      normalizeSigComponent(sig.r),
      normalizeSigComponent(sig.s),
    ]);
    const edPublicKey = pubkey ? normalizeSigComponent(pubkey) : pub;
    const isValid = nacl.sign.detached.verify(
      new Uint8Array(payloadBuf),
      new Uint8Array(signature),
      new Uint8Array(edPublicKey),
    );
    expect(isValid).toEqualElseLog(true, 'Signature failed verification.');
  } else {
    throw new Error('Bad params');
  }
};

/**
 * Get a RSV formatted signature string
 * @param resp - response from Lattice. Can be either legacy or generic signing variety
 * @param tx - optional, an @ethereumjs/tx Transaction object
 */
export const getSigStr = (resp: any, tx?: TypedTransaction) => {
  let v: string;
  if (resp.sig.v !== undefined) {
    const vBuf = normalizeSigComponent(resp.sig.v);
    const vHex = vBuf.toString('hex');
    let vInt = vHex ? parseInt(vHex, 16) : 0;
    if (!Number.isFinite(vInt)) {
      vInt = 0;
    }
    if (vInt >= 27) {
      vInt -= 27;
    }
    v = vInt.toString(16).padStart(2, '0');
  } else if (tx) {
    v = getSignatureVParam(tx, resp);
  } else {
    throw new Error('Could not build sig string');
  }
  const rHex = normalizeSigComponent(resp.sig.r).toString('hex');
  const sHex = normalizeSigComponent(resp.sig.s).toString('hex');
  return `${rHex}${sHex}${v}`;
};

export function toBuffer(data: string | number | Buffer | Uint8Array): Buffer {
  if (data === null || data === undefined) {
    throw new Error('Invalid data');
  }
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data.buffer, data.byteOffset, data.length);
  }
  if (typeof data === 'number') {
    return ensureHexBuffer(data);
  }
  if (typeof data === 'string') {
    const trimmed = data.trim();
    const isHex =
      trimmed.startsWith('0x') ||
      (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0);
    return isHex ? ensureHexBuffer(trimmed) : Buffer.from(trimmed, 'utf8');
  }
  throw new Error('Unsupported data type');
}

export function toUint8Array(data: Buffer): Uint8Array {
  return new Uint8Array(data.buffer, data.byteOffset, data.length);
}

export function ensureHash32(
  message: string | number | Buffer | Uint8Array,
): Uint8Array {
  const msgBuffer = toBuffer(message);
  const digest =
    msgBuffer.length === 32
      ? msgBuffer
      : Buffer.from(Hash.keccak256(msgBuffer));
  if (digest.length !== 32) {
    throw new Error('Failed to derive 32-byte hash for signature validation.');
  }
  return toUint8Array(digest);
}

export function validateSig(
  resp: any,
  message: string | number | Buffer | Uint8Array,
) {
  if (!resp.sig?.r || !resp.sig?.s || !resp.pubkey) {
    throw new Error('Missing signature components');
  }
  const rBuf = normalizeSigComponent(resp.sig.r);
  const sBuf = normalizeSigComponent(resp.sig.s);
  const rs = new Uint8Array(Buffer.concat([rBuf, sBuf]));
  const hash = ensureHash32(message);

  const pubkeyInput = toBuffer(resp.pubkey);
  const normalizedPubkey =
    pubkeyInput.length === 64
      ? Buffer.concat([Buffer.from([0x04]), pubkeyInput])
      : pubkeyInput;
  const isCompressed =
    normalizedPubkey.length === 33 &&
    (normalizedPubkey[0] === 0x02 || normalizedPubkey[0] === 0x03);

  const recoveredA = Buffer.from(
    ecdsaRecover(rs, 0, hash, isCompressed),
  ).toString('hex');
  const recoveredB = Buffer.from(
    ecdsaRecover(rs, 1, hash, isCompressed),
  ).toString('hex');
  const expected = normalizedPubkey.toString('hex');
  if (expected !== recoveredA && expected !== recoveredB) {
    throw new Error('Signature did not validate.');
  }
}

export const compressPubKey = (pub) => {
  if (pub.length !== 65) {
    return pub;
  }
  const compressed = Buffer.alloc(33);
  pub.slice(1, 33).copy(compressed, 1);
  if (pub[64] % 2) {
    compressed[0] = 0x03;
  } else {
    compressed[0] = 0x02;
  }
  return compressed;
};

function _stripTrailingCommas(input: string): string {
  return input.replace(
    /,\s*(?:(?:\/\/[^\n]*\n)|\/\*[\s\S]*?\*\/|\s)*([}\]])/g,
    '$1',
  );
}

export const getTestVectors = () => {
  const raw = readFileSync(
    `${process.cwd()}/src/__test__/vectors.jsonc`,
  ).toString();
  return jsonc.parse(_stripTrailingCommas(raw));
};
