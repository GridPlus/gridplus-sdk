// Util for Bitcoin-specific functionality
const bs58 = require('bs58');
const bs58check = require('bs58check')
const Buffer = require('buffer/').Buffer;
const constants = require('./constants')
const RMD160 = require('jshashes').RMD160;
const DEFAULT_SEQUENCE = 0xffffffff;
const DEFAULT_SIGHASH_BUFFER = Buffer.from('01', 'hex'); // SIGHASH_ALL = 0x01

const OP = {
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
  'P2SH': 0x05,
  'SEGWIT': 0x05,
  'TESTNET': 0x6F,
}
exports.addressVersion = addressVersion;

const bitcoinScriptTypes = {
  P2PKH: 0x01,
  P2SH: 0x02,
}

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
    const { prevOuts, recipient, value, changeIndex=0, fee, isSegwit, changeVersion='LEGACY' } = data;
    // Serialize the request
    const payload = Buffer.alloc(37 + (51 * prevOuts.length));
    let off = 0;
    // Build the change data
    payload.writeUInt32LE(changeIndex, off); off += 4;
    const scriptType = isSegwit === true ? 
                        bitcoinScriptTypes.P2SH : 
                        bitcoinScriptTypes.P2PKH; // No support for multisig p2sh in v1 (p2sh == segwit here)
    payload.writeUInt8(scriptType, off); off++; // change script type
    // Fee is a param
    payload.writeUInt32LE(fee, off); off += 4;
    const recipientVersionByte = bs58.decode(recipient)[0];
    const recipientPubkeyhash = bs58check.decode(recipient).slice(1);
    // Parameterize the recipient output
    payload.writeUInt8(recipientVersionByte, off); off++;
    recipientPubkeyhash.copy(payload, off); off += recipientPubkeyhash.length;
    writeUInt64LE(value, payload, off); off += 8;
    // Build the inputs from the previous outputs
    payload.writeUInt8(prevOuts.length, off); off++;
    let inputSum = 0;
    prevOuts.forEach((input) => {
      payload.writeUInt32LE(input.recipientIndex, off); off += 4;
      payload.writeUInt32LE(input.index, off); off += 4;
      writeUInt64LE(input.value, payload, off); off += 8;
      inputSum += input.value;
      payload.writeUInt8(scriptType, off); off++;

      if (!Buffer.isBuffer(input.txHash)) input.txHash = Buffer.from(input.txHash, 'hex');
      input.txHash.copy(payload, off); off += input.txHash.length;
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
  const { inputs, outputs, isSegwitSpend, network, lockTime=0 } = data;
  let payload = Buffer.alloc(4);
  let off = 0;

  // Determine the transaction version
  const version = txVersion[network] || 1;
  payload.writeUInt32LE(version, off); off += 4;

  // Serialize signed inputs
  const numInputs = getVarInt(inputs.length);
  payload = concat(payload, numInputs); off += numInputs.length;
  inputs.forEach((input) => {
    payload = concat(payload, input.hash.reverse()); off += input.hash.length;
    const index = getU32LE(input.index);
    payload = concat(payload, index); off += index.length;
    if (isSegwitSpend === true) {
      // Build a var slice of the redeem script
      throw new Error('Segwit not yet implemented')
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
  if (isSegwitSpend === true) {
    throw new Error('Segwit not yet implemented')
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
function buildSig(sig, pubkey, redeemScript=null) {
  if (redeemScript) {
    throw new Error('Segwit not yet supported')
  } else {
    // Var slice of signature + var slice of pubkey
    sig = Buffer.concat([sig, DEFAULT_SIGHASH_BUFFER])
    const sigLen = getVarInt(sig.length);
    const pubkeyLen = getVarInt(pubkey.length);

    const slice = Buffer.concat([sigLen, sig, pubkeyLen, pubkey]);
    const sliceLen = getVarInt(slice.length);
    return Buffer.concat([sliceLen, slice]);
  }
}

// Locking script buiders
//-----------------------
function buildLockingScript(address) {
  const versionByte = bs58.decode(address)[0];
  const pubkeyhash = bs58check.decode(address).slice(1);
  if (versionByte === addressVersion.SEGWIT) { 
    // Also works for p2sh
    return buildP2shLockingScript(pubkeyhash);
  } else {
    // We assume testnet uses p2pkh
    return buildP2pkhLockingScript(pubkeyhash);
  }
}

function buildP2pkhLockingScript(pubkeyhash) {
  let out = Buffer.alloc(5 + pubkeyhash.length);
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
  let out = Buffer.alloc(4 + pubkeyhash.length);
  let off = 0;
  out.writeUInt8(OP.HASH160, off); off++;
  out.writeUInt8(pubkeyhash.length, off); off++;
  pubkeyhash.copy(out, off); off += pubkeyhash.length;
  out.writeUInt8(OP.EQUAL, off); off++;
  return out;
}

// Static Utils
//----------------------
function concat(base, addition) {
  return Buffer.concat([base, addition]);
}

function getPubkeyhash(pubkey) {
  const pubkeystr = Buffer.isBuffer(pubkey) ? pubkey.toString('hex') : pubkey;
  const hash = new RMD160;
  return Buffer.from(hash.hex(pubkeystr), 'hex');
}

function getU64LE(x) {
  let buffer = Buffer.alloc(8);
  writeUInt64LE(x, buffer, 0);
  return buffer;
}

function getU32LE(x) {
  let buffer = Buffer.alloc(4);
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
  if (typeof n == 'number') n = n.toString(16);
  const preBuf = Buffer.alloc(8);
  const nStr = n.length % 2 == 0 ? n.toString(16) : `0${n.toString(16)}`;
  const nBuf = Buffer.from(nStr, 'hex');
  nBuf.reverse().copy(preBuf, 0);
  preBuf.copy(buf, off);
  return preBuf;
}