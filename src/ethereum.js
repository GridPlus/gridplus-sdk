// Utils for Ethereum transactions. This is effecitvely a shim of ethereumjs-util, which
// does not have browser (or, by proxy, React-Native) support.
const Buffer = require('buffer/').Buffer
const constants = require('./constants');
const keccak256 = require('js-sha3').keccak256;
const rlp = require('rlp-browser');
const secp256k1 = require('secp256k1');

exports.buildEthereumTxRequest = function(data) {
  try {
    let { chainId=1 } = data;
    const { signerPath } = data;
    if (typeof chainId !== 'number') chainId = chainIds[chainId];
    if (!chainId) throw new Error('Unsupported chain name');
    else if (!signerPath || signerPath.length !== 5) throw new Error('Please provider full signer path (`signerPath`)')
    const useEIP155 = eip155[chainId];

    //--------------
    // 1. BUILD THE RAW TX FOR FUTURE RLP ENCODING
    //--------------

    // Ensure all fields are 0x-prefixed hex strings
    const rawTx = [];
    // Build the transaction buffer array
    const nonceBytes = ensureHexBuffer(data.nonce);
    const gasPriceBytes = ensureHexBuffer(data.gasPrice);
    const gasLimitBytes = ensureHexBuffer(data.gasLimit);
    const toBytes = ensureHexBuffer(data.to);
    const valueBytes = ensureHexBuffer(data.value);
    const dataBytes = ensureHexBuffer(data.data);

    rawTx.push(nonceBytes);
    rawTx.push(gasPriceBytes);
    rawTx.push(gasLimitBytes);
    rawTx.push(toBytes);
    rawTx.push(valueBytes);
    rawTx.push(dataBytes);
    // Add empty v,r,s values
    if (useEIP155 === true) {
      rawTx.push(ensureHexBuffer(chainId)); // v
      rawTx.push(ensureHexBuffer(null));    // r
      rawTx.push(ensureHexBuffer(null));    // s
    }

    //--------------
    // 2. BUILD THE LATTICE REQUEST PAYLOAD
    //--------------

    // Here we take the data from the raw transaction and serialize it into a buffer that
    // can be consumed by the Lattice firmware. Note that each field has a 4-byte prefix
    // field indicating how many non-zero bytes are being used in the field. If we use fewer
    // than the max number of bytes for a given field, we still need to offset by the field
    // width so that the data may be unpacked into a struct on the Lattice side.
    //
    // Fields:
    // 4-byte pathDepth header
    // 5x 4-byte path indices = 20
    // 1 byte bool (EIP155)
    // 4 byte nonce (+4byte prefix)
    // 8 byte gasPrice (+4byte prefix)
    // 4 byte gasLimit (+4byte prefix)
    // 20 byte to address (+4byte prefix)
    // 32 byte value (+4byte prefix)
    // 1024 data bytes (+4byte prefix)
    // 1 byte chainID (a.k.a. `v`) (+4byte prefix)
    const txReqPayload = Buffer.alloc(1146);
    let off = 0;

    // 1. EIP155 switch and chainID
    //------------------
    txReqPayload.writeUInt8(Number(useEIP155), off); off++;

    // txReqPayload.writeUInt8(chainId, off); off++;
    // 2. BIP44 Path
    //------------------
    // First write the number of indices in this path (will probably always be 5, but
    // we want to keep this extensible)
    txReqPayload.writeUInt32LE(signerPath.length, off); off += 4;

    for (let i = 0; i < signerPath.length; i++) {
      txReqPayload.writeUInt32LE(signerPath[i], off); off += 4;
    }

    // 3. ETH TX request data
    //------------------

    // Nonce
    txReqPayload.writeUInt32LE(nonceBytes.length, off); off += 4;
    txReqPayload.writeUInt32LE(data.nonce, off); off += 4;

    // GasPrice
    txReqPayload.writeUInt32LE(gasPriceBytes.length, off); off += 4;
    writeUInt64LE(data.gasPrice, txReqPayload, off); off += 8;

    // Gas
    txReqPayload.writeUInt32LE(gasLimitBytes.length, off); off += 4;
    txReqPayload.writeUInt32LE(data.gasLimit, off); off += 4;

    // To
    txReqPayload.writeUInt32LE(toBytes.length, off); off += 4;
    toBytes.copy(txReqPayload, off); off += 20;

    // Value
    txReqPayload.writeUInt32LE(valueBytes.length, off); off += 4;
    // Reverse bytes to be interpreted as a LE u256 in firmware
    valueBytes.reverse().copy(txReqPayload, off); off += 32;

    // Ensure data field isn't too long
    if (dataBytes && dataBytes.length > constants.ETH_DATA_MAX_SIZE) {
      return { err: `Data field too large (must be <=${constants.ETH_DATA_MAX_SIZE} bytes)` }
    }
    // Data
    txReqPayload.writeUInt32LE(dataBytes.length, off); off += 4;
    dataBytes.copy(txReqPayload, off); off += 1024;
    if (useEIP155 === true) {
      txReqPayload.writeUInt32LE(1, off); off += 4;
      txReqPayload.writeUInt8(chainId, off); off ++;
    }

    return { 
      rawTx,
      payload: txReqPayload,
      schema: constants.signingSchema.ETH_TRANSFER,  // We will use eth transfer for all ETH txs for v1 
      chainId,
      useEIP155,
      signerPath,
    };
  } catch (err) {
    return { err };
  }
}

// Given a 64-byte signature [r,s] we need to figure out the v value
// and attah the full signature to the end of the transaction payload
exports.buildEthRawTx = function(tx, sig, address, useEIP155=true) {
  // RLP-encode the data we sent to the lattice
  const rlpEncoded = rlp.encode(tx.rawTx);
  const newSig = addRecoveryParam(rlpEncoded, sig, address, tx.chainId, useEIP155);
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

function writeUInt64LE(n, buf, off) {
  if (typeof n === 'number') n = n.toString(16);
  const preBuf = Buffer.alloc(8);
  const nStr = n.length % 2 == 0 ? n.toString(16) : `0${n.toString(16)}`;
  const nBuf = Buffer.from(nStr, 'hex');
  nBuf.reverse().copy(preBuf, 0);
  preBuf.copy(buf, off);
  return preBuf;
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