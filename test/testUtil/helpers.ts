import bip32 from 'bip32';
import { wordlists } from 'bip39';
import bitcoin from 'bitcoinjs-lib';
import { expect as expect } from 'chai';
import crypto from 'crypto';
import { ec as EC } from 'elliptic';
import ethutil from 'ethereumjs-util';
import { ADDR_STR_LEN, BIP_CONSTANTS, ethMsgProtocol, HARDENED_OFFSET } from '../../src/constants';
import { Client } from '../../src/index';
import { parseDER } from '../../src/util';
const SIGHASH_ALL = 0x01;
const ec = new EC('secp256k1');

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

function setupTestClient(env) {
  const setup: any = {
    name: env.name || 'SDK Test',
    baseUrl: env.baseUrl || 'https://signing.gridpl.us',
    crypto,
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

function connect(client, id) {
  return new Promise((resolve) => {
    client.connect(id, (err) => {
      return resolve(err);
    });
  });
}

function pair(client, secret) {
  return new Promise((resolve) => {
    client.pair(secret, (err) => {
      return resolve(err);
    });
  });
}

function execute(client, func, opts) {
  return new Promise((resolve, reject) => {
    client[func](opts, (err, res) => {
      if (err) return reject(err);
      return resolve(res);
    });
  });
}

const unharden = (x) => {
  return x >= HARDENED_OFFSET ? x - HARDENED_OFFSET : x;
};

const buildPath = (purpose, currencyIdx, signerIdx, change = 0) => {
  return `m/${unharden(purpose)}'/${unharden(
    currencyIdx
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
  purpose
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
      btc_0_change.publicKey
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
        network === bitcoin.networks.testnet
          ? BTC_TESTNET_COIN
          : BTC_COIN;
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
        txb.__tx.hashForWitnessV0(i, input.signScript, input.value, SIGHASH_ALL)
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
  purpose
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
    purpose
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
  purpose
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
      signerPath: [
        purpose,
        currencyIdx,
        HARDENED_OFFSET,
        0,
        input.signerIdx,
      ],
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
    spenderPurpose
  );
  const signingKeys = _get_signing_keys(
    wallet,
    inputs,
    isTestnet,
    spenderPurpose
  );
  const txReq = _btc_tx_request_builder(
    inputs,
    recipient,
    value,
    fee,
    isTestnet,
    spenderPurpose
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
  GP_FAILURE: 0xffffffff + 1 - 128,
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
      serData = serializeSignTxJobData(data);
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

export const getPubStr = (key) => {
  const _pub = key.getPublic();
  const pub = Buffer.alloc(65);
  pub.writeUInt8(0x04, 0);
  _pub.getX().toBuffer().copy(pub, 1);
  _pub.getY().toBuffer().copy(pub, 33);
  return pub.toString('hex');
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
  req.writeUInt8(1, off);
  return req;
};

export const deserializeGetAddressesJobResult = function (res) {
  let off = 0;
  const getAddrResult = {
    count: null,
    addresses: [],
  };
  getAddrResult.count = res.readUInt32LE(off);
  off += 4;
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

export const validateBTCAddresses = function (resp, jobData, seed, useTestnet?) {
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
    const addr = `0x${ethutil.privateToAddress(priv).toString('hex')}`;
    expect(addr).to.equal(resp.addresses[i - jobData.first]);
  }
};

//---------------------------------------------------
// Sign Transaction helpers
//---------------------------------------------------
export const serializeSignTxJobData = function (data) {
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
    o.pubkey = ec.keyFromPublic(
      _o.slice(_off, _off + 65).toString('hex'),
      'hex'
    );
    _off += PK_LEN;
    // We get back a DER signature in 74 bytes, but not all the bytes are necessarily
    // used. The second byte contains the DER sig length, so we need to use that.
    const derLen = _o[_off + 1];
    o.sig = Buffer.from(
      _o.slice(_off, _off + 2 + derLen).toString('hex'),
      'hex'
    );
    getTxResult.outputs.push(o);
  }

  return getTxResult;
};

export const ensureHexBuffer = function (x) {
  if (x === null || x === 0) return Buffer.alloc(0);
  else if (Buffer.isBuffer(x)) x = x.toString('hex');
  if (typeof x === 'number') x = `${x.toString(16)}`;
  else if (typeof x === 'string' && x.slice(0, 2) === '0x') x = x.slice(2);
  if (x.length % 2 > 0) x = `0${x}`;
  return Buffer.from(x, 'hex');
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
      Object.keys(ethMsgProtocol.TYPED_DATA.typeCodes)
    );
    return {
      name: getRandomName(),
      type: types[randInt(types.length)],
    };
  }
  function getRandomEIP712Val(type) {
    if (type !== 'bytes' && type.slice(0, 5) === 'bytes') {
      return `0x${crypto.randomBytes(parseInt(type.slice(5))).toString('hex')}`;
    } else if (type === 'uint' || type === 'int') {
      return `0x${crypto.randomBytes(32).toString('hex')}`;
    } else if (type.indexOf('uint') > -1) {
      return `0x${crypto.randomBytes(parseInt(type.slice(4)))}`;
    } else if (type.indexOf('int') > -1) {
      return `0x${crypto.randomBytes(parseInt(type.slice(3)))}`;
    }
    switch (type) {
      case 'bytes':
        return `0x${crypto.randomBytes(1 + randInt(50)).toString('hex')}`;
      case 'string':
        return randStr(100);
      case 'bool':
        return randInt(1) > 0 ? true : false;
      case 'address':
        return `0x${crypto.randomBytes(20).toString('hex')}`;
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
      verifyingContract: `0x${crypto.randomBytes(20).toString('hex')}`,
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

export default {
  BTC_PURPOSE_P2WPKH,
  BTC_PURPOSE_P2SH_P2WPKH,
  BTC_PURPOSE_P2PKH,
  BTC_COIN,
  BTC_TESTNET_COIN,
  ETH_COIN,
  harden,
  connect,
  pair,
  execute,
  jobTypes,
  gpErrors,
  getCodeMsg,
  parseWalletJobResp,
  serializeJobData,
  setupTestClient,
  jobResErrCode,
  copyBuffer,
  getPubStr,
  stringifyPath,
  stripDER,
  serializeGetAddressesJobData,
  setup_btc_sig_test,
  deserializeGetAddressesJobResult,
  validateBTCAddresses,
  validateETHAddresses,
  serializeSignTxJobData,
  deserializeSignTxJobResult,
  ensureHexBuffer,
  serializeExportSeedJobData,
  deserializeExportSeedJobResult,
  serializeDeleteSeedJobData,
  serializeLoadSeedJobData,
  buildRandomEip712Object,
}