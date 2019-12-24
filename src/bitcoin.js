// Util for Bitcoin-specific functionality
const bs58 = require('bs58');
const bs58check = require('bs58check')
const Buffer = require('buffer/').Buffer;
const constants = require('./constants')
const DEFAULT_SEQUENCE = 0xffffffff;
const DEFAULT_SIGHASH_BUFFER = Buffer.from('01', 'hex'); // SIGHASH_ALL = 0x01

const OP = {
  '0': 0x00,
  HASH160: 0xa9,
  DUP: 0x76,
  EQUAL: 0x87,
  EQUALVERIFY: 0x88,
  CHECKSIG: 0xac,
}

const txVersion = {
  MAINNET: 0x01,
  TESTNET: 0x02,
}

const addressVersion = {
  'LEGACY': 0x00,
  'SEGWIT': 0x05,
  'TESTNET': 0x6F,
  'SEGWIT_TESTNET': 0xC4,
}
exports.addressVersion = addressVersion;

// Bitcoin script types -- defined by the Lattice protocol spec
const scriptTypes = {
  P2PKH: 0x01,
  P2SH: 0x02,
  P2SH_P2WPKH: 0x03,
}
exports.scriptTypes = scriptTypes

// We need to build two different objects here:
// 1. bitcoinjs-lib TransactionBuilder object, which will be used in conjunction
//    with the returned signatures to build and serialize the transaction before
//    broadcasting it. We will replace `bitcoinjs-lib`'s signatures with the ones
//    we get from the Lattice
// 2. The serialized Lattice request, which includes data (outlined in the specification)
//    that is needed to sign all of the inputs and build a change output. 
// @inputs (contained in `data`)
// `prevOuts`: an array of objects with the following properties:
//           a. txHash
//           b. value
//           c. index          -- the index of the output in the transaction
//           d. recipientIndex -- the index of the address in our wallet
// `recipient`: Receiving address, which must be converted to a pubkeyhash
// `value`:     Number of satoshis to send the recipient
// `fee`:       Number of satoshis to use for a transaction fee (should have been calculated)
//              already based on the number of inputs plus two outputs
// `version`:   Transaction version of the inputs. All inputs must be of the same version! 
// `isSegwit`: a boolean which determines how we serialize the data and parameterize txb
exports.buildBitcoinTxRequest = function(data) {
  try {
    const { prevOuts, recipient, value, changeIndex=0, fee, isSegwit, changeVersion='SEGWIT' } = data;
    // Serialize the request
    let payload = nullBuf();
    payload = Buffer.concat([payload, getU32LE(changeIndex)]);
    const scriptType = isSegwit === true ? 
                        scriptTypes.P2SH_P2WPKH :  // Only support p2sh(p2wpkh) for segwit spends for now
                        scriptTypes.P2PKH; // No support for multisig p2sh in v1 (p2sh == segwit here)

    // Fee is a param
    payload = Buffer.concat([payload, getU32LE(fee)]);
    const recipientVersionByte = bs58.decode(recipient)[0];
    const recipientPubkeyhash = bs58check.decode(recipient).slice(1);
    // Parameterize the recipient output
    payload = Buffer.concat([payload, getU8(recipientVersionByte)]);
    payload = Buffer.concat([payload, getU8(recipientPubkeyhash)]);
    payload = Buffer.concat([payload, getU64LE(value)]);
    // Build the inputs from the previous outputs
    payload = Buffer.concat([payload, getU8(prevOuts.length)]);
    let inputSum = 0;
    prevOuts.forEach((input) => {
      payload = Buffer.concat([payload, getU32LE(input.recipientIndex)]);
      payload = Buffer.concat([payload, getU32LE(input.index)]);
      payload = Buffer.concat([payload, getU64LE(input.value)]);
      inputSum += input.value;
      payload = Buffer.concat([payload, getU8(scriptType)]);

      if (!Buffer.isBuffer(input.txHash)) input.txHash = Buffer.from(input.txHash, 'hex');
      payload = Buffer.concat([payload, input.txHash]);
    })
    // Send them back!
    return {
      payload,
      schema: constants.signingSchema.BTC_TRANSFER,
      origData: data,   // We will need the original data for serializing the tx
      changeData: {     // This data helps fill in the change output
        changeVersion,
        value: inputSum - (value + fee),
      }
    };
  } catch (err) {
    return { err };
  }
}

// Serialize a transaction consisting of inputs, outputs, and some
// metadata
// -- inputs  = { hash, index, sig, pubkey }
// -- outputs = { value, recipient }  // expects an address string for `recipient`
// -- isSegwitSpend = true if the inputs are being spent using segwit
//                    (NOTE: either ALL are being spent, or none are)
// -- network = Name of network, used to determine transaction version
// -- lockTime = Will probably always be 0
exports.serializeTx = function(data) {
  const { inputs, outputs, isSegwitSpend, network, lockTime=0, crypto } = data;
  let payload = nullBuf();

  // Determine the transaction version
  payload = Buffer.concat(payload, getU32LE(txVersion[network] || 1));
  if (isSegwitSpend === true) {
    payload = Buffer.concat([payload, Buffer.from('00', 'hex')]); // marker = 0x00
    payload = Buffer.concat([payload, Buffer.from('01', 'hex')]); // flag = 0x01
  }
  // Serialize signed inputs
  payload = Buffer.concat([payload, getVarInt(inputs.length)]);
  inputs.forEach((input) => {
    payload = Buffer.concat([payload, input.hash.reverse()]);
    payload = Buffer.concat([payload, getU32LE(input.index)]);
    if (isSegwitSpend === true) {
      // Build a vector (varSlice of varSlice) containing the redeemScript
      const redeemScript = buildRedeemScript(input.pubkey, crypto);
      const redeemScriptVarSlice = varSlice(redeemScript);
      payload = addVarSlice(payload, redeemScriptVarSlice);
    } else {
      // Build the signature + pubkey script to spend this input
      const slice = buildSig(input.sig, input.pubkey);
      payload = Buffer.concat(payload, slice);
    }
    // Use the default sequence for all transactions
    payload = Buffer.concat(payload, getU32LE(DEFAULT_SEQUENCE));
  })
  // Serialize outputs
  payload = Buffer.concat(payload, getVarInt(outputs.length));
  outputs.forEach((output) => {
    payload = Buffer.concat(payload, getU64LE(output.value));
    // Build the output locking script and write it as a var slice
    const script = buildLockingScript(output.recipient);
    payload = addVarSlice(payload, script);
  })
  // Add witness data if needed
  if (isSegwitSpend === true) {
    let sigs = [];
    let pubkeys = [];
    for (let i = 0; i < inputs.length; i++) {
      sigs.push(inputs[i].sig);
      pubkeys.push(inputs[i].pubkey);
    }
    const witnessSlice = buildWitness(sigs, pubkeys);
    payload = Buffer.concat([payload, witnessSlice]);
  }
  // Finish with locktime
  return Buffer.concat([payload, getU32LE(lockTime)]).toString('hex');
}

// Convert a pubkeyhash to a bitcoin base58check address with a version byte
exports.getBitcoinAddress = function(pubkeyhash, version) {
  return bs58check.encode(Buffer.concat([Buffer.from([version]), pubkeyhash]));
}


// Builder utils
//-----------------------

function varSlice(slice) {
  return Buffer.concat([ getVarInt(slice.length), slice]);
}

function addVarSlice(buf, slice) {
  return Buffer.concat([buf, varSlice(slice)])
}


function buildRedeemScript(pubkey, crypto) {
  const shaHash = crypto.createHash('sha256').update(pubkey).digest();
  const pubkeyhash = crypto.createHash('rmd160').update(shaHash).digest();
  return Buffer.concat([getU8(OP['0'], pubkeyhash.length, pubkeyhash));
}

// Var slice of signature + var slice of pubkey
function buildSig(sig, pubkey) {
  sig = Buffer.concat([sig, DEFAULT_SIGHASH_BUFFER])
  const slice = Buffer.concat([getVarInt(sig.length), sig, getVarInt(pubkey.length), pubkey]);
  return varSlice(slice);
}

// Witness is written as a "vector", which is a list of varSlices
// prefixed by the number of items
function buildWitness(sigs, pubkeys) {
  let witness = nullBuf();
  // Two items in each vector (sig, pubkey)
  const len = Buffer.alloc(1); len.writeUInt8(2);
  for (let i = 0; i < sigs.length; i++) {
    const sig = Buffer.concat([sigs[i], DEFAULT_SIGHASH_BUFFER]);
    const sigLen = getVarInt(sig.length);
    const pubkey = pubkeys[i];
    const pubkeyLen = getVarInt(pubkey.length);
    witness = Buffer.concat([witness, len, sigLen, sig, pubkeyLen, pubkey]);
  }
  return witness;
}

// Locking script buiders
//-----------------------
function buildLockingScript(address) {
  const versionByte = bs58.decode(address)[0];
  const pubkeyhash = bs58check.decode(address).slice(1);
  if (versionByte === addressVersion.SEGWIT || versionByte === addressVersion.SEGWIT_TESTNET) { 
    // Also works for p2sh
    return buildP2shLockingScript(pubkeyhash);
  } else {
    // We assume testnet uses p2pkh
    return buildP2pkhLockingScript(pubkeyhash);
  }
}

function buildP2pkhLockingScript(pubkeyhash) {
  return Buffer.concat([
    getU8(OP.DUP),
    getU8(OP.HASH160),
    varSlice(pubkeyhash),
    getU8(OP.EQUALVERIFY),
    getU8(OP.CHECKSIG)
  ])
}

function buildP2shLockingScript(pubkeyhash) {
  return Buffer.concat([
    getU8(OP.HASH160),
    varSlice(pubkeyhash),
    getU8(OP.EQUAL)
  ])
}

// Static Utils
//----------------------
function nullBuf() {
  return Buffer.alloc(0);
}

function getU8(x) {
  let buffer = Buffer.alloc(1);
  buffer.writeUInt8(x);
  return buffer;
}

function getU32LE(x) {
  let buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(x);
  return buffer;
}

function getU64LE(x) {
  let buffer = Buffer.alloc(8);
  if (parseInt(process.version.split(".")[0].slice(1)) >= 12) {
    // node added big int parsing to Buffer in v12!
    buffer.writeBigUInt64LE(x)
  } else {
    // Older version can use our polyfill
    const nStr = n.length % 2 == 0 ? n.toString(16) : `0${n.toString(16)}`;
    const nBuf = Buffer.from(nStr, 'hex');
    nBuf.reverse().copy(buffer, 0);
  }
  return buffer;
}

function getVarInt (x) {
  let buffer;
  if (x < 0xfd) {
    buffer = Buffer.alloc(1);
    buffer.writeUInt8(x);
  } else if (x <= 0xffff) {
    buffer = Buffer.alloc(3);
    buffer.writeUInt8(0xfd, 0);
    buffer.writeUInt16LE(x, 1);
  } else if (x < 0xffffffff) {
    buffer = Buffer.alloc(5);
    buffer.writeUInt8(0xfe, 0);
    buffer.writeUInt32LE(x, 1);
  } else {
    buffer = Buffer.alloc(9);
    buffer.writeUInt8(0xff, 0);
    buffer.writeUInt32LE(x >>> 0, 1);
    buffer.writeUInt32LE((x / 0x100000000) | 0, 5);
  }
  return buffer;
}