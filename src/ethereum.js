// Utils for Ethereum transactions. This is effecitvely a shim of ethereumjs-util, which
// does not have browser (or, by proxy, React-Native) support.
const BN = require('bignumber.js');
const Buffer = require('buffer/').Buffer;
const cbor = require('borc');
const constants = require('./constants');
const ethers = require('ethers');
const eip712 = require('ethers-eip712');
const keccak256 = require('js-sha3').keccak256;
const rlp = require('rlp-browser');
const secp256k1 = require('secp256k1');

exports.buildEthereumMsgRequest = function(input) {
  if (!input.payload || !input.protocol || !input.signerPath)
    throw new Error('You must provide `payload`, `signerPath`, and `protocol` arguments in the messsage request');
  if (input.signerPath.length > 5 || input.signerPath.length < 2) 
    throw new Error('Please provide a signer path with 2-5 indices');
  const req = {
    schema: constants.signingSchema.ETH_MSG,
    payload: null,
    input, // Save the input for later
    msg: null, // Save the buffered message for later
  }
  try {
    switch (input.protocol) {
      case 'signPersonal':
        return buildPersonalSignRequest(req, input)
      case 'eip712':
        if (!input.fwConstants.eip712Supported)
          throw new Error('EIP712 is not supported by your Lattice firmware version. Please upgrade.')
        return buildEIP712Request(req, input)
      default:
        throw new Error('Unsupported protocol');
    }
  } catch (err) {
    return { err: err.toString() }
  }
}

exports.validateEthereumMsgResponse = function(res, req) {
  const { signer, sig } = res;
  const { input, msg, prehash=null } = req;
  if (input.protocol === 'signPersonal') {
    // NOTE: We are currently hardcoding networkID=1 and useEIP155=false but these
    //       may be configurable in future versions
    const hash =  prehash ? 
                  prehash : 
                  Buffer.from(keccak256(Buffer.concat([get_personal_sign_prefix(msg.length), msg])), 'hex');
    return addRecoveryParam(hash, sig, signer, 1, false)
  } else if (input.protocol === 'eip712') {
    const digest = prehash ? prehash : eip712.TypedDataUtils.encodeDigest(req.input.payload);
    return addRecoveryParam(digest, sig, signer)
  } else {
    throw new Error('Unsupported protocol');
  }
}

exports.buildEthereumTxRequest = function(data) {
  try {
    let { chainId=1 } = data;
    const { signerPath, eip155=null, fwConstants } = data;
    const { extraDataFrameSz, extraDataMaxFrames, prehashAllowed } = fwConstants;
    const EXTRA_DATA_ALLOWED = extraDataFrameSz > 0 && extraDataMaxFrames > 0;
    const MAX_BASE_DATA_SZ = fwConstants.ethMaxDataSz;
    const VAR_PATH_SZ = fwConstants.varAddrPathSzAllowed;

    // Sanity checks:
    // There are a handful of named chains we allow the user to reference (`chainIds`)
    // Custom chainIDs should be either numerical or hex strings
    if (typeof chainId !== 'number' && isValidChainIdHexNumStr(chainId) === false) 
      chainId = chainIds[chainId];
    // If this was not a custom chainID and we cannot find the name of it, exit
    if (!chainId) 
      throw new Error('Unsupported chain ID or name');
    // Sanity check on signePath
    if (!signerPath) 
      throw new Error('`signerPath` not provided');

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
    const txReqPayload = Buffer.alloc(MAX_BASE_DATA_SZ + ETH_TX_NON_DATA_SZ);
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

    // 2. Signer Path
    //------------------
    const signerPathBuf = buildSignerPathBuf(signerPath, VAR_PATH_SZ);
    signerPathBuf.copy(txReqPayload, off);
    off += signerPathBuf.length;

    // 3. ETH TX request data
    //------------------
    if (nonceBytes.length > 4)
      throw new Error('Nonce too large');
    nonceBytes.copy(txReqPayload, off + (4 - nonceBytes.length)); off += 4;
    if (gasPriceBytes.length > 8)
      throw new Error('Gas price too large');
    gasPriceBytes.copy(txReqPayload, off + (8 - gasPriceBytes.length)); off += 8;
    if (gasLimitBytes.length > 4)
      throw new Error('Gas limit too large');
    gasLimitBytes.copy(txReqPayload, off + (4 - gasLimitBytes.length)); off += 4;
    if (toBytes.length !== 20)
      throw new Error('Invalid `to` address');
    toBytes.copy(txReqPayload, off); off += 20;
    if (valueBytes.length > 32)
      throw new Error('Value too large');
    valueBytes.copy(txReqPayload, off + (32 - valueBytes.length)); off += 32;
    // Flow data into extraData requests, which will follow-up transaction requests, if supported/applicable    
    const extraDataPayloads = [];
    let prehash = null;
    if (dataBytes && dataBytes.length > MAX_BASE_DATA_SZ) {
      // Determine sizes and run through sanity checks
      const chainIdExtraSz = chainIdBufSz > 0 ? chainIdBufSz + 1 : 0;
      const totalSz = dataBytes.length + chainIdExtraSz;
      const maxSzAllowed = MAX_BASE_DATA_SZ + (extraDataMaxFrames * extraDataFrameSz);

      // Copy the data into a tmp buffer. Account for larger chain ID sizes if applicable.
      const dataToCopy = Buffer.alloc(dataBytes.length + chainIdExtraSz)
      if (chainIdExtraSz > 0) {
        dataToCopy.writeUInt8(chainIdBufSz, 0);
        chainIdBuf.copy(dataToCopy, 1);
        dataBytes.copy(dataToCopy, chainIdExtraSz);
      } else {
        dataBytes.copy(dataToCopy, 0);
      }

      if (prehashAllowed && totalSz > maxSzAllowed) {
        // If this payload is too large to send, but the Lattice allows a prehashed message, do that
        prehash = Buffer.from(keccak256(rlp.encode(rawTx)), 'hex')
      } else {
        if ((!EXTRA_DATA_ALLOWED) || (EXTRA_DATA_ALLOWED && totalSz > maxSzAllowed))
          throw new Error(`Data field too large (got ${dataBytes.length}; must be <=${maxSzAllowed-chainIdExtraSz} bytes)`);
        // Split overflow data into extraData frames
        const frames = splitFrames(dataToCopy.slice(MAX_BASE_DATA_SZ), extraDataFrameSz);
        frames.forEach((frame) => {
          const szLE = Buffer.alloc(4);
          szLE.writeUInt32LE(frame.length);
          extraDataPayloads.push(Buffer.concat([szLE, frame]));
        })
      }
    }
    // Write the data size (does *NOT* include the chainId buffer, if that exists)
    txReqPayload.writeUInt16BE(dataBytes.length, off); off += 2;
    // Copy in the chainId buffer if needed
    if (chainIdBufSz > 0) {
      txReqPayload.writeUInt8(chainIdBufSz, off); off++;
      chainIdBuf.copy(txReqPayload, off); off += chainIdBufSz;
    }
    // Copy the first slice of the data itself. If this payload has been pre-hashed, include it
    // in the `data` field. This will result in a different Lattice screen being drawn.
    if (prehash) {
      prehash.copy(txReqPayload, off); off += MAX_BASE_DATA_SZ;
    } else {
      dataBytes.slice(0, MAX_BASE_DATA_SZ).copy(txReqPayload, off); off += MAX_BASE_DATA_SZ;
    }
    return {
      rawTx,
      payload: txReqPayload.slice(0, off),
      extraDataPayloads,
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
  const hash = Buffer.from(keccak256(rlpEncoded), 'hex')
  const newSig = addRecoveryParam(hash, sig, address, tx.chainId, useEIP155);
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
function addRecoveryParam(hashBuf, sig, address, chainId, useEIP155) {
  try {
    // Rebuild the keccak256 hash here so we can `ecrecover`
    const hash = new Uint8Array(hashBuf);
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
function getRecoveryParam(v, useEIP155, chainId=null) {
  // If we are not using EIP155, convert v directly to a buffer and return it
  if (false === useEIP155 || chainId === null)
    return Buffer.from(new BN(v).plus(27).toString(16), 'hex');
  // We will use EIP155 in most cases. Convert v to a bignum and operate on it.
  // Note that the protocol calls for v = (CHAIN_ID*2) + 35/36, where 35 or 36
  // is decided on based on the ecrecover result. `v` is passed in as either 0 or 1
  // so we add 35 to that.
  const chainIdBuf = getChainIdBuf(chainId);
  const chainIdBN = new BN(chainIdBuf.toString('hex'), 16);
  return ensureHexBuffer(`0x${chainIdBN.times(2).plus(35).plus(v).toString(16)}`);
}

function isHexStr(str) {
  return (/^[0-9a-fA-F]+$/).test(str)
}

function isASCIIStr(str) {
  return (/^[\x00-\x7F]+$/).test(str)
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
    b = ensureHexBuffer(`0x${new BN(chainId).toString(16)}`);
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
  if (typeof s !== 'string')
    return false;
  if (s.slice(0, 2) !== '0x')
    return false;
  try {
    const b = new BN(s, 16)
    return b.isNaN() === false;
  } catch (err) {
    return false;
  }
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

function isBase10NumStr(x) {
  const bn = new BN(x).toString().split('.').join('');
  const s = new String(x)
  // Note that the JS native `String()` loses precision for large numbers, but we only
  // want to validate the base of the number so we don't care about far out precision.
  return bn.slice(0, 8) === s.slice(0, 8)
}

// Ensure a param is represented by a buffer
// TODO: Remove circular dependency in util.js so that we can put this function there
function ensureHexBuffer(x, zeroIsNull=true) {
  try {
    // For null values, return a 0-sized buffer. For most situations we assume
    // 0 should be represented with a zero-length buffer (e.g. for RLP-building
    // txs), but it can also be treated as a 1-byte buffer (`00`) if needed
    if (x === null || (x === 0 && zeroIsNull === true)) 
      return Buffer.alloc(0);
    const isNumber = typeof x === 'number' || isBase10NumStr(x);
    // Otherwise try to get this converted to a hex string
    if (isNumber) {
      // If this is a number or a base-10 number string, convert it to hex
      x = `${new BN(x).toString(16)}`;
    } else if (typeof x === 'string' && x.slice(0, 2) === '0x') {
      x = x.slice(2);
    } else {
      x = x.toString('hex')
    }
    if (x.length % 2 > 0) x = `0${x}`;
    if (x === '00' && !isNumber)
      return Buffer.alloc(0);
    return Buffer.from(x, 'hex');
  } catch (err) {
    throw new Error(`Cannot convert ${x.toString()} to hex buffer (${err.toString()})`);
  }
}
exports.ensureHexBuffer = ensureHexBuffer;


function buildPersonalSignRequest(req, input) {
  const MAX_BASE_MSG_SZ = input.fwConstants.ethMaxMsgSz;
  const VAR_PATH_SZ = input.fwConstants.varAddrPathSzAllowed;
  const L = (24) + MAX_BASE_MSG_SZ + 4;
  let off = 0;
  req.payload = Buffer.alloc(L);
  req.payload.writeUInt8(constants.ethMsgProtocol.SIGN_PERSONAL, 0); off += 1;
  // Write the signer path into the buffer
  const signerPathBuf = buildSignerPathBuf(input.signerPath, VAR_PATH_SZ);
  signerPathBuf.copy(req.payload, off);
  off += signerPathBuf.length;
  // Write the payload buffer. The payload can come in either as a buffer or as a string
  let payload = input.payload;
  // Determine if this is a hex string
  let displayHex = false;
  if (typeof input.payload === 'string') {
    if (input.payload.slice(0, 2) === '0x') {
      payload = ensureHexBuffer(input.payload)
      displayHex = false === isASCIIStr(Buffer.from(input.payload.slice(2), 'hex').toString())
    } else {
      if (false === latticeCanDisplayStr(input.payload))
        throw new Error('Currently, the Lattice can only display ASCII strings.');
      payload = Buffer.from(input.payload)
    }
  } else if (typeof input.displayHex === 'boolean') {
    // If this is a buffer and the user has specified whether or not this
    // is a hex buffer with the optional argument, write that
    displayHex = input.displayHex
  } else {
    // Otherwise, determine if this buffer is an ASCII string. If it is, set `displayHex` accordingly.
    // NOTE: THIS MEANS THAT NON-ASCII STRINGS WILL DISPLAY AS HEX SINCE WE CANNOT KNOW IF THE REQUESTER
    //        EXPECTED NON-ASCII CHARACTERS TO DISPLAY IN A STRING
    // TODO: Develop a more elegant solution for this
    if (!input.payload.toString)
      throw new Error('Unsupported input data type');
    displayHex = false === isASCIIStr(input.payload.toString())
  }
  const fwConst = input.fwConstants;
  const maxSzAllowed = MAX_BASE_MSG_SZ + (fwConst.extraDataMaxFrames * fwConst.extraDataFrameSz);
  if (fwConst.ethMsgPreHashAllowed && payload.length > maxSzAllowed) {
    // If this message will not fit and pre-hashing is allowed, do that
    req.payload.writeUInt8(displayHex, off); off += 1;
    req.payload.writeUInt16LE(payload.length, off); off += 2;
    const prehash = Buffer.from(keccak256(Buffer.concat([get_personal_sign_prefix(payload.length), payload])), 'hex');
    prehash.copy(req.payload, off);
    req.prehash = prehash;
  } else {
    // Otherwise we can fit the payload.
    // Flow data into extraData requests, which will follow-up transaction requests, if supported/applicable    
    const extraDataPayloads = getExtraData(payload, input);
    // Write the payload and metadata into our buffer
    req.extraDataPayloads = extraDataPayloads
    req.msg = payload;
    req.payload.writeUInt8(displayHex, off); off += 1;
    req.payload.writeUInt16LE(payload.length, off); off += 2;
    payload.copy(req.payload, off);
  }
  return req;
}

function buildEIP712Request(req, input) {
  try {
    const MAX_BASE_MSG_SZ = input.fwConstants.ethMaxMsgSz;
    const VAR_PATH_SZ = input.fwConstants.varAddrPathSzAllowed;
    const TYPED_DATA = constants.ethMsgProtocol.TYPED_DATA;
    const L = (24) + MAX_BASE_MSG_SZ + 4;
    let off = 0;
    req.payload = Buffer.alloc(L);
    req.payload.writeUInt8(TYPED_DATA.enumIdx, 0); off += 1;
    // Write the signer path
    const signerPathBuf = buildSignerPathBuf(input.signerPath, VAR_PATH_SZ);
    signerPathBuf.copy(req.payload, off);
    off += signerPathBuf.length;
    // Parse/clean the EIP712 payload, serialize with CBOR, and write to the payload
    const data = JSON.parse(JSON.stringify(input.payload));
    if (!data.primaryType || !data.types[data.primaryType])
      throw new Error('primaryType must be specified and the type must be included.')
    if (!data.message || !data.domain)
      throw new Error('message and domain must be specified.')
    if (0 > Object.keys(data.types).indexOf('EIP712Domain'))
      throw new Error('EIP712Domain type must be defined.')
    // Parse the payload to ensure we have valid EIP712 data types and that
    // they are encoded such that Lattice firmware can parse them.
    // We need two different encodings:
    // 1. Use `ethers` BigNumber when building the request to be validated by ethers-eip712.
    //    Make sure we use a copy of the data to avoid mutation problems
    input.payload.message = parseEIP712Msg( JSON.parse(JSON.stringify(data.message)), 
                                            JSON.parse(JSON.stringify(data.primaryType)), 
                                            JSON.parse(JSON.stringify(data.types)), 
                                            true);
    input.payload.domain = parseEIP712Msg( JSON.parse(JSON.stringify(data.domain)), 
                                            'EIP712Domain', 
                                            JSON.parse(JSON.stringify(data.types)), 
                                            true);
    // 2. Use `bignumber.js` for the request going to the Lattice, since it's the required
    //    BigNumber lib for `cbor`, which we use to encode the request data to the Lattice.
    data.domain = parseEIP712Msg(data.domain, 'EIP712Domain', data.types, false);
    data.message = parseEIP712Msg(data.message, data.primaryType, data.types, false);
    // Now build the message to be sent to the Lattice
    const payload = Buffer.from(cbor.encode(data));
    const fwConst = input.fwConstants;
    const maxSzAllowed = MAX_BASE_MSG_SZ + (fwConst.extraDataMaxFrames * fwConst.extraDataFrameSz);
    if (fwConst.ethMsgPreHashAllowed && payload.length > maxSzAllowed) {
      // If this payload is too large to send, but the Lattice allows a prehashed message, do that
      req.payload.writeUInt16LE(payload.length, off); off += 2;
      const prehash = Buffer.from(keccak256(eip712.TypedDataUtils.encodeDigest(req.input.payload), 'hex'), 'hex');
      prehash.copy(req.payload, off);
      req.prehash = prehash;
    } else {
      const extraDataPayloads = getExtraData(payload, input);
      req.extraDataPayloads = extraDataPayloads;
      req.payload.writeUInt16LE(payload.length, off); off += 2;
      payload.copy(req.payload, off); off += payload.length;
      // Slice out the part of the buffer that we didn't use.
      req.payload = req.payload.slice(0, off);
    }
    return req;
  } catch (err) {
    return { err: `Failed to build EIP712 request: ${err.message}` };
  }
}

function buildSignerPathBuf(signerPath, varAddrPathSzAllowed) {
  const buf = Buffer.alloc(24);
  let off = 0;
  if (varAddrPathSzAllowed && signerPath.length > 5)
    throw new Error('Signer path must be <=5 indices.');
  if (!varAddrPathSzAllowed && signerPath.length !== 5)
    throw new Error('Your Lattice firmware only supports 5-index derivation paths. Please upgrade.');
  buf.writeUInt32LE(signerPath.length, off); off += 4;
  for (let i = 0; i < 5; i++) {
    if (i < signerPath.length)
      buf.writeUInt32LE(signerPath[i], off); 
    else
      buf.writeUInt32LE(0, off);
    off += 4;
  }
  return buf;
}

function getExtraData(payload, input) {
  const { ethMaxMsgSz, extraDataFrameSz, extraDataMaxFrames } = input.fwConstants;
  const MAX_BASE_MSG_SZ = ethMaxMsgSz;
  const EXTRA_DATA_ALLOWED = extraDataFrameSz > 0 && extraDataMaxFrames > 0;
  const extraDataPayloads = [];
  if (payload.length > MAX_BASE_MSG_SZ) {
    // Determine sizes and run through sanity checks
    const maxSzAllowed = MAX_BASE_MSG_SZ + (extraDataMaxFrames * extraDataFrameSz);
    if (!EXTRA_DATA_ALLOWED)
      throw new Error(`Your message is ${payload.length} bytes, but can only be a maximum of ${MAX_BASE_MSG_SZ}`);
    else if (EXTRA_DATA_ALLOWED && payload.length > maxSzAllowed)
      throw new Error(`Your message is ${payload.length} bytes, but can only be a maximum of ${maxSzAllowed}`);
    // Split overflow data into extraData frames
    const frames = splitFrames(payload.slice(MAX_BASE_MSG_SZ), extraDataFrameSz);
    frames.forEach((frame) => {
      const szLE = Buffer.alloc(4);
      szLE.writeUInt32LE(frame.length);
      extraDataPayloads.push(Buffer.concat([szLE, frame]));
    })
  }
  return extraDataPayloads;
}

function splitFrames(data, frameSz) {
  const frames = []
  const n = Math.ceil(data.length / frameSz);
  let off = 0;
  for (let i = 0; i < n; i++) {
    frames.push(data.slice(off, off + frameSz));
    off += frameSz;
  }
  return frames;
}

function parseEIP712Msg(msg, typeName, types, isEthers=false) {
  try {
    const type = types[typeName];
    type.forEach((item) => {
      const isCustomType = Object.keys(types).indexOf(item.type) > -1;
      if (true === isCustomType) {
        msg[item.name] = parseEIP712Msg(msg[item.name], item.type, types, isEthers)
      } else {
        msg[item.name] = parseEIP712Item(msg[item.name], item.type, isEthers)
      }
    })
  } catch (err) {
    throw new Error(err.message);
  }
  return msg;
}

function parseEIP712Item(data, type, isEthers=false) {
  if (type === 'bytes') {
    // Variable sized bytes need to be buffer type
    data = ensureHexBuffer(data);
  } else if (type.slice(0, 5) === 'bytes') {
    // Fixed sizes bytes need to be buffer type. We also add some sanity checks.
    const nBytes = parseInt(type.slice(5));
    data = ensureHexBuffer(data);
    if (data.length !== nBytes)
      throw new Error(`Expected ${type} type, but got ${data.length} bytes`);
  } else if (type === 'address') {
    // Address must be a 20 byte buffer
    data = ensureHexBuffer(data);
    // Edge case to handle the 0-address
    if (data.length === 0) {
      data = Buffer.alloc(20);
    }
    if (data.length !== 20)
      throw new Error(`Address type must be 20 bytes, but got ${data.length} bytes`);
    // Ethers wants addresses as hex strings
    if (isEthers === true) {
      data = `0x${data.toString('hex')}`
    }
  } else if ( (constants.ethMsgProtocol.TYPED_DATA.typeCodes[type]) && 
              (type.indexOf('uint') > -1 || type.indexOf('int') > -1)) {
    let b = ensureHexBuffer(data);
    // Edge case to handle 0-value bignums
    if (b.length === 0) {
      b = Buffer.from('00', 'hex');
    }
    // Uint256s should be encoded as bignums.
    if (isEthers === true) {
      // `ethers` uses their own BigNumber lib
      data = ethers.BigNumber.from(`0x${b.toString('hex')}`)
    } else {
      // `bignumber.js` is needed for `cbor` encoding, which gets sent to the Lattice and plays
      // nicely with its firmware cbor lib.
      // NOTE: If we instantiate a `bignumber.js` object, it will not match what `borc` creates
      // when run inside of the browser (i.e. MetaMask). Thus we introduce this hack to make sure
      // we are creating a compatible type.
      // TODO: Find another cbor lib that is compataible with the firmware's lib in a browser
      // context. This is surprisingly difficult - I tried several libs and only cbor/borc have
      // worked (borc is a supposedly "browser compatible" version of cbor)
      data = new cbor.Encoder().semanticTypes[1][0](b.toString('hex'), 16)
    }
  } else if (type === 'bool') {
    // Booleans need to be cast to a u8
    data = data === true ? 1 : 0;
  }
  // Other types don't need to be modified
  return data;
}

function get_personal_sign_prefix(L) {
  return Buffer.from(
    `\u0019Ethereum Signed Message:\n${L.toString()}`,
    'utf-8',
  );
}