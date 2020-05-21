const crypto = require('crypto');
const Sdk = require('../../index.js');
const bitcoin = require('bitcoinjs-lib');
const SIGHASH_ALL = 0x01;

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

function getSumInputs(inputs) {
  let sum = 0;
  inputs.forEach((input) => {
    sum += input.value
  })
  return sum;
}

function _start_tx_builder(wallet, recipient, value, fee, inputs, network) {
  const txb = new bitcoin.TransactionBuilder(network)
  const inputSum = getSumInputs(inputs);
  txb.addOutput(recipient, value);
  const changeValue = inputSum - value - fee;
  if (changeValue > 0) {
    const networkIdx = network === bitcoin.networks.testnet ? 1 : 0;
    const btc_0_change = wallet.derivePath(`m/44'/${networkIdx}'/0'/1/0`);
    const changeAddr = bitcoin.payments.p2pkh({ 
      pubkey: bitcoin.ECPair.fromPublicKey(btc_0_change.publicKey).publicKey,
      network,
    }).address
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

function _build_legacy_sighashes(txb) {
  const hashes = [];
  txb.__inputs.forEach((input, i) => {
    hashes.push(txb.__tx.hashForSignature(i, input.signScript, SIGHASH_ALL));
  })
  return hashes;
}

function get_legacy_sighashes(wallet, recipient, value, fee, inputs, isTestnet) {
  let network, networkIdx;
  if (isTestnet === true) {
    network = bitcoin.networks.testnet;
    networkIdx = 1;
  } else {
    network = bitcoin.networks.mainnet;
    networkIdx = 0;
  }
  const txb = _start_tx_builder(wallet, recipient, value, fee, inputs, network)
  inputs.forEach((input, i) => {
    const _signer = wallet.derivePath(`m/44'/${networkIdx}'/0'/0/${input.signerIdx}`)
    const signer = bitcoin.ECPair.fromPrivateKey(_signer.privateKey, { network })
    txb.sign(i, signer)
  })
  return _build_legacy_sighashes(txb);
}

function get_segwit_txb(wallet, recipient, value, fee, inputs, isTestnet) {
  let network, networkIdx;
  if (isTestnet === true) {
    network = bitcoin.networks.testnet;
    networkIdx = 1;
  } else {
    network = bitcoin.networks.mainnet;
    networkIdx = 0;
  }
  const txb = _start_tx_builder(wallet, recipient, value, fee, inputs, network)
  inputs.forEach((input, i) => {
    const _signer = wallet.derivePath(`m/44'/${networkIdx}'/0'/0/${input.signerIdx}`)
    const signer = bitcoin.ECPair.fromPrivateKey(_signer.privateKey, { network })
    const p2wpkh = bitcoin.payments.p2wpkh({ 
      pubkey: _signer.publicKey,
      network,
    });
    const p2sh = bitcoin.payments.p2sh({ 
      redeem: p2wpkh, 
      network,
    });
    txb.sign(i, signer, p2sh.redeem.output, null, input.value)
  })
  return txb;
}

function tx_request_builder(inputs, recipient, value, fee, segwit, isTestnet) {
  const HARDENED_OFFSET = 0x80000000;
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

function get_signing_keys(wallet, inputs, isTestnet) {
  const currencyIdx = isTestnet === true ? 1 : 0;
  const keys = [];
  inputs.forEach((input) => {
    keys.push(wallet.derivePath(`m/44'/${currencyIdx}'/0'/0/${input.signerIdx}`))
  })
  return keys;
}

exports.setupTestClient = setupTestClient;
exports.connect = connect;
exports.pair = pair;
exports.getAddresses = getAddresses;
exports.sign = sign;
exports.getSumInputs = getSumInputs;
exports.get_legacy_sighashes = get_legacy_sighashes;
exports.get_segwit_txb = get_segwit_txb;
exports.tx_request_builder = tx_request_builder;
exports.stripDER = stripDER;
exports.get_signing_keys = get_signing_keys;