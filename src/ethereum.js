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
    // 1. BUILD THE LATTICE REQUEST PAYLOAD
    //--------------


    // 4-byte pathDepth header
    // 5x 4-byte path indices = 20
    // 1 byte bool (EIP155)
    // 1 byte chainID
    // 2 byte nonce (+4byte prefix)
    // 8 byte gasPrice (+4byte prefix)
    // 4 byte gasLimit (+4byte prefix)
    // 20 byte to address (+4byte prefix)
    // 32 byte value (+4byte prefix)
    // 1024 data bytes (+4byte prefix)
    const txReqPayload = Buffer.alloc(1140);
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
  console.log(0, txReqPayload.slice(0, off).toString('hex'));
    txReqPayload.writeUInt32LE(4, off); off += 4;
    txReqPayload.writeUInt32LE(data.nonce, off); off += 2;
  console.log(1, txReqPayload.slice(0, off).toString('hex'));

    // GasPrice
    txReqPayload.writeUInt32LE(8, off); off += 4;
    writeUInt64LE(data.gasPrice, txReqPayload, off); off += 8;
  console.log(2, txReqPayload.slice(0, off).toString('hex'));

    // Gas
    txReqPayload.writeUInt32LE(4, off); off += 4;
    txReqPayload.writeUInt32LE(data.gasLimit, off); off += 4;

    // To
    txReqPayload.writeUInt32LE(20, off); off += 4;
    ensureHexBuffer(data.to).copy(txReqPayload, off); off += 20;

    // Value
    txReqPayload.writeUInt32LE(32, off); off += 4;
    const valueBuffer = Buffer.alloc(32);
    // Convert `value` to a buffer and reverse it to LE
    // Copy into index=0 of valueBuf
    ensureHexBuffer(data.value).reverse().copy(valueBuffer); 
    valueBuffer.copy(txReqPayload, off); off += 32;
    
    // Data: copy buffer in BE
    const dataBuffer = ensureHexBuffer(data.data);
    // Ensure data field isn't too long
    if (dataBuffer.data && dataBuffer.length > constants.ETH_DATA_MAX_SIZE) {
      return { err: `Data field too large (must be <=${constants.ETH_DATA_MAX_SIZE} bytes)` }
    }
    txReqPayload.writeUInt32LE(dataBuffer.length, off); off += 4;
    dataBuffer.copy(txReqPayload, off);


    // chain id -- temporary, this should be the second argument
    txReqPayload.writeUInt8(chainId, off); off++;

    //--------------
    // 2. BUILD THE RAW TX FOR FUTURE RLP ENCODING
    //--------------

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


    return {
      rawTx,
      payload: txReqPayload,
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
  // NOTE: The first 20 bytes of the payload were for the `signerPath`, which
  //      was part of the Lattice request. We discard that here.
  const newSig = addRecoveryParam(tx.payload.slice(20), sig, address, tx.chainId, useEIP155);
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

function writeUInt64LE(n, buf, off) {
  if (typeof n == 'number') n = n.toString(16);
  const preBuf = Buffer.alloc(8);
  const nStr = n.length % 2 == 0 ? n.toString(16) : `0${n.toString(16)}`;
  const nBuf = Buffer.from(nStr, 'hex');
  nBuf.reverse().copy(preBuf, 0);
  preBuf.copy(buf, off);
  return preBuf;
}


exports.chainIds = chainIds;