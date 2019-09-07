// Util for Bitcoin-specific functionality
const bs58 = require('bs58');
const bs58check = require('bs58check')
const Buffer = require('buffer/').Buffer;
const RMD160 = require('jshashes').RMD160;
const util = require('./util');
const DEFAULT_SEQUENCE = 0xffffffff;

const OP = {
  HASH160: 0xa9,
  DUP: 0x76,
  EQUAL: 0x87,
  EQUALVERIFY: 0x88,
  CHECKSIG: 0xac,
}

// Serialize a transaction consisting of inputs, outputs, and some
// metadata
// -- inputs  = { hash, index, sig, pubkey }
// -- outputs = { value, recipient }  // expects an address string for `recipient`
// -- isSegwitSpend = true if the inputs are being spent using segwit
//                    (NOTE: either ALL are being spent, or none are)
// -- version = Transaction version, depends on the network
// -- lockTime = Will probably always be 0
exports.serializeTx = function(inputs, outputs, isSegwitSpend, version, lockTime=0) {
  let payload = Buffer.alloc(4);
  let off = 0;
  payload.writeUInt32LE(version, off); off += 4;

  // Serialize signed inputs
  const numInputs = getVarInt(inputs.length);
  payload = Buffer.concat([payload, numInputs]); off += numInputs.length;
  inputs.forEach((input) => {
    input.hash.reverse().copy(payload, off); off += input.hash.length;
    const index = getU32LE(input.index);
    index.copy(payload, off); off += index.length;
    if (isSegwitSpend === true) {
      // Build a var slice of the redeem script
      throw new Error('Segwit not yet implemented')
    } else {
      // Build var slice of sig, pubkey, and input p2pkh locking script
      const script = buildP2pkhLockingScript(getPubkeyhash(input.pubkey));
      const slice = Buffer.concat([input.sig, input.pubkey, script]);
      const sliceLen = getVarInt(slice.length);
      payload = Buffer.concat([payload, sliceLen, slice]);
      off += (sliceLen.length + slice.length);
    }
    // Use the default sequence for all transactions
    const sequence = getU32LE(DEFAULT_SEQUENCE);
    sequence.copy(payload, off); off += sequence.length;
  })

  // Serialize outputs
  const numOutputs = getVarInt(outputs.length);
  payload = Buffer.concat([payload, numOutputs]); off += numOutputs.length;
  outputs.forEach((output) => {
    const value = getU64LE(output.value);
    value.copy(payload, off); off += value.length;
    // Build the output locking script and write it as a var slice
    const script = buildLockingScript(output.recipient);
    const scriptLen = getVarInt(script.length);
    payload = Buffer.concat([payload, scriptLen, script]); 
    off += (scriptLen.length + script.length);
  })

  // Add witness data if needed
  if (isSegwitSpend === true) {
    throw new Error('Segwit not yet implemented')
  }

  // Finish with locktime
  return Buffer.concat([payload, getU32LE(lockTime)]).toString('hex');
}

function getPubkeyhash(pubkey) {
  const pubkeystr = Buffer.isBuffer(pubkey) ? pubkey.toString('hex') : pubkey;
  const hash = new RMD.hex(pubkeystr);
  return Buffer.from(hash, 'hex');
}

function buildLockingScript(address) {
  const versionByte = bs58.decode(address)[0];
  const pubkeyhash = bs58check.decode(address).slice(1);
  if (versionByte === constants.bitcoinVersionByte.SEGWIT) { 
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

function getU64LE(x) {
  let buffer = Buffer.alloc(8);
  util.writeUInt64LE(x, buffer, 0);
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