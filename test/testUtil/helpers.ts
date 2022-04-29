import bip32 from 'bip32';
import { wordlists } from 'bip39';
import bitcoin from 'bitcoinjs-lib';
import { BN } from 'bn.js';
import { expect } from 'chai';
import {
  derivePath as deriveEDKey,
  getPublicKey as getEDPubkey,
} from 'ed25519-hd-key';
import { ec as EC, eddsa as EdDSA } from 'elliptic';
import { privateToAddress } from 'ethereumjs-util';
import { sha256 } from 'hash.js/lib/hash/sha';
import { keccak256 } from 'js-sha3';
import { ecdsaRecover } from 'secp256k1';
import {
  ADDR_STR_LEN,
  BIP_CONSTANTS,
  ethMsgProtocol,
  HARDENED_OFFSET,
} from '../../src/constants';
import { Client, Constants } from '../../src/index';
import { parseDER, randomBytes } from '../../src/util';
const SIGHASH_ALL = 0x01;
const secp256k1 = new EC('secp256k1');
const ed25519 = new EdDSA('ed25519');

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

function setupTestClient (env, stateData = null) {
  if (stateData) {
    return new Client({ stateData });
  }
  const setup: any = {
    name: env.name || 'SDK Test',
    baseUrl: env.baseUrl || 'https://signing.gridpl.us',
    timeout: 120000,
  };
  const REUSABLE_KEY =
    '3fb53b677f73e4d2b8c89c303f6f6b349f0075ad88ea126cb9f6632085815dca';
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

const unharden = (x) => {
  return x >= HARDENED_OFFSET ? x - HARDENED_OFFSET : x;
};

const buildPath = (purpose, currencyIdx, signerIdx, change = 0) => {
  return `m/${unharden(purpose)}'/${unharden(
    currencyIdx,
  )}'/0'/${change}/${signerIdx}`;
};

function _getSumInputs(inputs) {
  let sum = 0;
  inputs.forEach((input) => {
    sum += input.value;
  });
  return sum;
}

function _get_btc_addr(pubkey, purpose, network) {
  let obj;
  if (purpose === BTC_PURPOSE_P2SH_P2WPKH) {
    // Wrapped segwit requires p2sh wrapping
    obj = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ pubkey, network }),
      network,
    });
  } else if (purpose === BTC_PURPOSE_P2WPKH) {
    obj = bitcoin.payments.p2wpkh({ pubkey, network });
  } else {
    // Native segwit and legacy addresses are treated teh same
    obj = bitcoin.payments.p2pkh({ pubkey, network });
  }
  return obj.address;
}

function _start_tx_builder(
  wallet,
  recipient,
  value,
  fee,
  inputs,
  network,
  purpose,
) {
  const txb = new bitcoin.TransactionBuilder(network);
  const inputSum = _getSumInputs(inputs);
  txb.addOutput(recipient, value);
  const changeValue = inputSum - value - fee;
  if (changeValue > 0) {
    const networkIdx = network === bitcoin.networks.testnet ? 1 : 0;
    const path = buildPath(purpose, harden(networkIdx), 0, 1);
    const btc_0_change = wallet.derivePath(path);
    const btc_0_change_pub = bitcoin.ECPair.fromPublicKey(
      btc_0_change.publicKey,
    ).publicKey;
    const changeAddr = _get_btc_addr(btc_0_change_pub, purpose, network);
    txb.addOutput(changeAddr, changeValue);
  } else if (changeValue < 0) {
    throw new Error('Value + fee > sumInputs!');
  }
  inputs.forEach((input) => {
    let scriptSig = null;
    // here we use `i` as the index of the input. This value is arbitrary, but needs to be consistent
    if (purpose === BTC_PURPOSE_P2WPKH) {
      // For native segwit we need to add a scriptSig to the input
      const coin =
        network === bitcoin.networks.testnet ? BTC_TESTNET_COIN : BTC_COIN;
      const path = buildPath(purpose, coin, input.signerIdx);
      const keyPair = wallet.derivePath(path);
      const p2wpkh = bitcoin.payments.p2wpkh({
        pubkey: keyPair.publicKey,
        network,
      });
      scriptSig = p2wpkh.output;
    }
    txb.addInput(input.hash, input.idx, null, scriptSig);
  });
  return txb;
}

function _build_sighashes(txb, purpose) {
  const hashes = [];
  txb.__inputs.forEach((input, i) => {
    if (purpose === BTC_PURPOSE_P2PKH) {
      hashes.push(txb.__tx.hashForSignature(i, input.signScript, SIGHASH_ALL));
    } else {
      hashes.push(
        txb.__tx.hashForWitnessV0(
          i,
          input.signScript,
          input.value,
          SIGHASH_ALL,
        ),
      );
    }
  });
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
    : bitcoin.networks.mainnet;
  const txb = _start_tx_builder(
    wallet,
    recipient,
    value,
    fee,
    inputs,
    network,
    purpose,
  );
  inputs.forEach((input, i) => {
    const path = buildPath(purpose, coin, input.signerIdx);
    const keyPair = wallet.derivePath(path);
    const priv = bitcoin.ECPair.fromPrivateKey(keyPair.privateKey, { network });
    if (purpose === BTC_PURPOSE_P2SH_P2WPKH) {
      const p2wpkh = bitcoin.payments.p2wpkh({
        pubkey: keyPair.publicKey,
        network,
      });
      const p2sh = bitcoin.payments.p2sh({
        redeem: p2wpkh,
        network,
      });
      txb.sign(i, priv, p2sh.redeem.output, null, input.value);
    } else if (purpose === BTC_PURPOSE_P2WPKH) {
      txb.sign(i, priv, null, null, input.value);
    } else {
      // Legacy
      txb.sign(i, priv);
    }
  });
  return _build_sighashes(txb, purpose);
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
    prevOuts: [],
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
function stripDER(derSig) {
  const parsed = parseDER(derSig);
  parsed.s = Buffer.from(parsed.s.slice(-32));
  parsed.r = Buffer.from(parsed.r.slice(-32));
  const sig = Buffer.alloc(64);
  parsed.r.copy(sig, 32 - parsed.r.length);
  parsed.s.copy(sig, 64 - parsed.s.length);
  return sig;
}

function _get_signing_keys(wallet, inputs, isTestnet, purpose) {
  const currencyIdx = isTestnet === true ? 1 : 0;
  const keys = [];
  inputs.forEach((input) => {
    const path = buildPath(purpose, currencyIdx, input.signerIdx);
    keys.push(wallet.derivePath(path));
  });
  return keys;
}

function _generate_btc_address(isTestnet, purpose, rand) {
  const priv = Buffer.alloc(32);
  for (let j = 0; j < 8; j++) {
    // 32 bits of randomness per call
    priv.writeUInt32BE(Math.floor(rand.quick() * 2 ** 32), j * 4);
  }
  const keyPair = bitcoin.ECPair.fromPrivateKey(priv);
  const network =
    isTestnet === true ? bitcoin.networks.testnet : bitcoin.networks.mainnet;
  return _get_btc_addr(keyPair.publicKey, purpose, network);
}

function setup_btc_sig_test(opts, wallet, inputs, rand) {
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

export const prandomBuf = function (prng, maxSz, forceSize = false) {
  // Build a random payload that can fit in the base request
  const sz = forceSize ? maxSz : Math.floor(maxSz * prng.quick());
  const buf = Buffer.alloc(sz);
  for (let i = 0; i < sz; i++) {
    buf[i] = Math.floor(0xff * prng.quick());
  }
  return buf;
};

export const deriveED25519Key = function (path, seed) {
  const { key } = deriveEDKey(getPathStr(path), seed);
  const pub = getEDPubkey(key, false); // `false` removes the leading zero byte
  return {
    priv: key,
    pub,
  };
};

export const deriveSECP256K1Key = function (path, seed) {
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
export const getCodeMsg = function (code, expected) {
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

export const parseWalletJobResp = function (res, v) {
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

export const serializeJobData = function (job, walletUID, data) {
  let serData;
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
export const jobResErrCode = function (res) {
  return res.result.readUInt32LE(0);
};

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

export const getPathStr = function (path) {
  let pathStr = 'm';
  path.forEach((idx) => {
    if (idx >= HARDENED_OFFSET) {
      pathStr += `/${idx - HARDENED_OFFSET}'`;
    } else {
      pathStr += `/${idx}`;
    }
  });
  return pathStr;
};

//---------------------------------------------------
// Get Addresses helpers
//---------------------------------------------------
export const serializeGetAddressesJobData = function (data) {
  const req = Buffer.alloc(33);
  let off = 0;
  req.writeUInt32LE(data.parent.pathDepth, off);
  off += 4;
  req.writeUInt32LE(data.parent.purpose, off);
  off += 4;
  req.writeUInt32LE(data.parent.coin, off);
  off += 4;
  req.writeUInt32LE(data.parent.account, off);
  off += 4;
  req.writeUInt32LE(data.parent.change, off);
  off += 4;
  req.writeUInt32LE(data.parent.addr, off);
  off += 4;
  req.writeUInt32LE(data.first, off);
  off += 4;
  req.writeUInt32LE(data.count, off);
  off += 4;
  // Deprecated skipCache flag. It isn't used by firmware anymore.
  req.writeUInt8(data.flag || 0, off);
  return req;
};

export const deserializeGetAddressesJobResult = function (res) {
  let off = 0;
  const getAddrResult = {
    count: null,
    addresses: [],
  };
  getAddrResult.pubOnly = res.readUInt8(off);
  off += 1;
  getAddrResult.count = res.readUInt8(off);
  off += 3; // Skip a 2-byte empty shim value (for backwards compatibility)
  for (let i = 0; i < getAddrResult.count; i++) {
    const _addr = res.slice(off, off + ADDR_STR_LEN);
    off += ADDR_STR_LEN;
    for (let j = 0; j < _addr.length; j++)
      if (_addr[j] === 0x00) {
        getAddrResult.addresses.push(_addr.slice(0, j).toString('utf8'));
        break;
      }
  }
  return getAddrResult;
};

export const validateBTCAddresses = function (
  resp,
  jobData,
  seed,
  useTestnet?,
) {
  expect(resp.count).to.equal(jobData.count);
  const wallet = bip32.fromSeed(seed);
  const path = JSON.parse(JSON.stringify(jobData.parent));
  path.pathDepth = jobData.parent.pathDepth + 1;
  const network =
    useTestnet === true ? bitcoin.networks.testnet : bitcoin.networks.mainnet;
  for (let i = jobData.first; i < jobData.first + jobData.count; i++) {
    path.addr = i;
    // Validate the address
    const purpose = jobData.parent.purpose;
    const pubkey = wallet.derivePath(stringifyPath(path)).publicKey;
    let address;
    if (purpose === BTC_PURPOSE_P2WPKH) {
      // Bech32
      address = bitcoin.payments.p2wpkh({ pubkey, network }).address;
    } else if (purpose === BTC_PURPOSE_P2SH_P2WPKH) {
      // Wrapped segwit
      address = bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({ pubkey, network }),
      }).address;
    } else {
      // Legacy
      // This is the default and any unrecognized purpose will yield a legacy address.
      address = bitcoin.payments.p2pkh({ pubkey, network }).address;
    }
    expect(address).to.equal(resp.addresses[i - jobData.first]);
  }
};

export const validateETHAddresses = function (resp, jobData, seed) {
  expect(resp.count).to.equal(jobData.count);
  // Confirm it is an Ethereum address
  expect(resp.addresses[0].slice(0, 2)).to.equal('0x');
  expect(resp.addresses[0].length).to.equal(42);
  // Confirm we can derive the same address from the previously exported seed
  const wallet = bip32.fromSeed(seed);
  const path = JSON.parse(JSON.stringify(jobData.parent));
  path.pathDepth = jobData.parent.pathDepth + 1;
  for (let i = jobData.first; i < jobData.first + jobData.count; i++) {
    path.addr = i;
    const priv = wallet.derivePath(stringifyPath(path)).privateKey;
    const addr = `0x${privateToAddress(priv).toString('hex')}`;
    expect(addr).to.equal(resp.addresses[i - jobData.first]);
  }
};

export const validateDerivedPublicKeys = function (
  pubKeys,
  firstPath,
  seed,
  flag = null,
) {
  const wallet = bip32.fromSeed(seed);
  // We assume the keys were derived in sequential order
  pubKeys.forEach((pub, i) => {
    const path = JSON.parse(JSON.stringify(firstPath));
    path[path.length - 1] += i;
    if (flag === Constants.GET_ADDR_FLAGS.ED25519_PUB) {
      // ED25519 requires its own derivation
      const key = deriveED25519Key(path, seed);
      expect(pub.toString('hex')).to.equal(
        key.pub.toString('hex'),
        'Exported ED25519 pubkey incorrect',
      );
    } else {
      // Otherwise this is a SECP256K1 pubkey
      const priv = wallet.derivePath(getPathStr(path)).privateKey;
      expect(pub.toString('hex')).to.equal(
        secp256k1.keyFromPrivate(priv).getPublic().encode('hex'),
        'Exported SECP256K1 pubkey incorrect',
      );
    }
  });
};

export const ethPersonalSignMsg = function (msg) {
  return '\u0019Ethereum Signed Message:\n' + String(msg.length) + msg;
};

//---------------------------------------------------
// Sign Transaction helpers
//---------------------------------------------------
export const serializeSignTxJobDataLegacy = function (data) {
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

export const deserializeSignTxJobResult = function (res) {
  let off = 0;
  const getTxResult = {
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
      pubkey: null,
      sig: null,
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
export const serializeExportSeedJobData = function () {
  return Buffer.alloc(0);
};

export const deserializeExportSeedJobResult = function (res) {
  return { seed: res.slice(0, 64) };
};

//---------------------------------------------------
// Delete Seed helpers
//---------------------------------------------------
export const serializeDeleteSeedJobData = function (data) {
  const req = Buffer.alloc(1);
  req.writeUInt8(data.iface, 0);
  return req;
};

//---------------------------------------------------
// Load Seed helpers
//---------------------------------------------------
export const serializeLoadSeedJobData = function (data) {
  const req = Buffer.alloc(66);
  req.writeUInt8(data.iface, 0);
  data.seed.copy(req, 1);
  req.writeUInt8(data.exportability, 65);
  return req;
};

//---------------------------------------------------
// Struct builders
//---------------------------------------------------
export const buildRandomEip712Object = function (randInt) {
  function randStr(n) {
    const words = wordlists.english;
    let s = '';
    while (s.length < n) {
      s += `${words[randInt(words.length)]}_`;
    }
    return s.slice(0, n);
  }
  function getRandomName(upperCase = false, sz = 20) {
    const name = randStr(sz);
    if (upperCase === true)
      return `${name.slice(0, 1).toUpperCase()}${name.slice(1)}`;
    return name;
  }
  function getRandomEIP712Type(customTypes = []) {
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
    } else if (type === 'uint' || type === 'int') {
      return `0x${randomBytes(32).toString('hex')}`;
    } else if (type.indexOf('uint') > -1) {
      return `0x${randomBytes(parseInt(type.slice(4)))}`;
    } else if (type.indexOf('int') > -1) {
      return `0x${randomBytes(parseInt(type.slice(3)))}`;
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
    const subTypes = [];
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
export const validateGenericSig = function (seed, sig, payloadBuf, req) {
  const { signerPath, hashType, curveType } = req;
  const HASHES = Constants.SIGNING.HASHES;
  const CURVES = Constants.SIGNING.CURVES;
  let hash;
  if (curveType === CURVES.SECP256K1) {
    if (hashType === HASHES.SHA256) {
      hash = Buffer.from(sha256().update(payloadBuf).digest('hex'), 'hex');
    } else if (hashType === HASHES.KECCAK256) {
      hash = Buffer.from(keccak256(payloadBuf), 'hex');
    } else {
      throw new Error('Bad params');
    }
    const { priv } = deriveSECP256K1Key(signerPath, seed);
    const key = secp256k1.keyFromPrivate(priv);
    expect(key.verify(hash, sig)).to.equal(
      true,
      'Signature failed verification.',
    );
  } else if (curveType === CURVES.ED25519) {
    if (hashType !== HASHES.NONE) {
      throw new Error('Bad params');
    }
    const { priv } = deriveED25519Key(signerPath, seed);
    const key = ed25519.keyFromSecret(priv);
    const formattedSig = `${sig.r.toString('hex')}${sig.s.toString('hex')}`;
    expect(key.verify(payloadBuf, formattedSig)).to.equal(
      true,
      'Signature failed verification.',
    );
  } else {
    throw new Error('Bad params');
  }
};

/**
 * Generic signing does not return a `v` value like legacy ETH signing requests did.
 * Get the `v` component of the signature as well as an `initV`
 * parameter, which is what you need to use to re-create an @ethereumjs/tx
 * object. There is a lot of tech debt in @ethereumjs/tx which also
 * inherits the tech debt of ethereumjs-util.
 * 1.  The legacy `Transaction` type can call `_processSignature` with the regular
 *     `v` value.
 * 2.  Newer transaction types such as `FeeMarketEIP1559Transaction` will subtract
 *     27 from the `v` that gets passed in, so we need to add `27` to create `initV`
 * @param tx - An @ethereumjs/tx Transaction object
 * @param resp - response from Lattice. Can be either legacy or generic signing variety
 */
export const getV = function (tx, resp) {
  const hash = tx.getMessageToSign(true);
  const rs = new Uint8Array(Buffer.concat([resp.sig.r, resp.sig.s]));
  const pubkey = new Uint8Array(resp.pubkey);
  const recovery0 = ecdsaRecover(rs, 0, hash, false);
  const recovery1 = ecdsaRecover(rs, 1, hash, false);
  const pubkeyStr = Buffer.from(pubkey).toString('hex');
  const recovery0Str = Buffer.from(recovery0).toString('hex');
  const recovery1Str = Buffer.from(recovery1).toString('hex');
  let recovery;
  if (pubkeyStr === recovery0Str) {
    recovery = 0;
  } else if (pubkeyStr === recovery1Str) {
    recovery = 1;
  } else {
    return null;
  }
  // Newer transaction types just use the [0, 1] value
  if (tx._type) {
    return new BN(recovery);
  }
  // Legacy transactions should check for EIP155 support.
  // In practice, virtually every transaction should have EIP155
  // support since that hardfork happened in 2016...
  // Various methods for fetching a chainID from different @ethereumjs/tx objects
  let chainId = null;
  if (tx.common && typeof tx.common.chainIdBN === 'function') {
    chainId = tx.common.chainIdBN();
  } else if (tx.chainId) {
    chainId = new BN(tx.chainId);
  }
  if (!chainId || !tx.supports(EthTxCapability.EIP155ReplayProtection)) {
    return new BN(recovery).addn(27);
  }
  // EIP155 replay protection is included in the `v` param
  // and uses the chainId value.
  return chainId.muln(2).addn(35).addn(recovery);
};

/**
 * Get a RSV formatted signature string
 * @param resp - response from Lattice. Can be either legacy or generic signing variety
 * @param tx - optional, an @ethereumjs/tx Transaction object
 */
export const getSigStr = function (resp, tx = null) {
  let v;
  if (resp.sig.v !== undefined) {
    v = (parseInt(resp.sig.v.toString('hex'), 16) - 27)
      .toString(16)
      .padStart(2, '0');
  } else if (tx) {
    v = getV(tx, resp);
  } else {
    throw new Error('Could not build sig string');
  }
  return `${resp.sig.r}${resp.sig.s}${v}`;
};

export const compressPubKey = function (pub) {
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
}

export default {
  BTC_PURPOSE_P2WPKH,
  BTC_PURPOSE_P2SH_P2WPKH,
  BTC_PURPOSE_P2PKH,
  BTC_COIN,
  BTC_TESTNET_COIN,
  ETH_COIN,
  harden,
  jobTypes,
  gpErrors,
  getCodeMsg,
  parseWalletJobResp,
  serializeJobData,
  setupTestClient,
  jobResErrCode,
  copyBuffer,
  stringifyPath,
  stripDER,
  serializeGetAddressesJobData,
  setup_btc_sig_test,
  deserializeGetAddressesJobResult,
  validateBTCAddresses,
  validateETHAddresses,
  validateDerivedPublicKeys,
  ethPersonalSignMsg,
  serializeSignTxJobDataLegacy,
  deserializeSignTxJobResult,
  serializeExportSeedJobData,
  deserializeExportSeedJobResult,
  serializeDeleteSeedJobData,
  serializeLoadSeedJobData,
  buildRandomEip712Object,
  validateGenericSig,
  deriveED25519Key,
  deriveSECP256K1Key,
  prandomBuf,
  getPathStr,
  getV,
  getSigStr,
  compressPubKey,
};
