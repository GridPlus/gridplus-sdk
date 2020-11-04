// Utils for Ethereum transactions. This is effecitvely a shim of ethereumjs-util, which
// does not have browser (or, by proxy, React-Native) support.
const BN = require('bignumber.js');
const Buffer = require('buffer/').Buffer
const constants = require('./constants');
const keccak256 = require('js-sha3').keccak256;
const rlp = require('rlp-browser');
const secp256k1 = require('secp256k1');

exports.buildEthereumMsgRequest = function(input) {
  if (!input.payload || !input.protocol || !input.signerPath)
    throw new Error('You must provide `payload`, `signerPath`, and `protocol` arguments in the messsage request');
  const req = {
    schema: constants.signingSchema.ETH_MSG,
    payload: null,
    input, // Save the input for later
    msg: null, // Save the buffered message for later
  }
  if (input.protocol === 'signPersonal') {
    const L = ((input.signerPath.length + 1) * 4) + constants.ETH_MSG_MAX_SIZE + 4;
    let off = 0;
    req.payload = Buffer.alloc(L);
    req.payload.writeUInt8(constants.ethMsgProtocol.SIGN_PERSONAL, 0); off += 1;
    req.payload.writeUInt32LE(input.signerPath.length, off); off += 4;
    for (let i = 0; i < input.signerPath.length; i++) {
      req.payload.writeUInt32LE(input.signerPath[i], off); off += 4;
    }
    // Write the payload buffer. The payload can come in either as a buffer or as a string
    let payload = input.payload;
    // Determine if this is a hex string
    let displayHex = false;
    if (typeof input.payload === 'string') {
      if (input.payload.slice(0, 2) === '0x') {
        payload = ensureHexBuffer(input.payload)
        displayHex = false === isASCII(payload.toString());
      } else {
        payload = Buffer.from(input.payload)
      }
    } else if (typeof input.displayHex === 'boolean') {
      // If this is a buffer and the user has specified whether or not this
      // is a hex buffer with the optional argument, write that
      displayHex = input.displayHex
    }
    // Make sure we didn't run past the max size
    if (payload.length > constants.ETH_MSG_MAX_SIZE)
      throw new Error(`Your payload is ${payload.length} bytes, but can only be a maximum of ${constants.ETH_MSG_MAX_SIZE}`);
    // Write the payload and metadata into our buffer
    req.msg = payload;
    req.payload.writeUInt8(displayHex, off); off += 1;
    req.payload.writeUInt16LE(payload.length, off); off += 2;
    payload.copy(req.payload, off);
    return req;
  } else {
    throw new Error('Unsupported protocol');
  }
}

exports.validateEthereumMsgResponse = function(res, req) {
  const { signer, sig } = res;
  const { input, msg } = req;
  if (input.protocol === 'signPersonal') {
    const prefix = Buffer.from(
      `\u0019Ethereum Signed Message:\n${msg.length.toString()}`,
      'utf-8',
    );
    return addRecoveryParam(Buffer.concat([prefix, msg]), sig, signer)
  } else {
    throw new Error('Unsupported protocol');
  }
}

exports.buildEthereumTxRequest = function(data) {
  try {
    let { chainId=1 } = data;
    const { signerPath } = data;
    // Sanity checks:
    // There are a handful of named chains we allow the user to reference (`chainIds`)
    // Custom chainIDs should be either numerical or hex strings
    if (typeof chainId !== 'number' && isValidNumberString(chainId) === false) 
      chainId = chainIds[chainId];
    // If this was not a custom chainID and we cannot find the name of it, exit
    if (!chainId) 
      throw new Error('Unsupported chain name');
    // Sanity check on signePath
    if (!signerPath || signerPath.length !== 5) 
      throw new Error('Please provider full signer path (`signerPath`)')

    // Determine if we should use EIP155 given the chainID. Unless explicitly told
    // not to, we will use EIP155.
    const useEIP155 = shouldUseEip155(chainId);

    // Hack for metamask, which sends value=null for 0 ETH transactions
    if (!data.value)
      data.value = 0;
      
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
    // 4 byte nonce
    // 8 byte gasPrice
    // 4 byte gasLimit
    // 20 byte to address
    // 32 byte value
    // 1024 data bytes
    // 1 byte chainID (a.k.a. `v`)
    const txReqPayload = Buffer.alloc(1146);
    let off = 0;
    // 1. EIP155 switch and chainID
    //------------------
    txReqPayload.writeUInt8(Number(useEIP155), off); off++;
    // NOTE: Originally we designed for a 1-byte chainID, but modern rollup chains use much larger
    // chainID values. To account for these, we will put the chainID into the `data` buffer if it
    // is >=255. Values up to UINT64_MAX will be allowed.
    let chainIdBuf; 
    let chainIdBufSz = 0;
    if (useChainIdBuffer(chainId) === true) {
      chainIdBuf = getChainIdBuf(chainId);
      chainIdBufSz = chainIdBuf.length;
      if (chainIdBufSz > constants.MAX_CHAIN_ID_BYTES)
        throw new Error('ChainID provided is too large.');
      // Write 255 to signal that we need to inspect the data buffer
      txReqPayload.writeUInt8(constants.HANDLE_LARGER_CHAIN_ID, off); off++;
    } else {
      // For chainIDs <255, write it to the chainId u8 slot in the buffer.
      const chainIdBuf = ensureHexBuffer(chainId);
      if (chainIdBuf.length !== 1)
        throw new Error('Error parsing chainID');
      chainIdBuf.copy(txReqPayload, off); off += chainIdBuf.length;
    }

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
    txReqPayload.writeUInt32BE(data.nonce, off); off += 4;
    writeUInt64BE(data.gasPrice, txReqPayload, off); off += 8;
    txReqPayload.writeUInt32BE(data.gasLimit, off); off += 4;
    toBytes.copy(txReqPayload, off); off += 20;
    // Place the value (a BE number) in an offset such that it
    // can be interpreted as a number
    const valueOff = off + 32 - valueBytes.length;
    valueBytes.copy(txReqPayload, valueOff); off += 32;
    // Ensure data field isn't too long
    if (dataBytes && dataBytes.length > constants.ETH_DATA_MAX_SIZE) {
      return { err: `Data field too large (must be <=${constants.ETH_DATA_MAX_SIZE} bytes)` }
    }
    // Write the data size
    txReqPayload.writeUInt16BE(dataBytes.length, off); off += 2;
    if (dataBytes.length + chainIdBufSz > constants.ETH_DATA_MAX_SIZE)
      throw new Error('Payload too large.');
    // Copy in the chainId buffer if needed
    if (chainIdBufSz > 0) {
      txReqPayload.writeUInt8(chainIdBufSz, off); off++;
      chainIdBuf.copy(txReqPayload, off); off += chainIdBufSz;
    }
    // Copy the data itself
    dataBytes.copy(txReqPayload, off); off += constants.ETH_DATA_MAX_SIZE;

    return { 
      rawTx,
      payload: txReqPayload,
      schema: constants.signingSchema.ETH_TRANSFER,  // We will use eth transfer for all ETH txs for v1 
      chainId,
      useEIP155,
      signerPath,
    };
  } catch (err) {
    return { err: err.message };
  }
}

// From ethereumjs-util
function stripZeros(a) {
  let first = a[0]
  while (a.length > 0 && first.toString() === '0') {
    a = a.slice(1)
    first = a[0]
  }
  return a
}

// Given a 64-byte signature [r,s] we need to figure out the v value
// and attah the full signature to the end of the transaction payload
exports.buildEthRawTx = function(tx, sig, address, useEIP155=true) {
  // RLP-encode the data we sent to the lattice
  const rlpEncoded = rlp.encode(tx.rawTx);
  const newSig = addRecoveryParam(rlpEncoded, sig, address, tx.chainId, useEIP155);
  // Use the signature to generate a new raw transaction payload
  const newRawTx = tx.rawTx.slice(0, 6);
  newRawTx.push(newSig.v);
  // Per `ethereumjs-tx`, RLP encoding should include signature components w/ stripped zeros
  // See: https://github.com/ethereumjs/ethereumjs-tx/blob/master/src/transaction.ts#L187
  newRawTx.push(stripZeros(newSig.r));
  newRawTx.push(stripZeros(newSig.s));
  return rlp.encode(newRawTx).toString('hex');
}

// Attach a recovery parameter to a signature by brute-forcing ECRecover
function addRecoveryParam(payload, sig, address, chainId, useEIP155) {
  try {
    // Rebuild the keccak256 hash here so we can `ecrecover`
    const hash = new Uint8Array(Buffer.from(keccak256(payload), 'hex'));
    let v = 0;
    // Fix signature componenet lengths to 32 bytes each
    const r = fixLen(sig.r, 32); sig.r = r;
    const s = fixLen(sig.s, 32); sig.s = s;
    // Calculate the recovery param
    const rs = new Uint8Array(Buffer.concat([r, s]));
    let pubkey = secp256k1.ecdsaRecover(rs, v, hash, false).slice(1)
    // If the first `v` value is a match, return the sig!
    if (pubToAddrStr(pubkey) === address.toString('hex')) {
      sig.v  = updateRecoveryParam(v, useEIP155, chainId);
      return sig;
    }
    // Otherwise, try the other `v` value
    v = 1;
    pubkey = secp256k1.ecdsaRecover(rs, v, hash, false).slice(1)
    if (pubToAddrStr(pubkey) === address.toString('hex')) {
      sig.v  = updateRecoveryParam(v, useEIP155, chainId);
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
  if (typeof x === 'number') x = `${x.toString(16)}`;
  else if (typeof x === 'string' && x.slice(0, 2) === '0x') x = x.slice(2);
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

function updateRecoveryParam(v, useEIP155, chainId) {
  // If we are not using EIP155, convert v directly to a buffer and return it
  if (false === useEIP155)
    return Buffer.from(new BN(v).toString(16), 'hex');
  // We will use EIP155 in most cases. Convert v to a bignum and operate on it.
  // Note that the protocol calls for v = (CHAIN_ID*2) + 35/36, where 35 or 36
  // is decided on based on the ecrecover result. `v` is passed in as either 0 or 1
  // so we add 35 to that.
  const chainIdBuf = getChainIdBuf(chainId);
  const chainIdBN = new BN(chainIdBuf.toString('hex'), 16);
  return ensureHexBuffer(chainIdBN.times(2).plus(35).plus(v).toString(16));
}

function writeUInt64BE(n, buf, off) {
  if (typeof n === 'number') n = n.toString(16);
  const preBuf = Buffer.alloc(8);
  const nStr = n.length % 2 === 0 ? n.toString(16) : `0${n.toString(16)}`;
  const nBuf = Buffer.from(nStr, 'hex');
  nBuf.copy(preBuf, preBuf.length - nBuf.length);
  preBuf.copy(buf, off);
  return preBuf;
}

function isASCII(str) {
    return (/^[\x00-\x7F]*$/).test(str)
}

const chainIds = {
  mainnet: 1,
  roptsten: 3,
  rinkeby: 4,
  kovan: 42,
  goerli: 5
}

function getChainIdBuf(chainId) {
  let b;
  if (new BN(chainId, 16).isNaN() === false) {
    // If our chainID is a hex string, we can convert it to a hex
    // buffer directly
    b = ensureHexBuffer(chainId)
  } else {
    // If our chainID is a base-10 number (or numerical string),
    // parse it using bignumber.js and convert to a hex buffer
    b = ensureHexBuffer(new BN(chainId).toString(16))
  }
  if (b.length > 8)
    throw new Error('ChainID provided is too large.');
  if (b.length <= 2 || b.length === 4 || b.length === 8)
    return b;
  let buf;
  if (b.length === 3) {
    buf = Buffer.alloc(4);
    buf.writeUInt32BE(chainId);
  } else if (b.length <= 8) {
    buf = Buffer.alloc(8);
    b.copy(buf, 8 - b.length)
  }
  return buf;
}

function shouldUseEip155(chainID) {
  switch (chainID) {
    case 3: // ropsten
    case 4: // rinkeby
      return false;
    case 1: // mainnet
    case 42: // kovan
    case 5: // goerli
    default: // all others should use eip155
      return true;
  }
}

function isValidNumberString(s) {
  return (new BN(s, 16).isNaN() === false) || (new BN(s).isNaN() === false)
}

function useChainIdBuffer(id) {
  const buf = getChainIdBuf(id);
  // Edge case: we still need to use the `data` field for chainID=255
  if (buf.length === 1)
    return buf.readUInt8() === 255;
  // All other cases should return true
  return true;
}

exports.chainIds = chainIds;