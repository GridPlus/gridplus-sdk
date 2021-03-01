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
    const L = ((input.signerPath.length + 1) * 4) + input.ethMaxMsgSz + 4;
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
        displayHex = true === isHexStr(input.payload.slice(2));
      } else {
        if (false === latticeCanDisplayStr(input.payload))
          throw new Error('Currently, the Lattice can only display ASCII strings.');
        payload = Buffer.from(input.payload)
      }
    } else if (typeof input.displayHex === 'boolean') {
      // If this is a buffer and the user has specified whether or not this
      // is a hex buffer with the optional argument, write that
      displayHex = input.displayHex
    }
    // Write the payload and metadata into our buffer
    req.msg = payload;
    req.payload.writeUInt8(displayHex, off); off += 1;
    req.payload.writeUInt16LE(payload.length, off); off += 2;
    // Make sure we didn't run past the max size
    if (payload.length > input.ethMaxMsgSz)
      throw new Error(`Your message is ${payload.length} bytes, but can only be a maximum of ${input.ethMaxMsgSz}`);
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
    const { signerPath, eip155=null, ethMaxDataSz } = data;
    // Sanity checks:
    // There are a handful of named chains we allow the user to reference (`chainIds`)
    // Custom chainIDs should be either numerical or hex strings
    if (typeof chainId !== 'number' && isValidChainIdHexNumStr(chainId) === false) 
      chainId = chainIds[chainId];
    // If this was not a custom chainID and we cannot find the name of it, exit
    if (!chainId) 
      throw new Error('Unsupported chain ID or name');
    // Sanity check on signePath
    if (!signerPath || signerPath.length !== 5) 
      throw new Error('Please provider full signer path (`signerPath`)')

    // Determine if we should use EIP155 given the chainID.
    // If we are explicitly told to use eip155, we will use it. Otherwise,
    // we will look up if the specified chainId is associated with a chain
    // that does not use EIP155 by default. Note that most do use EIP155.
    let useEIP155 = chainUsesEIP155(chainId);
    if (eip155 !== null && typeof eip155 === 'boolean')
      useEIP155 = eip155;

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
    const ETH_TX_NON_DATA_SZ = 122; // Accounts for metadata and non-data params
    const txReqPayload = Buffer.alloc(ethMaxDataSz + ETH_TX_NON_DATA_SZ);
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
      // Signal to Lattice firmware that it needs to read the chainId from the tx.data buffer
      txReqPayload.writeUInt8(constants.HANDLE_LARGER_CHAIN_ID, off); off++;
    } else {
      // For chainIDs <255, write it to the chainId u8 slot in the main tx buffer
      chainIdBuf = ensureHexBuffer(chainId);
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
    if (dataBytes && dataBytes.length > ethMaxDataSz) {
      throw new Error(`Data field too large (must be <=${ethMaxDataSz} bytes)`);
    }
    // Write the data size (does *NOT* include the chainId buffer, if that exists)
    txReqPayload.writeUInt16BE(dataBytes.length, off); off += 2;
    if (dataBytes.length + chainIdBufSz > ethMaxDataSz)
      throw new Error('Payload too large.');
    // Copy in the chainId buffer if needed
    if (chainIdBufSz > 0) {
      txReqPayload.writeUInt8(chainIdBufSz, off); off++;
      chainIdBuf.copy(txReqPayload, off); off += chainIdBufSz;
    }

    // Copy the data itself
    dataBytes.copy(txReqPayload, off); off += ethMaxDataSz;
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
      sig.v  = getRecoveryParam(v, useEIP155, chainId);
      return sig;
    }
    // Otherwise, try the other `v` value
    v = 1;
    pubkey = secp256k1.ecdsaRecover(rs, v, hash, false).slice(1)
    if (pubToAddrStr(pubkey) === address.toString('hex')) {
      sig.v  = getRecoveryParam(v, useEIP155, chainId);
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

// Convert a 0/1 `v` into a recovery param:
// * For non-EIP155 transactions, return `27 + v`
// * For EIP155 transactions, return `(CHAIN_ID*2) + 35 + v`
function getRecoveryParam(v, useEIP155, chainId) {
  // If we are not using EIP155, convert v directly to a buffer and return it
  if (false === useEIP155)
    return Buffer.from(new BN(v).plus(27).toString(16), 'hex');
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

function isHexStr(str) {
  return (/^[0-9a-fA-F]+$/).test(str)
}

// Determine if the Lattice can display a string we give it. Currently, the Lattice can only
// display ASCII strings, so we will reject other UTF8 codes.
// In the future we may add a mechanism to display certain UTF8 codes such as popular emojis.
function latticeCanDisplayStr(str) {
  for (let i = 0; i < str.length; i++)
    if (str.charCodeAt(i) < 0x0020 || str.charCodeAt(i) > 0x007f)
      return false;
  return true;
}

const chainIds = {
  mainnet: 1,
  roptsten: 3,
  rinkeby: 4,
  kovan: 42,
  goerli: 5
}

// Get a buffer containing the chainId value.
// Returns a 1, 2, 4, or 8 byte buffer with the chainId encoded in big endian
function getChainIdBuf(chainId) {
  let b;
  // If our chainID is a hex string, we can convert it to a hex
  // buffer directly
  if (true === isValidChainIdHexNumStr(chainId))
    b = ensureHexBuffer(chainId);
  // If our chainID is a base-10 number, parse with bignumber.js and convert to hex buffer
  else
    b = ensureHexBuffer(new BN(chainId).toString(16));
  // Make sure the buffer is an allowed size
  if (b.length > 8)
    throw new Error('ChainID provided is too large.');
  // If this matches a u16, u32, or u64 size, return it now
  if (b.length <= 2 || b.length === 4 || b.length === 8)
    return b;
  // For other size buffers, we need to pack into u32 or u64 before returning;
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

// Determine if the chain uses EIP155 by default, based on the chainID
function chainUsesEIP155(chainID) {
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

// Determine if a valid number was passed in as a hex string
function isValidChainIdHexNumStr(s) {
  return new BN(s, 16).isNaN() === false;
}

// If this is a nubmer that fits in one byte, we don't need to add it
// to the `data` buffer of the main transaction. 
// Note the one edge case: we still need to use the `data` field for chainID=255.
function useChainIdBuffer(id) {
  const buf = getChainIdBuf(id);
  if (buf.length === 1)
    return buf.readUInt8(0) === 255;
  return true;
}

exports.chainIds = chainIds;

// Ensure a param is represented by a buffer
// TODO: Remove circular dependency in util.js so that we can put this function there
function ensureHexBuffer(x) {
  if (x === null || x === 0) return Buffer.alloc(0);
  else if (Buffer.isBuffer(x)) x = x.toString('hex');
  if (typeof x === 'number') x = `${x.toString(16)}`;
  else if (typeof x === 'string' && x.slice(0, 2) === '0x') x = x.slice(2);
  if (x.length % 2 > 0) x = `0${x}`;
  return Buffer.from(x, 'hex');
}
exports.ensureHexBuffer = ensureHexBuffer;