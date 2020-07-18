const crypto = require('crypto');
const Sdk = require('../../index.js');
const bitcoin = require('bitcoinjs-lib');
const constants = require('../../src/constants');
const SIGHASH_ALL = 0x01;
const HARDENED_OFFSET = 0x80000000;
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

function setupTestClient(env) {
  const setup = {
      name: 'SDK Test',
      baseUrl: 'https://signing.staging-gridpl.us',
      crypto,
      timeout: 120000,
    };
    const REUSABLE_KEY = '3fb53b677f73e4d2b8c89c303f6f6b349f0075ad88ea126cb9f6632085815dca;'
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
    const client = new Sdk.Client(setup);
    return client;
}

function connect(client, id) {
  return new Promise((resolve) => {
    client.connect(id, (err) => {
      return resolve(err);
    })
  })
}

function pair(client, secret) {
  return new Promise((resolve) => {
    client.pair(secret, (err) => {
      return resolve(err);
    })
  })
}

function getAddresses(client, opts, timeout=0) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      client.getAddresses(opts, (err, res) => {
        if (err) return reject(err);
        return resolve(res);
      })
    }, timeout);
  })
}

function sign(client, opts) {
  return new Promise((resolve, reject) => {
    client.sign(opts, (err, res) => {
      if (err) return reject(err);
      return resolve(res);
    })
  })
}

function test(client, opts) {
  return new Promise((resolve, reject) => {
    client.test(opts, (err, res) => {
      if (err) return reject(err);
      return resolve(res);
    })
  })
}

function _getSumInputs(inputs) {
  let sum = 0;
  inputs.forEach((input) => {
    sum += input.value
  })
  return sum;
}

function _get_btc_addr(pubKey, isSegwit, network) {
  let obj = null;
  if (true === isSegwit) {
     const p2wpkh = bitcoin.payments.p2wpkh({ 
      pubkey: pubKey,
      network,
    });
    obj = bitcoin.payments.p2sh({ 
      redeem: p2wpkh, 
      network,
    });
  } else {
    obj = bitcoin.payments.p2pkh({ 
      pubkey: pubKey,
      network,
    })
  }
  return obj.address;
}

function _start_tx_builder(wallet, recipient, value, fee, inputs, network, isSegwit) {
  const txb = new bitcoin.TransactionBuilder(network)
  const inputSum = _getSumInputs(inputs);
  txb.addOutput(recipient, value);
  const changeValue = inputSum - value - fee;
  if (changeValue > 0) {
    const networkIdx = network === bitcoin.networks.testnet ? 1 : 0;
    const btc_0_change = wallet.derivePath(`m/44'/${networkIdx}'/0'/1/0`);
    const btc_0_change_pub = bitcoin.ECPair.fromPublicKey(btc_0_change.publicKey).publicKey;
    const changeAddr = _get_btc_addr(btc_0_change_pub, isSegwit, network)
    txb.addOutput(changeAddr, changeValue)
  } else if (changeValue < 0) {
    throw new Error('Value + fee > sumInputs!')
  }
  inputs.forEach((input) => {
    // here we use `i` as the index of the input. This value is arbitrary, but needs to be consistent
    txb.addInput(input.hash, input.idx) 
  })
  return txb
}

function _build_sighashes(txb, isSegwit) {
  const hashes = [];
  txb.__inputs.forEach((input, i) => {
    if (isSegwit === true)
      hashes.push(txb.__tx.hashForWitnessV0(i, input.signScript, input.value, SIGHASH_ALL))
    else
      hashes.push(txb.__tx.hashForSignature(i, input.signScript, SIGHASH_ALL));
  })
  return hashes;
}

function _get_reference_sighashes(wallet, recipient, value, fee, inputs, isTestnet, isSegwit) {
  let network, networkIdx;
  if (isTestnet === true) {
    network = bitcoin.networks.testnet;
    networkIdx = 1;
  } else {
    network = bitcoin.networks.mainnet;
    networkIdx = 0;
  }
  const txb = _start_tx_builder(wallet, recipient, value, fee, inputs, network, isSegwit)
  inputs.forEach((input, i) => {
    const _signer = wallet.derivePath(`m/44'/${networkIdx}'/0'/0/${input.signerIdx}`)
    const signer = bitcoin.ECPair.fromPrivateKey(_signer.privateKey, { network })
    if (true === isSegwit) {
      const p2wpkh = bitcoin.payments.p2wpkh({ 
        pubkey: _signer.publicKey,
        network,
      });
      const p2sh = bitcoin.payments.p2sh({ 
        redeem: p2wpkh, 
        network,
      });
      txb.sign(i, signer, p2sh.redeem.output, null, input.value)
    } else {
      txb.sign(i, signer)
    }
  })
  return _build_sighashes(txb, isSegwit);
}


function _tx_request_builder(inputs, recipient, value, fee, segwit, isTestnet) {
  let currencyIdx, changeVersion, networkStr;
  if (isTestnet && segwit === true) {
    networkStr = 'TESTNET';
    changeVersion = 'SEGWIT_TESTNET';
    currencyIdx = HARDENED_OFFSET+1;
  } else if (isTestnet && segwit === false) {
    networkStr = 'TESTNET';
    changeVersion = 'TESTNET';
    currencyIdx = HARDENED_OFFSET+1;
  } else if (!isTestnet && segwit === true) {
    networkStr = 'MAINNET';
    changeVersion = 'SEGWIT';
    currencyIdx = HARDENED_OFFSET;
  } else if (!isTestnet && segwit === false) {
    networkStr = 'MAINNET';
    changeVersion = 'LEGACY';
    currencyIdx = HARDENED_OFFSET;
  } else {
    throw new Error('Invalid network and segwit params provided');
  }

  const txData = {
    prevOuts: [],
    recipient,
    value,
    fee,
    isSegwit: segwit,
    changePath: [HARDENED_OFFSET+44, currencyIdx, HARDENED_OFFSET, 1, 0],
    changeVersion,
    network: networkStr,
  };
  inputs.forEach((input) => {
    txData.prevOuts.push({
      txHash: input.hash,
      value: input.value,
      index: input.idx,
      signerPath: [HARDENED_OFFSET+44, currencyIdx, HARDENED_OFFSET, 0, input.signerIdx]
    })
  })
  return {
    currency: 'BTC',
    data: txData,
  }
}

// Convert DER signature to buffer of form `${r}${s}`
function stripDER(derSig) {
  let off = 0;
  if (derSig[off] !== 0x30)
    throw new Error('Invalid DER signature')
  off++;
  const sig = { r: null, s: null }
  const l = derSig[off]; off++;
  if (derSig[off] !== 0x02)
    throw new Error('Invalid DER signature')
  off++;
  const rl = derSig[off]; off++;
  // Sometimes there are leading zeros, which are accounted for in the
  // DER component length. However, we need to strip them to validate
  // using bip32.js (which uses tiny-secp256k1)
  let sliceStart = off + (rl - 32);
  sig.r = derSig.slice(sliceStart, off + rl); off += rl;
  if (derSig[off] !== 0x02)
    throw new Error('Invalid DER signature')
  off++;
  const sl = derSig[off]; off++;
  sliceStart = off + (sl - 32);
  sig.s = derSig.slice(sliceStart, off + sl); off += sl;
  if (sl + rl +4 !== l)
    throw new Error('Invalid DER signature')
  return Buffer.concat([sig.r, sig.s])
}

function _get_signing_keys(wallet, inputs, isTestnet) {
  const currencyIdx = isTestnet === true ? 1 : 0;
  const keys = [];
  inputs.forEach((input) => {
    keys.push(wallet.derivePath(`m/44'/${currencyIdx}'/0'/0/${input.signerIdx}`))
  })
  return keys;
}

function _generate_btc_address(isTestnet, isSegwit) {
  const keyPair = bitcoin.ECPair.makeRandom();
  const network = isTestnet === true ? bitcoin.networks.testnet : bitcoin.networks.mainnet;
  let obj;
  if (isSegwit === true) {
    obj = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network }),
      network
    });
  } else {
    obj = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network });
  }
  return obj.address;
}

function setup_btc_sig_test(isTestnet, isSegwit, useChange, wallet, inputs) {
    const recipient = _generate_btc_address(isTestnet, isSegwit);
    const sumInputs = _getSumInputs(inputs);
    const fee = Math.floor(Math.random() * 50000)
    const _value = useChange === true ? Math.floor(Math.random() * sumInputs) : sumInputs;
    const value = _value - fee;
    const sigHashes = _get_reference_sighashes(wallet, recipient, value, fee, inputs, isTestnet, isSegwit);
    const signingKeys = _get_signing_keys(wallet, inputs, isTestnet);
    const txReq = _tx_request_builder(inputs, recipient, value, fee, isSegwit, isTestnet);
    return {
      sigHashes,
      signingKeys,
      txReq,
    }
}

exports.harden = (x) => { return x + HARDENED_OFFSET; }
exports.setupTestClient = setupTestClient;
exports.connect = connect;
exports.pair = pair;
exports.getAddresses = getAddresses;
exports.sign = sign;
exports.test = test;
exports.stripDER = stripDER;
exports.setup_btc_sig_test = setup_btc_sig_test;


//============================================================
// Wallet Job integration test helpers
// We test "wallet jobs" using a test harness for debug builds
//=============================================================

//---------------------------------------------------
// Relevant test harness constants
//---------------------------------------------------
exports.jobTypes = {
  WALLET_JOB_GET_ADDRESSES: 1,
  WALLET_JOB_SIGN_TX: 2,
  WALLET_JOB_LOAD_SEED: 3,
  WALLET_JOB_EXPORT_SEED: 4,
  WALLET_JOB_DELETE_SEED: 5,
}
exports.gpErrors = {
  GP_SUCCESS: 0x00,
  GP_EINVAL: 0xea, // -22
  GP_ENODATA: 0xc3, // -61
  GP_EOVERFLOW: 0xac, // -84
  GP_EALREADY: 0x8e, // -114
  GP_ENODEV: 0xed, // -19
  GP_EAGAIN: 0xf5, // -11
}

//---------------------------------------------------
// General helpers
//---------------------------------------------------
exports.parseWalletJobResp = function(res) {
  const jobRes = {
    resultStatus: null,
    result: null,
  };
  jobRes.resultStatus = res.readUInt32LE(0);
  const dataLen = res.readUInt16LE(4);
  jobRes.result = res.slice(6, 6+dataLen);
  return jobRes;  
}

exports.serializeJobData = function(job, walletUID, data) {
  let serData;
  switch (job) {
    case exports.jobTypes.WALLET_JOB_GET_ADDRESSES:
      serData = exports.serializeGetAddressesJobData(data);
      break;
    case exports.jobTypes.WALLET_JOB_SIGN_TX:
      serData = exports.serializeSignTxJobData(data);
      break;
    case exports.jobTypes.WALLET_JOB_EXPORT_SEED:
      serData = exports.serializeExportSeedJobData(data);
      break;
    case exports.jobTypes.WALLET_JOB_DELETE_SEED:
      serData = exports.serializeDeleteSeedJobData(data);
      break;
    case exports.jobTypes.WALLET_JOB_LOAD_SEED:
      serData = exports.serializeLoadSeedJobData(data);
      break;
    default:
      throw new Error('Unsupported job type');
  }
  if ((false === Buffer.isBuffer(serData)) ||
      (false === Buffer.isBuffer(walletUID)) ||
      (32 !== walletUID.length))
    throw new Error('Invalid params');

  const req = Buffer.alloc(serData.length + 40);
  let off = 0;
  walletUID.copy(req, off); off+=walletUID.length;
  req.writeUInt32LE(0, off); off+=4; // 0 for callback -- it isn't used
  req.writeUInt32LE(job, off); off+=4;
  serData.copy(req, off);
  return req;
}

// First byte of the result data is the error code
exports.jobResErrCode = function(res) {
  return res.result.readUInt32LE(0);
}

// Have to do this weird copy because `Buffer`s from the client are not real buffers
// which is a vestige of requiring support on react native
exports.copyBuffer = (x) => { return Buffer.from(x.toString('hex'), 'hex') }

exports.getPubStr = (key) => {
    const _pub = key.getPublic();
    const pub = Buffer.alloc(65);
    pub.writeUInt8(0x04, 0);
    _pub.getX().toBuffer().copy(pub, 1);
    _pub.getY().toBuffer().copy(pub, 33);
    return pub.toString('hex');
}

// Convert a set of indices to a human readable bip32 path
exports.stringifyPath = (x) => {
  const convert = (x) => { return x >= HARDENED_OFFSET ? `${x - HARDENED_OFFSET}'` : `${x}`;}
  let d = x.pathDepth;
  let s = 'm';
  if (d <= 0) return s;
  s += `/${convert(x.purpose)}`; d--;
  if (d <= 0) return s;
  s += `/${convert(x.coin)}`; d--;
  if (d <= 0) return s;
  s += `/${convert(x.account)}`; d--;
  if (d <= 0) return s;
  s += `/${convert(x.change)}`; d--;
  if (d <= 0) return s;
  s += `/${convert(x.addr)}`; d--;
  return s;
}

//---------------------------------------------------
// Get Addresses helpers
//---------------------------------------------------
exports.serializeGetAddressesJobData = function(data) {
  const req = Buffer.alloc(32);
  let off = 0;
  req.writeUInt32LE(data.parent.pathDepth, off); off+=4;
  req.writeUInt32LE(data.parent.purpose, off); off+=4;
  req.writeUInt32LE(data.parent.coin, off); off+=4;
  req.writeUInt32LE(data.parent.account, off); off+=4;
  req.writeUInt32LE(data.parent.change, off); off+=4;
  req.writeUInt32LE(data.parent.addr, off); off+=4;
  req.writeUInt32LE(data.first, off); off+=4;
  req.writeUInt32LE(data.count, off);
  return req;
}

exports.deserializeGetAddressesJobResult = function(res) {
  let off = 4; // Skip past status code
  const getAddrResult = {
    count: null,
    addresses: [],
  };
  getAddrResult.count = res.readUInt32LE(off); off+=4;
  for (let i = 0; i < getAddrResult.count; i++) {
    const _addr = res.slice(off, off + constants.ADDR_STR_LEN); off+= constants.ADDR_STR_LEN;
    for (let j = 0; j < _addr.length; j++)
      if (_addr[j] === 0x00) {
        getAddrResult.addresses.push(_addr.slice(0, j).toString('utf8'));
        break;
      }
  }
  return getAddrResult;
}

//---------------------------------------------------
// Sign Transaction helpers
//---------------------------------------------------
exports.serializeSignTxJobData = function(data) {
  const n = data.sigReq.length;
  const req = Buffer.alloc(4 + 56 * n);
  let off = 0;
  req.writeUInt32LE(data.numRequests); off+=4;
  for (let i = 0; i < n; i++) {
    const r = data.sigReq[i];
    r.data.copy(req, off); off+=r.data.length;
    req.writeUInt32LE(r.signerPath.pathDepth, off); off+=4;
    req.writeUInt32LE(r.signerPath.purpose, off); off+=4;
    req.writeUInt32LE(r.signerPath.coin, off); off+=4;
    req.writeUInt32LE(r.signerPath.account, off); off+=4;
    req.writeUInt32LE(r.signerPath.change, off); off+=4;
    req.writeUInt32LE(r.signerPath.addr, off); off+=4;
  }
  return req;
}

exports.deserializeSignTxJobResult = function(res) {
  let off = 4; // Skip past status code
  const getTxResult = {
    numOutputs: null,
    outputs: [],
  };
  getTxResult.numOutputs = res.readUInt32LE(off); off+=4;
  const PK_LEN = 65; // uncompressed pubkey
  const SIG_LEN = 74; // DER sig
  const outputSz = (6*4) + PK_LEN + SIG_LEN;
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
    }
    const _o = res.slice(off, off + outputSz); off += outputSz;
    _off = 0;
    o.signerPath.pathDepth = _o.readUInt32LE(_off); _off += 4;
    o.signerPath.purpose = _o.readUInt32LE(_off); _off += 4;
    o.signerPath.coin = _o.readUInt32LE(_off); _off += 4;
    o.signerPath.account = _o.readUInt32LE(_off); _off += 4;
    o.signerPath.change = _o.readUInt32LE(_off); _off += 4;
    o.signerPath.addr = _o.readUInt32LE(_off); _off += 4;
    o.pubkey = ec.keyFromPublic(_o.slice(_off, _off+65).toString('hex'), 'hex'); _off += PK_LEN;
    // We get back a DER signature in 74 bytes, but not all the bytes are necessarily
    // used. The second byte contains the DER sig length, so we need to use that.
    const derLen = _o[_off+1];
    o.sig = Buffer.from(_o.slice(_off, _off+2+derLen).toString('hex'), 'hex');
    getTxResult.outputs.push(o);
  }

  return getTxResult;
}

//---------------------------------------------------
// Export Seed helpers
//---------------------------------------------------
exports.serializeExportSeedJobData = function() {
  return Buffer.alloc(0);
};

exports.deserializeExportSeedJobResult = function(res) {
  // Skip past 4-byte status code
  // Next 32 bytes are the seed
  return { seed: res.slice(4, 68) };
}

//---------------------------------------------------
// Delete Seed helpers
//---------------------------------------------------
exports.serializeDeleteSeedJobData = function() {
  return Buffer.alloc(0);
};

//---------------------------------------------------
// Load Seed helpers
//---------------------------------------------------
exports.serializeLoadSeedJobData = function(data) {
  const req = Buffer.alloc(66);
  req.writeUInt8(data.iface, 0);
  data.seed.copy(req, 1);
  req.writeUInt8(data.exportability, 65);
  return req;
};