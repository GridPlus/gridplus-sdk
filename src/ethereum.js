// Utils for Ethereum transactions. This is effecitvely a shim of ethereumjs-util, which
// does not have browser (or, by proxy, React-Native) support.
const Buffer = require('buffer/').Buffer
const constants = require('./constants');
const keccak256 = require('js-sha3').keccak256;
const rlp = require('rlp-browser');
const secp256k1 = require('secp256k1');

exports.buildEthereumTxRequest = function(data) {
  try {
    let { signerIndex, chainId=1 } = data;
    if (typeof chainId !== 'number') chainId = chainIds[chainId];
    if (!chainId) throw new Error('Unsupported chain name');
    const useEIP155 = eip155[chainId];
    // Ensure all fields are 0x-prefixed hex strings
    let rawTx = []
    // Build the transaction buffer array
    rawTx.push(ensureHexBuffer(data.nonce));
    rawTx.push(ensureHexBuffer(data.gasPrice));
    rawTx.push(ensureHexBuffer(data.gasLimit));
    rawTx.push(ensureHexBuffer(data.to));
    rawTx.push(ensureHexBuffer(data.value));
    rawTx.push(ensureHexBuffer(data.data));
    // Add empty v,r,s values
    if (useEIP155 === true) {
      rawTx.push(ensureHexBuffer(chainId)); // v
      rawTx.push(ensureHexBuffer(null));    // r
      rawTx.push(ensureHexBuffer(null));    // s
    }
    // Ensure data field isn't too long
    if (data.data && ensureHexBuffer(data.data).length > constants.ETH_DATA_MAX_SIZE) {
      return { err: `Data field too large (must be <=${constants.ETH_DATA_MAX_SIZE} bytes)` }
    }
    // RLP-encode the transaction request
    const encoded = rlp.encode(rawTx);
    // Build the payload to send to the Lattice
    const payload = Buffer.alloc(encoded.length + 4);
    payload.writeUInt32BE(signerIndex, 0);
    encoded.copy(payload, 4);
    return { 
      rawTx,
      payload,
      schema: constants.signingSchema.ETH_TRANSFER,  // We will use eth transfer for all ETH txs for v1 
      chainId,
      useEIP155
    };
  } catch (err) {
    return { err };
  }
}

// Given a 64-byte signature [r,s] we need to figure out the v value
// and attah the full signature to the end of the transaction payload
exports.buildEthRawTx = function(tx, sig, address, useEIP155=true) {
  // Get the new signature (with valid recovery param `v`) given the
  // RLP-encoded transaction payload
  // NOTE: The first 4 bytes of the payload were for the `signerIndex`, which
  //      was part of the Lattice request. We discard that here.
  const newSig = addRecoveryParam(tx.payload.slice(4), sig, address, tx.chainId, useEIP155);
  // Use the signature to generate a new raw transaction payload
  const newRawTx = tx.rawTx.slice(0, 6);
  newRawTx.push(Buffer.from((newSig.v).toString(16), 'hex'));
  newRawTx.push(newSig.r);
  newRawTx.push(newSig.s);
  return rlp.encode(newRawTx).toString('hex');
}

// Attach a recovery parameter to a signature by brute-forcing ECRecover
function addRecoveryParam(payload, sig, address, chainId, useEIP155) {
  try {
    // Rebuild the keccak256 hash here so we can `ecrecover`
    const hash = Buffer.from(keccak256(payload), 'hex');
    sig.v = 27;
    // Fix signature componenet lengths to 32 bytes each
    const r = fixLen(sig.r, 32); sig.r = r;
    const s = fixLen(sig.s, 32); sig.s = s;
    // Calculate the recovery param
    const rs = Buffer.concat([r, s]);
    let pubkey = secp256k1.recover(hash, rs, sig.v - 27, false).slice(1);
    // If the first `v` value is a match, return the sig!
    if (pubToAddrStr(pubkey) === address.toString('hex')) {
      if (useEIP155 === true) sig.v  = updateRecoveryParam(sig.v, chainId);
      return sig;
    }
    // Otherwise, try the other `v` value
    sig.v = 28;
    pubkey = secp256k1.recover(hash, rs, sig.v - 27, false).slice(1);
    if (pubToAddrStr(pubkey) === address.toString('hex')) {
      if (useEIP155 === true) sig.v  = updateRecoveryParam(sig.v, chainId);
      return sig;
    } else {
      // If neither is a match, we should return an error
      throw new Error('Invalid Ethereum signature returned.');
    }
  } catch (err) {
    throw new Error(err);
  }
}
exports.addRecoveryParam = addRecoveryParam;

// Convert an RLP-serialized transaction (plus signature) into a transaction hash
exports.hashTransaction = function(serializedTx) {
  return keccak256(Buffer.from(serializedTx, 'hex')); 
}

// Ensure a param is represented by a buffer
function ensureHexBuffer(x) {
  if (x === null || x === 0) return Buffer.alloc(0);
  else if (Buffer.isBuffer(x)) x = x.toString('hex');
  if (typeof x == 'number') x = `${x.toString(16)}`;
  else if (typeof x == 'string' && x.slice(0, 2) === '0x') x = x.slice(2);
  if (x.length % 2 > 0) x = `0${x}`;
  return Buffer.from(x, 'hex');
}

// Returns address string given public key buffer
function pubToAddrStr(pub) {
  return keccak256(pub).slice(-40);
}

function fixLen(msg, length) {
  const buf = Buffer.alloc(length)
  if (msg.length < length) {
    msg.copy(buf, length - msg.length)
    return buf
  }
  return msg.slice(-length)
}

function updateRecoveryParam(v, chainId) {
  return v + (chainId * 2) + 8;
}


const chainIds = {
  mainnet: 1,
  roptsten: 3,
  rinkeby: 4,
  kovan: 42,
  goerli: 5
}

const eip155 = {
  1: true,
  3: false,
  4:false,
  42: true,
  5: true
}


exports.chainIds = chainIds;