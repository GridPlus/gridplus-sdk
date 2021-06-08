// Util for Bitcoin-specific functionality
const bech32 = require('bech32').bech32;
const bs58check = require('bs58check');
const Buffer = require('buffer/').Buffer;
const constants = require('./constants')
const DEFAULT_SEQUENCE = 0xffffffff;
const DEFAULT_SIGHASH_BUFFER = Buffer.from('01', 'hex'); // SIGHASH_ALL = 0x01
const { HARDENED_OFFSET } = require('./constants');
const DEFAULT_CHANGE = [44 + HARDENED_OFFSET, HARDENED_OFFSET, HARDENED_OFFSET, 1, 0];

const OP = {
  ZERO: 0x00,
  HASH160: 0xa9,
  DUP: 0x76,
  EQUAL: 0x87,
  EQUALVERIFY: 0x88,
  CHECKSIG: 0xac,
}

const addressVersion = {
  'LEGACY': 0x00,
  'SEGWIT': 0x05,
  'TESTNET': 0x6F,
  'SEGWIT_TESTNET': 0xC4,
  'SEGWIT_NATIVE_V0': 0xD0,
  'SEGWIT_NATIVE_V0_TESTNET': 0xF0,
}
exports.addressVersion = addressVersion;

// Bitcoin script types -- defined by the Lattice protocol spec
// NOTE: Only certain script types are supported for the spender, but all are supported for recipient
const scriptTypes = {
  P2PKH: 0x01, // Supported spender type
  P2SH: 0x02,
  P2SH_P2WPKH: 0x03, // Supported spender type
  P2WPKH_V0: 0x04,
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
//           d. signerPath -- the path of the address in our wallet that is signing this input
// `recipient`: Receiving address, which must be converted to a pubkeyhash
// `value`:     Number of satoshis to send the recipient
// `fee`:       Number of satoshis to use for a transaction fee (should have been calculated)
//              already based on the number of inputs plus two outputs
// `version`:   Transaction version of the inputs. All inputs must be of the same version! 
// `isSegwit`: a boolean which determines how we serialize the data and parameterize txb
exports.buildBitcoinTxRequest = function(data) {
  try {
    const { 
      prevOuts, recipient, value, changePath=DEFAULT_CHANGE, 
      fee, isSegwit=null, changeVersion='SEGWIT', spenderScriptType=null 
    } = data;
    if (changePath.length !== 5) throw new Error('Please provide a full change path.')
    // Serialize the request
    const payload = Buffer.alloc(59 + (69 * prevOuts.length));
    let off = 0;
    // Change version byte (a.k.a. address format byte)
    if (addressVersion[changeVersion] === undefined)
      throw new Error('Invalid change version specified.');
    payload.writeUInt8(addressVersion[changeVersion]); off++;

    // Build the change data
    payload.writeUInt32LE(changePath.length, off); off += 4;
    for (let i = 0; i < changePath.length; i++) {
      payload.writeUInt32LE(changePath[i], off); off += 4;
    }    

    // Fee is a param
    payload.writeUInt32LE(fee, off); off += 4;
    const dec = decodeAddress(recipient);
    // Parameterize the recipient output
    payload.writeUInt8(dec.versionByte, off); off++;
    dec.pkh.copy(payload, off); off += dec.pkh.length;
    writeUInt64LE(value, payload, off); off += 8;

    // Build the inputs from the previous outputs
    payload.writeUInt8(prevOuts.length, off); off++;
    let inputSum = 0;

    let spenderScriptTypeToUse;
    if (spenderScriptType !== null && scriptTypes[spenderScriptType]) {
      // For newer versions we use the input scriptType
      spenderScriptTypeToUse = scriptTypes[spenderScriptType];
    } else if (isSegwit !== null) {
      // For legacy callers we use the boolean `isSegwit` to denote if we are spending
      // *wrapped* segwit inputs
      spenderScriptTypeToUse = isSegwit === true ? scriptTypes.P2SH_P2WPKH : scriptTypes.P2PKH;
    } else {
      throw new Error('Unsupported spender script type or none provided.')
    }
    prevOuts.forEach((input) => {
      if (!input.signerPath || input.signerPath.length !== 5) {
        throw new Error('Full recipient path not specified ')
      }
      payload.writeUInt32LE(input.signerPath.length, off); off += 4;
      for (let i = 0; i < input.signerPath.length; i++) {
        payload.writeUInt32LE(input.signerPath[i], off); off += 4;
      }
      payload.writeUInt32LE(input.index, off); off += 4;
      writeUInt64LE(input.value, payload, off); off += 8;
      inputSum += input.value;
      payload.writeUInt8(spenderScriptTypeToUse, off); off++;
      if (!Buffer.isBuffer(input.txHash)) input.txHash = Buffer.from(input.txHash, 'hex');
      input.txHash.copy(payload, off); off += input.txHash.length;
    })
    // Send them back!
    return {
      payload,
      spenderScriptType: spenderScriptTypeToUse,
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
  const { inputs, outputs, spenderScriptType, lockTime=0, crypto } = data;
  let payload = Buffer.alloc(4);
  let off = 0;
  // Always use version 2
  const version = 2;
  payload.writeUInt32LE(version, off); off += 4;
  if (spenderScriptType === scriptTypes.P2SH_P2WPKH) {
    payload = concat(payload, Buffer.from('00', 'hex')); // marker = 0x00
    payload = concat(payload, Buffer.from('01', 'hex')); // flag = 0x01
  }
  // Serialize signed inputs
  const numInputs = getVarInt(inputs.length);
  payload = concat(payload, numInputs); off += numInputs.length;
  inputs.forEach((input) => {
    payload = concat(payload, input.hash.reverse()); off += input.hash.length;
    const index = getU32LE(input.index);
    payload = concat(payload, index); off += index.length;
    if (spenderScriptType === scriptTypes.P2SH_P2WPKH) {
      // Build a vector (varSlice of varSlice) containing the redeemScript
      const redeemScript = buildRedeemScript(input.pubkey, crypto);
      const redeemScriptLen = getVarInt(redeemScript.length);
      const slice = Buffer.concat([redeemScriptLen, redeemScript]);
      const sliceLen = getVarInt(slice.length);
      payload = concat(payload, sliceLen); off += sliceLen.length;
      payload = concat(payload, slice); off += slice.length;
    } else {
      // Build the signature + pubkey script to spend this input
      const slice = buildSig(input.sig, input.pubkey);
      payload = concat(payload, slice); off += slice.length;
    }
    // Use the default sequence for all transactions
    const sequence = getU32LE(DEFAULT_SEQUENCE);
    payload = concat(payload, sequence); off += sequence.length;
  })
  // Serialize outputs
  const numOutputs = getVarInt(outputs.length);
  payload = concat(payload, numOutputs); off += numOutputs.length;
  outputs.forEach((output) => {
    const value = getU64LE(output.value);
    payload = concat(payload, value); off += value.length;
    // Build the output locking script and write it as a var slice
    const script = buildLockingScript(output.recipient);
    const scriptLen = getVarInt(script.length);
    payload = concat(payload, scriptLen); off += scriptLen.length;
    payload = concat(payload, script); off += script.length;
  })
  // Add witness data if needed
  if (spenderScriptType === scriptTypes.P2SH_P2WPKH) {
    const sigs = [];
    const pubkeys = [];
    for (let i = 0; i < inputs.length; i++) {
      sigs.push(inputs[i].sig);
      pubkeys.push(inputs[i].pubkey);
    }
    const witnessSlice = buildWitness(sigs, pubkeys);
    payload = concat(payload, witnessSlice); off += witnessSlice.length;
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
function buildRedeemScript(pubkey, crypto) {
  const redeemScript = Buffer.alloc(22);
  const shaHash = crypto.createHash('sha256').update(pubkey).digest();
  const pubkeyhash = crypto.createHash('rmd160').update(shaHash).digest();
  redeemScript.writeUInt8(OP.ZERO);
  redeemScript.writeUInt8(pubkeyhash.length, 1);
  pubkeyhash.copy(redeemScript, 2);
  return redeemScript;
}

// Var slice of signature + var slice of pubkey
function buildSig(sig, pubkey) {
  sig = Buffer.concat([sig, DEFAULT_SIGHASH_BUFFER])
  const sigLen = getVarInt(sig.length);
  const pubkeyLen = getVarInt(pubkey.length);
  const slice = Buffer.concat([sigLen, sig, pubkeyLen, pubkey]);
  const len = getVarInt(slice.length);
  return Buffer.concat([len, slice]);
}

// Witness is written as a "vector", which is a list of varSlices
// prefixed by the number of items
function buildWitness(sigs, pubkeys) {
  let witness = Buffer.alloc(0);
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
  const dec = decodeAddress(address);
  switch (dec.versionByte) {
    case addressVersion.SEGWIT_NATIVE_V0:
    case addressVersion.SEGWIT_NATIVE_V0_TESTNET:
      return buildP2wpkhLockingScript(dec.pkh);
    case addressVersion.SEGWIT:
    case addressVersion.SEGWIT_TESTNET:
      return buildP2shLockingScript(dec.pkh);
    case addressVersion.LEGACY:
    case addressVersion.TESTNET:
      return buildP2pkhLockingScript(dec.pkh);
    default:
      throw new Error(`Unknown version byte: ${dec.versionByte}. Cannot build BTC transaction.`);
  }
}

function buildP2pkhLockingScript(pubkeyhash) {
  const out = Buffer.alloc(5 + pubkeyhash.length);
  let off = 0;
  out.writeUInt8(OP.DUP, off); off++;
  out.writeUInt8(OP.HASH160, off); off++;
  out.writeUInt8(pubkeyhash.length, off); off++;
  pubkeyhash.copy(out, off); off += pubkeyhash.length;
  out.writeUInt8(OP.EQUALVERIFY, off); off++;
  out.writeUInt8(OP.CHECKSIG, off); off++;
  return out;
}

function buildP2shLockingScript(pubkeyhash) {
  const out = Buffer.alloc(3 + pubkeyhash.length);
  let off = 0;
  out.writeUInt8(OP.HASH160, off); off++;
  out.writeUInt8(pubkeyhash.length, off); off++;
  pubkeyhash.copy(out, off); off += pubkeyhash.length;
  out.writeUInt8(OP.EQUAL, off); off++;
  return out;
}

function buildP2wpkhLockingScript(pubkeyhash) {
  const out = Buffer.alloc(2 + pubkeyhash.length);
  out.writeUInt8(OP.ZERO, 0);
  out.writeUInt8(pubkeyhash.length, 1);
  pubkeyhash.copy(out, 2);
  return out;  
}

// Static Utils
//----------------------
function concat(base, addition) {
  return Buffer.concat([base, addition]);
}

function getU64LE(x) {
  const buffer = Buffer.alloc(8);
  writeUInt64LE(x, buffer, 0);
  return buffer;
}

function getU32LE(x) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(x);
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

function writeUInt64LE(n, buf, off) {
  if (typeof n === 'number') n = n.toString(16);
  const preBuf = Buffer.alloc(8);
  const nStr = n.length % 2 === 0 ? n.toString(16) : `0${n.toString(16)}`;
  const nBuf = Buffer.from(nStr, 'hex');
  nBuf.reverse().copy(preBuf, 0);
  preBuf.copy(buf, off);
  return preBuf;
}

function decodeAddress(address) {
let versionByte, pkh;
  try {
    versionByte = bs58check.decode(address)[0];
    pkh = bs58check.decode(address).slice(1);
  } catch (err) {
    try {
      const bech32Dec = bech32.decode(address);
      if (bech32Dec.prefix === 'bc')
        versionByte = 0xD0;
      else if (bech32Dec.prefix === 'tb')
        versionByte = 0xF0;
      else
        throw new Error('Unsupported prefix: must be bc or tb.');
      if (bech32Dec.words[0] !== 0)
        throw new Error(`Unsupported segwit version: must be 0, got ${bech32Dec.words[0]}`);
      pkh = Buffer.from(bech32.fromWords(bech32Dec.words.slice(1)));
    } catch (err) {
      throw new Error(`Unable to decode address: ${address}: ${err.message}`)
    }
  }
  return {versionByte, pkh};
}