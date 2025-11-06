// Utils for Ethereum transactions. This is effecitvely a shim of ethereumjs-util, which
// does not have browser (or, by proxy, React-Native) support.
import BN from 'bignumber.js';
import { SignTypedDataVersion, TypedDataUtils } from '@metamask/eth-sig-util';
import { Hash } from 'ox';
import { RLP } from '@ethereumjs/rlp';
import * as secp256k1 from 'secp256k1';
import {
  ASCII_REGEX,
  HANDLE_LARGER_CHAIN_ID,
  MAX_CHAIN_ID_BYTES,
  ethMsgProtocol,
  EXTERNAL,
} from './constants';
import { LatticeSignSchema } from './protocol';
import {
  buildSignerPathBuf,
  ensureHexBuffer,
  fixLen,
  isAsciiStr,
  splitFrames,
  convertRecoveryToV,
} from './util';
import * as cbor from 'cbor';
import bdec from 'cbor-bigdecimal';
import {
  TransactionSerializable,
  serializeTransaction,
  type Hex,
  hexToNumber,
} from 'viem';
import {
  type SigningPath,
  type FirmwareConstants,
  TransactionRequest,
  TRANSACTION_TYPE,
} from './types';
import { buildGenericSigningMsgRequest } from './genericSigning';
import { TransactionSchema, type FlexibleTransaction } from './schemas';

bdec(cbor);

const buildEthereumMsgRequest = function (input) {
  if (!input.payload || !input.protocol || !input.signerPath)
    throw new Error(
      'You must provide `payload`, `signerPath`, and `protocol` arguments in the messsage request',
    );
  if (input.signerPath.length > 5 || input.signerPath.length < 2)
    throw new Error('Please provide a signer path with 2-5 indices');
  const req = {
    schema: LatticeSignSchema.ethereumMsg,
    payload: null,
    input, // Save the input for later
    msg: null, // Save the buffered message for later
  };
  switch (input.protocol) {
    case 'signPersonal':
      return buildPersonalSignRequest(req, input);
    case 'eip712':
      if (!input.fwConstants.eip712Supported)
        throw new Error(
          'EIP712 is not supported by your Lattice firmware version. Please upgrade.',
        );
      return buildEIP712Request(req, input);
    default:
      throw new Error('Unsupported protocol');
  }
};

const validateEthereumMsgResponse = function (res, req) {
  const { signer, sig } = res;
  const { input, msg, prehash = null } = req;
  if (input.protocol === 'signPersonal') {
    // NOTE: We are currently hardcoding networkID=1 and useEIP155=false but these
    //       may be configurable in future versions
    const hash = prehash
      ? prehash
      : Buffer.from(
          Hash.keccak256(
            Buffer.concat([get_personal_sign_prefix(msg.length), msg]),
          ),
        );
    // Get recovery param with a `v` value of [27,28] by setting `useEIP155=false`
    return addRecoveryParam(hash, sig, signer, {
      chainId: 1,
      useEIP155: false,
    });
  } else if (input.protocol === 'eip712') {
    // Use the validationPayload that was created in buildEIP712Request
    // This payload has been parsed with forJSParser=true, converting all numbers
    // to the format that TypedDataUtils.eip712Hash expects
    const rawPayloadForHashing = req.validationPayload || req.input.payload;
    const payloadForHashing = req.validationPayload
      ? JSON.parse(JSON.stringify(req.validationPayload))
      : normalizeTypedDataForHashing(rawPayloadForHashing);
    const encoded = TypedDataUtils.eip712Hash(
      payloadForHashing,
      SignTypedDataVersion.V4,
    );
    const digest = prehash ? prehash : encoded;
    // Parse chainId - it could be a number, hex string, decimal string, or bigint
    let chainId =
      input.payload.domain?.chainId || payloadForHashing.domain?.chainId;
    if (typeof chainId === 'string') {
      chainId = chainId.startsWith('0x')
        ? parseInt(chainId, 16)
        : parseInt(chainId, 10);
    } else if (typeof chainId === 'bigint') {
      chainId = Number(chainId);
    }
    // Get recovery param with a `v` value of [27,28] by setting `useEIP155=false`
    return addRecoveryParam(digest, sig, signer, { chainId, useEIP155: false });
  } else {
    throw new Error('Unsupported protocol');
  }
};

function normalizeTypedDataForHashing(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
      try {
        const asBigInt = BigInt(trimmed);
        if (
          asBigInt <= BigInt(Number.MAX_SAFE_INTEGER) &&
          asBigInt >= BigInt(Number.MIN_SAFE_INTEGER)
        ) {
          return Number(asBigInt);
        }
        return asBigInt.toString(10);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString(10);
  }

  if (BN.isBigNumber(value)) {
    const asNumber = Number(value.toString(10));
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString(10);
  }

  if (
    value &&
    typeof value === 'object' &&
    typeof value.toString === 'function' &&
    value.constructor &&
    value.constructor.name === 'BN' &&
    typeof value.toArray === 'function'
  ) {
    const str = value.toString(10);
    const asNumber = Number(str);
    return Number.isSafeInteger(asNumber) ? asNumber : str;
  }

  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return `0x${Buffer.from(value).toString('hex')}`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeTypedDataForHashing(item));
  }

  if (typeof value === 'object') {
    const normalized: Record<string, any> = {};
    for (const [key, entry] of Object.entries(value)) {
      normalized[key] = normalizeTypedDataForHashing(entry);
    }
    return normalized;
  }

  return value;
}

const buildEthereumTxRequest = function (data) {
  try {
    let { chainId = 1 } = data;
    const { signerPath, eip155 = null, fwConstants, type = null } = data;
    const {
      contractDeployKey,
      extraDataFrameSz,
      extraDataMaxFrames,
      prehashAllowed,
    } = fwConstants;
    const EXTRA_DATA_ALLOWED = extraDataFrameSz > 0 && extraDataMaxFrames > 0;
    const MAX_BASE_DATA_SZ = fwConstants.ethMaxDataSz;
    const VAR_PATH_SZ = fwConstants.varAddrPathSzAllowed;
    // Sanity checks:
    // There are a handful of named chains we allow the user to reference (`chainIds`)
    // Custom chainIDs should be either numerical or hex strings
    if (
      typeof chainId !== 'number' &&
      isValidChainIdHexNumStr(chainId) === false
    ) {
      chainId = chainIds[chainId];
    }
    // If this was not a custom chainID and we cannot find the name of it, exit
    if (!chainId) throw new Error('Unsupported chain ID or name');
    // Sanity check on signePath
    if (!signerPath) throw new Error('`signerPath` not provided');

    // Is this a contract deployment?
    if (data.to === null && !contractDeployKey) {
      throw new Error(
        'Contract deployment not supported. Please update your Lattice firmware.',
      );
    }
    const isDeployment = data.to === null && contractDeployKey;
    // We support eip1559 and eip2930 types (as well as legacy)
    const eip1559IsAllowed =
      fwConstants.allowedEthTxTypes &&
      fwConstants.allowedEthTxTypes.indexOf(2) > -1;
    const eip2930IsAllowed =
      fwConstants.allowedEthTxTypes &&
      fwConstants.allowedEthTxTypes.indexOf(1) > -1;
    const isEip1559 = eip1559IsAllowed && (type === 2 || type === 'eip1559');
    const isEip2930 = eip2930IsAllowed && (type === 1 || type === 'eip2930');
    if (type !== null && !isEip1559 && !isEip2930)
      throw new Error('Unsupported Ethereum transaction type');
    // Determine if we should use EIP155 given the chainID.
    // If we are explicitly told to use eip155, we will use it. Otherwise,
    // we will look up if the specified chainId is associated with a chain
    // that does not use EIP155 by default. Note that most do use EIP155.
    let useEIP155 = chainUsesEIP155(chainId);
    if (eip155 !== null && typeof eip155 === 'boolean') {
      useEIP155 = eip155;
    } else if (isEip1559 || isEip2930) {
      // Newer transaction types do not use EIP155 since the chainId is serialized
      useEIP155 = false;
    }

    // Hack for metamask, which sends value=null for 0 ETH transactions
    if (!data.value) data.value = 0;

    //--------------
    // 1. BUILD THE RAW TX FOR FUTURE RLP ENCODING
    //--------------
    // Ensure all fields are 0x-prefixed hex strings
    const rawTx = [];
    // Build the transaction buffer array
    const chainIdBytes = ensureHexBuffer(chainId);
    const nonceBytes = ensureHexBuffer(data.nonce);
    let gasPriceBytes;
    const gasLimitBytes = ensureHexBuffer(data.gasLimit);
    // Handle contract deployment (indicated by `to` being `null`)
    // For contract deployment we write a 20-byte key to the request
    // buffer, which gets swapped for an empty buffer in firmware.
    let toRlpElem, toBytes;
    if (isDeployment) {
      toRlpElem = Buffer.alloc(0);
      toBytes = ensureHexBuffer(contractDeployKey);
    } else {
      toRlpElem = ensureHexBuffer(data.to);
      toBytes = ensureHexBuffer(data.to);
    }
    const valueBytes = ensureHexBuffer(data.value);
    const dataBytes = ensureHexBuffer(data.data);

    if (isEip1559 || isEip2930) {
      // EIP1559 and EIP2930 transactions have a chainID field
      rawTx.push(chainIdBytes);
    }
    rawTx.push(nonceBytes);
    let maxPriorityFeePerGasBytes, maxFeePerGasBytes;
    if (isEip1559) {
      if (!data.maxPriorityFeePerGas)
        throw new Error(
          'EIP1559 transactions must include `maxPriorityFeePerGas`',
        );
      maxPriorityFeePerGasBytes = ensureHexBuffer(data.maxPriorityFeePerGas);
      rawTx.push(maxPriorityFeePerGasBytes);
      maxFeePerGasBytes = ensureHexBuffer(data.maxFeePerGas);
      rawTx.push(maxFeePerGasBytes);
      // EIP1559 renamed "gasPrice" to "maxFeePerGas", but firmware still
      // uses `gasPrice` in the struct, so update that value here.
      gasPriceBytes = maxFeePerGasBytes;
    } else {
      // EIP1559 transactions do not have the gasPrice field
      gasPriceBytes = ensureHexBuffer(data.gasPrice);
      rawTx.push(gasPriceBytes);
    }
    rawTx.push(gasLimitBytes);
    rawTx.push(toRlpElem);
    rawTx.push(valueBytes);
    rawTx.push(dataBytes);
    // We do not currently support accessList in firmware so we need to prehash if
    // the list is non-null
    let PREHASH_FROM_ACCESS_LIST = false;
    if (isEip1559 || isEip2930) {
      const accessList = [];
      if (Array.isArray(data.accessList)) {
        data.accessList.forEach((listItem) => {
          const keys = [];
          listItem.storageKeys.forEach((key) => {
            keys.push(ensureHexBuffer(key));
          });
          accessList.push([ensureHexBuffer(listItem.address), keys]);
          PREHASH_FROM_ACCESS_LIST = true;
        });
      }
      rawTx.push(accessList);
    } else if (useEIP155 === true) {
      // Add empty v,r,s values for EIP155 legacy transactions
      rawTx.push(chainIdBytes); // v (which is the same as chainId in EIP155 txs)
      rawTx.push(ensureHexBuffer(null)); // r
      rawTx.push(ensureHexBuffer(null)); // s
    }
    //--------------
    // 2. BUILD THE LATTICE REQUEST PAYLOAD
    //--------------
    const ETH_TX_NON_DATA_SZ = 122; // Accounts for metadata and non-data params
    const txReqPayload = Buffer.alloc(MAX_BASE_DATA_SZ + ETH_TX_NON_DATA_SZ);
    let off = 0;
    // 1. EIP155 switch and chainID
    //------------------
    txReqPayload.writeUInt8(Number(useEIP155), off);
    off++;
    // NOTE: Originally we designed for a 1-byte chainID, but modern rollup chains use much larger
    // chainID values. To account for these, we will put the chainID into the `data` buffer if it
    // is >=255. Values up to UINT64_MAX will be allowed.
    let chainIdBuf;
    let chainIdBufSz = 0;
    if (useChainIdBuffer(chainId) === true) {
      chainIdBuf = getChainIdBuf(chainId);
      chainIdBufSz = chainIdBuf.length;
      if (chainIdBufSz > MAX_CHAIN_ID_BYTES)
        throw new Error('ChainID provided is too large.');
      // Signal to Lattice firmware that it needs to read the chainId from the tx.data buffer
      txReqPayload.writeUInt8(HANDLE_LARGER_CHAIN_ID, off);
      off++;
    } else {
      // For chainIDs <255, write it to the chainId u8 slot in the main tx buffer
      chainIdBuf = ensureHexBuffer(chainId);
      if (chainIdBuf.length !== 1) throw new Error('Error parsing chainID');
      chainIdBuf.copy(txReqPayload, off);
      off += chainIdBuf.length;
    }
    // 2. Signer Path
    //------------------
    const signerPathBuf = buildSignerPathBuf(signerPath, VAR_PATH_SZ);
    signerPathBuf.copy(txReqPayload, off);
    off += signerPathBuf.length;

    // 3. ETH TX request data
    //------------------
    if (nonceBytes.length > 4) throw new Error('Nonce too large');
    nonceBytes.copy(txReqPayload, off + (4 - nonceBytes.length));
    off += 4;
    if (gasPriceBytes.length > 8) throw new Error('Gas price too large');
    gasPriceBytes.copy(txReqPayload, off + (8 - gasPriceBytes.length));
    off += 8;
    if (gasLimitBytes.length > 4) throw new Error('Gas limit too large');
    gasLimitBytes.copy(txReqPayload, off + (4 - gasLimitBytes.length));
    off += 4;
    if (toBytes.length !== 20) throw new Error('Invalid `to` address');
    toBytes.copy(txReqPayload, off);
    off += 20;
    if (valueBytes.length > 32) throw new Error('Value too large');
    valueBytes.copy(txReqPayload, off + (32 - valueBytes.length));
    off += 32;

    // Extra Tx data comes before `data` in the struct
    let PREHASH_UNSUPPORTED = false;
    if (fwConstants.allowedEthTxTypes) {
      // Some types may not be supported by firmware, so we will need to prehash
      if (PREHASH_FROM_ACCESS_LIST) {
        PREHASH_UNSUPPORTED = true;
      }
      txReqPayload.writeUInt8(PREHASH_UNSUPPORTED ? 1 : 0, off);
      off += 1;
      // EIP1559 & EIP2930 struct version
      if (isEip1559) {
        txReqPayload.writeUInt8(2, off);
        off += 1; // Eip1559 type enum value
        if (maxPriorityFeePerGasBytes.length > 8)
          throw new Error('maxPriorityFeePerGasBytes too large');
        maxPriorityFeePerGasBytes.copy(
          txReqPayload,
          off + (8 - maxPriorityFeePerGasBytes.length),
        );
        off += 8; // Skip EIP1559 params
      } else if (isEip2930) {
        txReqPayload.writeUInt8(1, off);
        off += 1; // Eip2930 type enum value
        off += 8; // Skip EIP1559 params
      } else {
        off += 9; // Skip EIP1559 and EIP2930 params
      }
    }

    // Flow data into extraData requests, which will follow-up transaction requests, if supported/applicable
    const extraDataPayloads = [];
    let prehash = null;

    // Create the buffer, prefix with chainId (if needed) and add data slice
    const dataSz = dataBytes.length || 0;
    const chainIdExtraSz = chainIdBufSz > 0 ? chainIdBufSz + 1 : 0;
    const dataToCopy = Buffer.alloc(dataSz + chainIdExtraSz);
    if (chainIdExtraSz > 0) {
      dataToCopy.writeUInt8(chainIdBufSz, 0);
      chainIdBuf.copy(dataToCopy, 1);
    }
    dataBytes.copy(dataToCopy, chainIdExtraSz);

    if (dataSz > MAX_BASE_DATA_SZ) {
      // Determine sizes and run through sanity checks
      const totalSz = dataSz + chainIdExtraSz;
      const maxSzAllowed =
        MAX_BASE_DATA_SZ + extraDataMaxFrames * extraDataFrameSz;

      if (prehashAllowed && totalSz > maxSzAllowed) {
        // If this payload is too large to send, but the Lattice allows a prehashed message, do that
        prehash = Buffer.from(
          Hash.keccak256(get_rlp_encoded_preimage(rawTx, type)),
        );
      } else {
        if (
          !EXTRA_DATA_ALLOWED ||
          (EXTRA_DATA_ALLOWED && totalSz > maxSzAllowed)
        )
          throw new Error(
            `Data field too large (got ${dataBytes.length}; must be <=${
              maxSzAllowed - chainIdExtraSz
            } bytes)`,
          );
        // Split overflow data into extraData frames
        const frames = splitFrames(
          dataToCopy.slice(MAX_BASE_DATA_SZ),
          extraDataFrameSz,
        );
        frames.forEach((frame) => {
          const szLE = Buffer.alloc(4);
          szLE.writeUInt32LE(frame.length, 0);
          extraDataPayloads.push(Buffer.concat([szLE, frame]));
        });
      }
    } else if (PREHASH_UNSUPPORTED) {
      // If something is unsupported in firmware but we want to allow such transactions,
      // we prehash the message here.
      prehash = Buffer.from(
        Hash.keccak256(get_rlp_encoded_preimage(rawTx, type)),
      );
    }

    // Write the data size (does *NOT* include the chainId buffer, if that exists)
    txReqPayload.writeUInt16BE(dataBytes.length, off);
    off += 2;
    // Copy in the chainId buffer if needed
    if (chainIdBufSz > 0) {
      txReqPayload.writeUInt8(chainIdBufSz, off);
      off++;
      chainIdBuf.copy(txReqPayload, off);
      off += chainIdBufSz;
    }
    // Copy the first slice of the data itself. If this payload has been pre-hashed, include it
    // in the `data` field. This will result in a different Lattice screen being drawn.
    if (prehash) {
      prehash.copy(txReqPayload, off);
      off += MAX_BASE_DATA_SZ;
    } else {
      dataBytes.slice(0, MAX_BASE_DATA_SZ).copy(txReqPayload, off);
      off += MAX_BASE_DATA_SZ;
    }
    return {
      rawTx,
      type,
      payload: txReqPayload.slice(0, off),
      extraDataPayloads,
      schema: LatticeSignSchema.ethereum, // We will use eth transfer for all ETH txs for v1
      chainId,
      useEIP155,
      signerPath,
    };
  } catch (err) {
    return { err: err.message };
  }
};

// From ethereumjs-util
function stripZeros(a) {
  let first = a[0];
  while (a.length > 0 && first.toString() === '0') {
    a = a.slice(1);
    first = a[0];
  }
  return a;
}

// Given a 64-byte signature [r,s] we need to figure out the v value
// and attah the full signature to the end of the transaction payload
const buildEthRawTx = function (tx, sig, address) {
  // RLP-encode the data we sent to the lattice
  const hash = Buffer.from(
    Hash.keccak256(get_rlp_encoded_preimage(tx.rawTx, tx.type)),
  );
  const newSig = addRecoveryParam(hash, sig, address, tx);
  // Use the signature to generate a new raw transaction payload
  // Strip the last 3 items and replace them with signature components
  const newRawTx = tx.useEIP155 ? tx.rawTx.slice(0, -3) : tx.rawTx;
  newRawTx.push(newSig.v);
  // Per `ethereumjs-tx`, RLP encoding should include signature components w/ stripped zeros
  // See: https://github.com/ethereumjs/ethereumjs-tx/blob/master/src/transaction.ts#L187
  newRawTx.push(stripZeros(newSig.r));
  newRawTx.push(stripZeros(newSig.s));
  const rlpEncoded = Buffer.from(RLP.encode(newRawTx));
  const rlpEncodedWithSig = tx.type
    ? Buffer.concat([Buffer.from([tx.type]), rlpEncoded])
    : rlpEncoded;

  if (
    tx.type === TRANSACTION_TYPE.EIP7702_AUTH ||
    tx.type === TRANSACTION_TYPE.EIP7702_AUTH_LIST
  ) {
    // For EIP-7702 transactions, we return just the hex string
    return rlpEncodedWithSig.toString('hex');
  }

  return { rawTx: rlpEncodedWithSig.toString('hex'), sigWithV: newSig };
};

// Attach a recovery parameter to a signature by brute-forcing ECRecover
export function addRecoveryParam(hashBuf, sig, address, txData = {}) {
  try {
    // Rebuild the keccak256 hash here so we can `ecrecover`
    const hash = new Uint8Array(hashBuf);
    const expectedAddrBuf = Buffer.isBuffer(address)
      ? address
      : ensureHexBuffer(address, false);
    if (expectedAddrBuf.length !== 20)
      throw new Error('Invalid signer address provided.');
    let v = 0;
    // Fix signature componenet lengths to 32 bytes each
    const r = fixLen(sig.r, 32);
    sig.r = r;
    const s = fixLen(sig.s, 32);
    sig.s = s;
    // Calculate the recovery param
    const rs = new Uint8Array(Buffer.concat([r, s]));
    let pubkey = secp256k1.ecdsaRecover(rs, v, hash, false).slice(1);
    const expectedAddrHex = expectedAddrBuf.toString('hex');
    const recoveredAddrs: string[] = [];
    // If the first `v` value is a match, return the sig!
    let recovered = pubToAddrStr(pubkey);
    recoveredAddrs.push(recovered);
    if (recovered === expectedAddrHex) {
      sig.v = getRecoveryParam(v, txData);
      return sig;
    }
    // Otherwise, try the other `v` value
    v = 1;
    pubkey = secp256k1.ecdsaRecover(rs, v, hash, false).slice(1);
    recovered = pubToAddrStr(pubkey);
    recoveredAddrs.push(recovered);
    if (recovered === expectedAddrHex) {
      sig.v = getRecoveryParam(v, txData);
      return sig;
    } else {
      // If neither is a match, we should return an error
      throw new Error(
        `Invalid Ethereum signature returned. expected=${expectedAddrHex}, recovered=${recoveredAddrs.join(',')}`,
      );
    }
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error(String(err));
  }
}

/**
 * Normalize Lattice signature components to viem format.
 * Handles Buffer v value conversion and yParity vs v for different transaction types.
 */
export function normalizeLatticeSignature(
  latticeResult: any,
  originalTx: TransactionSerializable,
) {
  // Convert Buffer v value to number
  let vValue: number;
  if (Buffer.isBuffer(latticeResult.sig.v)) {
    // Read entire buffer as big-endian integer
    // Single byte: <Buffer 26> = 0x26 = 38
    // Multi-byte: <Buffer 01 35> = 0x0135 = 309 (Polygon chainId 137 with EIP-155)
    const bufferLength = latticeResult.sig.v.length;
    if (bufferLength === 1) {
      vValue = latticeResult.sig.v.readUInt8(0);
    } else if (bufferLength === 2) {
      vValue = latticeResult.sig.v.readUInt16BE(0);
    } else if (bufferLength <= 4) {
      vValue = latticeResult.sig.v.readUInt32BE(Math.max(0, 4 - bufferLength));
    } else {
      // For very large buffers, read as hex and convert
      vValue = parseInt(latticeResult.sig.v.toString('hex'), 16);
    }
  } else if (typeof latticeResult.sig.v === 'number') {
    vValue = latticeResult.sig.v;
  } else if (typeof latticeResult.sig.v === 'string') {
    vValue = hexToNumber(latticeResult.sig.v as Hex);
  } else {
    vValue = Number(latticeResult.sig.v);
  }

  // For typed transactions (non-legacy), viem expects yParity instead of v
  if (originalTx.type !== 'legacy') {
    // Convert v to yParity (v is either 27/28 or 0/1)
    const yParity = vValue >= 27 ? vValue - 27 : vValue;
    return {
      ...originalTx,
      r: latticeResult.sig.r as Hex,
      s: latticeResult.sig.s as Hex,
      yParity,
    };
  } else {
    // Legacy transactions use v directly as BigInt
    const result = {
      ...originalTx,
      r: latticeResult.sig.r as Hex,
      s: latticeResult.sig.s as Hex,
      v: BigInt(vValue),
    };

    // For legacy transactions, remove the type field to ensure Viem treats it as legacy
    delete result.type;

    // Also remove any typed transaction fields that might confuse viem
    delete result.maxFeePerGas;
    delete result.maxPriorityFeePerGas;
    delete result.accessList;
    delete result.authorizationList;

    return result;
  }
}

// Convert an RLP-serialized transaction (plus signature) into a transaction hash
const hashTransaction = function (serializedTx) {
  return Hash.keccak256(Buffer.from(serializedTx, 'hex'));
};

// Returns address string given public key buffer
function pubToAddrStr(pub) {
  return Buffer.from(Hash.keccak256(pub)).slice(-20).toString('hex');
}

// Convert a 0/1 `v` into a recovery param:
// * For non-EIP155 transactions, return `27 + v`
// * For EIP155 transactions, return `(CHAIN_ID*2) + 35 + v`
// Uses the consolidated convertRecoveryToV function from util.ts
function getRecoveryParam(v, txData: any = {}) {
  const result = convertRecoveryToV(v, txData);

  // convertRecoveryToV returns Buffer for typed transactions, BN for legacy
  // Always return Buffer to maintain compatibility with existing code
  if (Buffer.isBuffer(result)) {
    return result;
  } else {
    // Convert BN result to hex buffer
    return ensureHexBuffer(`0x${result.toString(16)}`);
  }
}

const chainIds = {
  mainnet: 1,
  roptsten: 3,
  rinkeby: 4,
  kovan: 42,
  goerli: 5,
};

// Get a buffer containing the chainId value.
// Returns a 1, 2, 4, or 8 byte buffer with the chainId encoded in big endian
function getChainIdBuf(chainId) {
  let b;
  // If our chainID is a hex string, we can convert it to a hex
  // buffer directly
  if (true === isValidChainIdHexNumStr(chainId)) b = ensureHexBuffer(chainId);
  // If our chainID is a base-10 number, parse with bignumber.js and convert to hex buffer
  else b = ensureHexBuffer(`0x${new BN(chainId).toString(16)}`);
  // Make sure the buffer is an allowed size
  if (b.length > 8) throw new Error('ChainID provided is too large.');
  // If this matches a u16, u32, or u64 size, return it now
  if (b.length <= 2 || b.length === 4 || b.length === 8) return b;
  // For other size buffers, we need to pack into u32 or u64 before returning;
  let buf;
  if (b.length === 3) {
    buf = Buffer.alloc(4);
    buf.writeUInt32BE(chainId);
  } else if (b.length <= 8) {
    buf = Buffer.alloc(8);
    b.copy(buf, 8 - b.length);
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
    default:
      // all others should use eip155
      return true;
  }
}

// Determine if a valid number was passed in as a hex string
function isValidChainIdHexNumStr(s) {
  if (typeof s !== 'string') return false;
  if (s.slice(0, 2) !== '0x') return false;
  try {
    const b = new BN(s, 16);
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
  if (buf.length === 1) return buf.readUInt8(0) === 255;
  return true;
}

function buildPersonalSignRequest(req, input) {
  const MAX_BASE_MSG_SZ = input.fwConstants.ethMaxMsgSz;
  const VAR_PATH_SZ = input.fwConstants.varAddrPathSzAllowed;
  const L = 24 + MAX_BASE_MSG_SZ + 4;
  let off = 0;
  req.payload = Buffer.alloc(L);
  req.payload.writeUInt8(ethMsgProtocol.SIGN_PERSONAL, 0);
  off += 1;
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
      payload = ensureHexBuffer(input.payload);
      displayHex =
        false ===
        ASCII_REGEX.test(Buffer.from(input.payload.slice(2), 'hex').toString());
    } else {
      if (false === isAsciiStr(input.payload))
        throw new Error(
          'Currently, the Lattice can only display ASCII strings.',
        );
      payload = Buffer.from(input.payload);
    }
  } else if (typeof input.displayHex === 'boolean') {
    // If this is a buffer and the user has specified whether or not this
    // is a hex buffer with the optional argument, write that
    displayHex = input.displayHex;
  } else {
    // Otherwise, determine if this buffer is an ASCII string. If it is, set `displayHex` accordingly.
    // NOTE: THIS MEANS THAT NON-ASCII STRINGS WILL DISPLAY AS HEX SINCE WE CANNOT KNOW IF THE REQUESTER
    //        EXPECTED NON-ASCII CHARACTERS TO DISPLAY IN A STRING
    // TODO: Develop a more elegant solution for this
    if (!input.payload.toString) throw new Error('Unsupported input data type');
    displayHex = false === ASCII_REGEX.test(input.payload.toString());
  }
  const fwConst = input.fwConstants;
  let maxSzAllowed =
    MAX_BASE_MSG_SZ + fwConst.extraDataMaxFrames * fwConst.extraDataFrameSz;
  if (fwConst.personalSignHeaderSz) {
    // Account for the personal_sign header string
    maxSzAllowed -= fwConst.personalSignHeaderSz;
  }
  if (fwConst.ethMsgPreHashAllowed && payload.length > maxSzAllowed) {
    // If this message will not fit and pre-hashing is allowed, do that
    req.payload.writeUInt8(displayHex, off);
    off += 1;
    req.payload.writeUInt16LE(payload.length, off);
    off += 2;
    const prehash = Buffer.from(
      Hash.keccak256(
        Buffer.concat([get_personal_sign_prefix(payload.length), payload]),
      ),
    );
    prehash.copy(req.payload, off);
    req.prehash = prehash;
  } else {
    // Otherwise we can fit the payload.
    // Flow data into extraData requests, which will follow-up transaction requests, if supported/applicable
    const extraDataPayloads = getExtraData(payload, input);
    // Write the payload and metadata into our buffer
    req.extraDataPayloads = extraDataPayloads;
    req.msg = payload;
    req.payload.writeUInt8(displayHex, off);
    off += 1;
    req.payload.writeUInt16LE(payload.length, off);
    off += 2;
    payload.copy(req.payload, off);
  }
  return req;
}

function buildEIP712Request(req, input) {
  const { ethMaxMsgSz, varAddrPathSzAllowed, eip712MaxTypeParams } =
    input.fwConstants;
  const { TYPED_DATA } = ethMsgProtocol;
  const L = 24 + ethMaxMsgSz + 4;
  let off = 0;
  req.payload = Buffer.alloc(L);
  req.payload.writeUInt8(TYPED_DATA.enumIdx, 0);
  off += 1;
  // Write the signer path
  const signerPathBuf = buildSignerPathBuf(
    input.signerPath,
    varAddrPathSzAllowed,
  );
  signerPathBuf.copy(req.payload, off);
  off += signerPathBuf.length;
  // Parse/clean the EIP712 payload, serialize with CBOR, and write to the payload
  const data = JSON.parse(JSON.stringify(input.payload));
  if (!data.primaryType || !data.types[data.primaryType])
    throw new Error(
      'primaryType must be specified and the type must be included.',
    );
  if (!data.message || !data.domain)
    throw new Error('message and domain must be specified.');
  if (0 > Object.keys(data.types).indexOf('EIP712Domain'))
    throw new Error('EIP712Domain type must be defined.');
  // Parse the payload to ensure we have valid EIP712 data types and that
  // they are encoded such that Lattice firmware can parse them.
  // We need two different encodings: one to send to the Lattice in a format that plays
  // nicely with our firmware CBOR decoder. The other is formatted to be consumable by
  // our EIP712 validation module.
  // IMPORTANT: Create a new object for the validation payload instead of modifying input.payload
  // in place, so that validation uses the correctly formatted data
  const validationPayload = JSON.parse(JSON.stringify(data));
  validationPayload.message = parseEIP712Msg(
    JSON.parse(JSON.stringify(data.message)),
    JSON.parse(JSON.stringify(data.primaryType)),
    JSON.parse(JSON.stringify(data.types)),
    true,
  );
  validationPayload.domain = parseEIP712Msg(
    JSON.parse(JSON.stringify(data.domain)),
    'EIP712Domain',
    JSON.parse(JSON.stringify(data.types)),
    true,
  );
  // Store the validation payload separately without modifying input.payload
  req.validationPayload = validationPayload;

  data.domain = parseEIP712Msg(data.domain, 'EIP712Domain', data.types, false);
  data.message = parseEIP712Msg(
    data.message,
    data.primaryType,
    data.types,
    false,
  );
  // Now build the message to be sent to the Lattice
  const payload = Buffer.from(cbor.encode(data));
  const fwConst = input.fwConstants;
  const maxSzAllowed =
    ethMaxMsgSz + fwConst.extraDataMaxFrames * fwConst.extraDataFrameSz;
  // Determine if we need to prehash
  let shouldPrehash = payload.length > maxSzAllowed;
  Object.keys(data.types).forEach((k) => {
    if (data.types[k].length > eip712MaxTypeParams) {
      shouldPrehash = true;
    }
  });
  if (fwConst.ethMsgPreHashAllowed && shouldPrehash) {
    // If this payload is too large to send, but the Lattice allows a prehashed message, do that
    req.payload.writeUInt16LE(payload.length, off);
    off += 2;
    const prehash = TypedDataUtils.eip712Hash(
      req.validationPayload,
      SignTypedDataVersion.V4,
    );
    const prehashBuf = Buffer.from(prehash);
    prehashBuf.copy(req.payload, off);
    req.prehash = prehash;
  } else {
    const extraDataPayloads = getExtraData(payload, input);
    req.extraDataPayloads = extraDataPayloads;
    req.payload.writeUInt16LE(payload.length, off);
    off += 2;
    payload.copy(req.payload, off);
    off += payload.length;
    // Slice out the part of the buffer that we didn't use.
    req.payload = req.payload.slice(0, off);
  }
  return req;
}

function getExtraData(payload, input) {
  const { ethMaxMsgSz, extraDataFrameSz, extraDataMaxFrames } =
    input.fwConstants;
  const MAX_BASE_MSG_SZ = ethMaxMsgSz;
  const EXTRA_DATA_ALLOWED = extraDataFrameSz > 0 && extraDataMaxFrames > 0;
  const extraDataPayloads = [];
  if (payload.length > MAX_BASE_MSG_SZ) {
    // Determine sizes and run through sanity checks
    const maxSzAllowed =
      MAX_BASE_MSG_SZ + extraDataMaxFrames * extraDataFrameSz;
    if (!EXTRA_DATA_ALLOWED)
      throw new Error(
        `Your message is ${payload.length} bytes, but can only be a maximum of ${MAX_BASE_MSG_SZ}`,
      );
    else if (EXTRA_DATA_ALLOWED && payload.length > maxSzAllowed)
      throw new Error(
        `Your message is ${payload.length} bytes, but can only be a maximum of ${maxSzAllowed}`,
      );
    // Split overflow data into extraData frames
    const frames = splitFrames(
      payload.slice(MAX_BASE_MSG_SZ),
      extraDataFrameSz,
    );
    frames.forEach((frame) => {
      const szLE = Buffer.alloc(4);
      szLE.writeUInt32LE(frame.length, 0);
      extraDataPayloads.push(Buffer.concat([szLE, frame]));
    });
  }
  return extraDataPayloads;
}

function parseEIP712Msg(msg, typeName, types, forJSParser = false) {
  const type = types[typeName];
  type.forEach((item) => {
    const isArrayType = item.type.indexOf('[') > -1;
    const singularType = isArrayType
      ? item.type.slice(0, item.type.indexOf('['))
      : item.type;
    const isCustomType = Object.keys(types).indexOf(singularType) > -1;
    if (isCustomType && Array.isArray(msg)) {
      // For custom types we need to jump into the `msg` using the key (name of type) and
      // parse that entire sub-struct as if it were a message.
      // We will recurse into sub-structs until we reach a level where every item is an
      // elementary (i.e. non-custom) type.
      // For arrays, we need to loop through each message item.
      for (let i = 0; i < msg.length; i++) {
        msg[i][item.name] = parseEIP712Msg(
          msg[i][item.name],
          singularType,
          types,
          forJSParser,
        );
      }
    } else if (isCustomType) {
      // Not an array means we can jump directly into the sub-struct to convert
      msg[item.name] = parseEIP712Msg(
        msg[item.name],
        singularType,
        types,
        forJSParser,
      );
    } else if (Array.isArray(msg)) {
      // If we have an array for this particular type and the type we are parsing
      // is *not* a custom type, loop through the array elements and convert the types.
      for (let i = 0; i < msg.length; i++) {
        if (isArrayType) {
          // If this type is itself an array, loop through those elements and parse individually.
          // This code is not reachable for custom types so we assume these are arrays of
          // elementary types.
          for (let j = 0; j < msg[i][item.name].length; j++) {
            msg[i][item.name][j] = parseEIP712Item(
              msg[i][item.name][j],
              singularType,
              forJSParser,
            );
          }
        } else {
          // Non-arrays parse + replace one value for the elementary type
          msg[i][item.name] = parseEIP712Item(
            msg[i][item.name],
            singularType,
            forJSParser,
          );
        }
      }
    } else if (isArrayType) {
      // If we have an elementary array type and a non-array message level,
      //loop through the array and parse + replace  each item individually.
      for (let i = 0; i < msg[item.name].length; i++) {
        msg[item.name][i] = parseEIP712Item(
          msg[item.name][i],
          singularType,
          forJSParser,
        );
      }
    } else {
      // If this is a singular elementary type, simply parse + replace.
      msg[item.name] = parseEIP712Item(
        msg[item.name],
        singularType,
        forJSParser,
      );
    }
  });

  return msg;
}

function parseEIP712Item(data, type, forJSParser = false) {
  if (type === 'bytes') {
    // Variable sized bytes need to be buffer type
    data = ensureHexBuffer(data);
    if (forJSParser) {
      // For EIP712 encoding module it's easier to encode hex strings
      data = `0x${data.toString('hex')}`;
    }
  } else if (type.slice(0, 5) === 'bytes') {
    // Fixed sizes bytes need to be buffer type. We also add some sanity checks.
    const nBytes = parseInt(type.slice(5));
    data = ensureHexBuffer(data);
    // Edge case to handle empty bytesN values
    if (data.length === 0) {
      data = Buffer.alloc(nBytes);
    }
    if (data.length !== nBytes)
      throw new Error(`Expected ${type} type, but got ${data.length} bytes`);
    if (forJSParser) {
      // For EIP712 encoding module it's easier to encode hex strings
      data = `0x${data.toString('hex')}`;
    }
  } else if (type === 'address') {
    // Address must be a 20 byte buffer
    data = ensureHexBuffer(data);
    // Edge case to handle the 0-address
    if (data.length === 0) {
      data = Buffer.alloc(20);
    }
    if (data.length !== 20)
      throw new Error(
        `Address type must be 20 bytes, but got ${data.length} bytes`,
      );
    // For EIP712 encoding module it's easier to encode hex strings
    if (forJSParser) {
      data = `0x${data.toString('hex')}`;
    }
  } else if (
    ethMsgProtocol.TYPED_DATA.typeCodes[type] &&
    type.indexOf('uint') === -1 &&
    type.indexOf('int') > -1
  ) {
    // Handle signed integers using bignumber.js directly
    if (forJSParser) {
      // For EIP712 encoding in this module we need hex strings for signed ints too
      const bn = new BN(data);
      // Preserve full precision by returning the decimal string representation
      data = bn.toFixed();
    } else {
      // `bignumber.js` is needed for `cbor` encoding, which gets sent to the Lattice and plays
      // nicely with its firmware cbor lib.
      // NOTE: If we instantiate a `bignumber.js` object, it will not match what `borc` creates
      // when run inside of the browser (i.e. MetaMask). Thus we introduce this hack to make sure
      // we are creating a compatible type.
      // TODO: Find another cbor lib that is compataible with the firmware's lib in a browser
      // context. This is surprisingly difficult - I tried several libs and only cbor/borc have
      // worked (borc is a supposedly "browser compatible" version of cbor)
      data = new BN(data);
    }
  } else if (
    ethMsgProtocol.TYPED_DATA.typeCodes[type] &&
    (type.indexOf('uint') > -1 || type.indexOf('int') > -1)
  ) {
    // For uints, convert to a buffer and do some sanity checking.
    // Note that we could probably just use bignumber.js directly as we do with
    // signed ints, but this code is battle tested and we don't want to change it.
    let b = ensureHexBuffer(data);
    // Edge case to handle 0-value bignums
    if (b.length === 0) {
      b = Buffer.from('00', 'hex');
    }
    // Uint256s should be encoded as bignums.
    if (forJSParser) {
      // For EIP712 encoding in this module we need hex strings to represent the numbers
      data = `0x${b.toString('hex')}`;
    } else {
      // Load into bignumber.js used by cbor lib
      data = new BN(b.toString('hex'), 16);
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

function get_rlp_encoded_preimage(rawTx, txType) {
  if (txType) {
    return Buffer.concat([
      Buffer.from([txType]),
      Buffer.from(RLP.encode(rawTx)),
    ]);
  } else {
    return Buffer.from(RLP.encode(rawTx));
  }
}

/**
 * Normalizes a flexible transaction input object into a `viem`-compatible
 * `TransactionSerializable` object. It uses a comprehensive `zod` schema
 * to validate, parse, and transform various input formats into a consistent,
 * secure, and well-typed structure. This function serves as the single entry
 * point for handling all EVM transaction types.
 *
 * @param tx - A flexible transaction object. Can be a legacy, EIP-1559,
 * EIP-2930, or EIP-7702 transaction with fields in various formats (e.g.,
 * hex strings, numbers, bigints).
 * @returns A `viem`-compatible `TransactionSerializable` object.
 */
export const normalizeToViemTransaction = (
  tx: unknown,
): TransactionSerializable => {
  const parsed = TransactionSchema.parse(tx);

  return {
    ...parsed,
    to: parsed.to as Hex,
    data: parsed.data as Hex,
    gas: parsed.gas,
    value: parsed.value,
    nonce: parsed.nonce,
    chainId: parsed.chainId,
    gasPrice: 'gasPrice' in parsed ? parsed.gasPrice : undefined,
    maxFeePerGas: 'maxFeePerGas' in parsed ? parsed.maxFeePerGas : undefined,
    maxPriorityFeePerGas:
      'maxPriorityFeePerGas' in parsed
        ? parsed.maxPriorityFeePerGas
        : undefined,
    accessList: 'accessList' in parsed ? parsed.accessList : undefined,
    authorizationList:
      'authorizationList' in parsed ? parsed.authorizationList : undefined,
  };
};

/**
 * Convert Ethereum transaction to serialized bytes for generic signing.
 * Bridge function for firmware v0.15.0+ which removed legacy ETH signing paths.
 */
const convertEthereumTransactionToGenericRequest = function (
  req: FlexibleTransaction,
) {
  // Use the unified normalization and serialization pipeline.
  // 1. Normalize the potentially varied input to a standard viem format.
  const viemTx = normalizeToViemTransaction(req);
  // 2. Serialize the transaction to RLP-encoded bytes.
  const serializedTx = serializeTransaction(viemTx);
  return Buffer.from(serializedTx.slice(2), 'hex');
};

// Type for Ethereum generic signing request
type EthereumGenericSigningRequestParams = FlexibleTransaction & {
  fwConstants: FirmwareConstants;
  signerPath: SigningPath;
};

/**
 * Build complete generic signing request for Ethereum transactions.
 * One-step function combining transaction conversion and generic signing setup.
 */
export const buildEthereumGenericSigningRequest = function (
  req: EthereumGenericSigningRequestParams,
) {
  const { fwConstants, signerPath, ...txData } = req;

  const payload = convertEthereumTransactionToGenericRequest(txData);

  return buildGenericSigningMsgRequest({
    fwConstants,
    encodingType: EXTERNAL.SIGNING.ENCODINGS.EVM,
    curveType: EXTERNAL.SIGNING.CURVES.SECP256K1,
    hashType: EXTERNAL.SIGNING.HASHES.KECCAK256,
    signerPath,
    payload,
  });
};

/**
 * Serializes an EIP7702 transaction using Viem.
 *
 * @param tx The EIP7702 transaction to serialize
 * @returns The serialized transaction as a hex string
 */
export function serializeEIP7702Transaction(tx: TransactionRequest): Hex {
  if (
    tx.type !== TRANSACTION_TYPE.EIP7702_AUTH_LIST &&
    tx.type !== TRANSACTION_TYPE.EIP7702_AUTH
  ) {
    throw new Error(
      `Only EIP-7702 auth transactions (type ${TRANSACTION_TYPE.EIP7702_AUTH}) and auth-list transactions (type ${TRANSACTION_TYPE.EIP7702_AUTH_LIST}) are supported`,
    );
  }

  // Type guard to ensure we have an EIP7702 transaction with appropriate authorization data
  const hasAuthList = 'authorizationList' in tx;
  const hasSingleAuth = 'authorization' in tx;

  if (!hasAuthList && !hasSingleAuth) {
    throw new Error(
      'Transaction does not have authorization or authorizationList property',
    );
  }

  // For type 4 transactions, convert single authorization to array format
  let authorizationList: any[];
  if (tx.type === TRANSACTION_TYPE.EIP7702_AUTH) {
    if (!hasSingleAuth) {
      throw new Error(
        'EIP-7702 auth transaction (type 4) must contain authorization property',
      );
    }
    authorizationList = [(tx as any).authorization];
  } else {
    // Type 5 transaction - only handle authorizationList field
    if (hasAuthList) {
      authorizationList = (tx as any).authorizationList;
    } else {
      throw new Error(
        'EIP-7702 auth list transaction (type 5) must contain authorizationList property',
      );
    }
  }

  // Validate that all required fields exist
  if (
    !authorizationList ||
    !Array.isArray(authorizationList) ||
    authorizationList.length === 0
  ) {
    throw new Error(
      'EIP-7702 transaction must contain at least one authorization',
    );
  }

  // Validate each authorization
  authorizationList.forEach((auth, index) => {
    if (!auth.address) {
      throw new Error(
        `Authorization at index ${index} is missing a contract address`,
      );
    }
  });

  // Validate required transaction fields
  if (!tx.to) {
    throw new Error('EIP-7702 transaction must include a valid "to" address');
  }

  // Convert to Viem's expected format
  const viemTx = {
    type: 'eip7702' as const,
    chainId: tx.chainId,
    nonce: tx.nonce,
    maxPriorityFeePerGas:
      typeof tx.maxPriorityFeePerGas === 'string'
        ? BigInt(tx.maxPriorityFeePerGas)
        : tx.maxPriorityFeePerGas,
    maxFeePerGas:
      typeof tx.maxFeePerGas === 'string'
        ? BigInt(tx.maxFeePerGas)
        : tx.maxFeePerGas,
    gas:
      typeof (tx as any).gas === 'string'
        ? BigInt((tx as any).gas)
        : (tx as any).gas ||
          (typeof (tx as any).gasLimit === 'string'
            ? BigInt((tx as any).gasLimit)
            : (tx as any).gasLimit),
    to: tx.to as `0x${string}`,
    value: typeof tx.value === 'string' ? BigInt(tx.value) : tx.value,
    data: tx.data || '0x',
    authorizationList: authorizationList.map((auth, idx) => {
      // Create the Viem-formatted authorization
      // Ensure proper address handling with 0x prefix
      const address = auth.address || '';
      const addressStr =
        typeof address === 'string'
          ? address.startsWith('0x')
            ? address
            : `0x${address}`
          : `0x`;

      if (!addressStr || addressStr === '0x') {
        throw new Error(
          `Authorization at index ${idx} is missing a valid address`,
        );
      }

      // Handle viem's SignedAuthorization format
      if ('signature' in auth && auth.signature) {
        // Viem format with nested signature
        return {
          chainId: auth.chainId,
          address: addressStr as `0x${string}`,
          nonce: BigInt(auth.nonce || 0),
          signature: auth.signature,
        };
      } else {
        // Direct signature properties (r, s, yParity/v)
        return {
          chainId: auth.chainId,
          address: addressStr as `0x${string}`,
          nonce: BigInt(auth.nonce || 0),
          signature: {
            yParity:
              typeof auth.yParity === 'number'
                ? auth.yParity
                : typeof auth.yParity === 'string'
                  ? auth.yParity === '0x01' ||
                    auth.yParity === '0x1' ||
                    auth.yParity === '1'
                    ? 1
                    : 0
                  : 0,
            r: auth.r || '0x0',
            s: auth.s || '0x0',
          },
        };
      }
    }),
  };

  return serializeTransaction(viemTx as any);
}

export const isEip7702Transaction = (tx: TransactionRequest): boolean => {
  return (
    typeof tx === 'object' &&
    'type' in tx &&
    (tx.type === TRANSACTION_TYPE.EIP7702_AUTH_LIST ||
      tx.type === TRANSACTION_TYPE.EIP7702_AUTH)
  );
};

export default {
  buildEthereumMsgRequest,
  validateEthereumMsgResponse,
  buildEthereumTxRequest,
  buildEthRawTx,
  hashTransaction,
  chainIds,
  ensureHexBuffer,
  normalizeToViemTransaction,
  convertEthereumTransactionToGenericRequest,
  buildEthereumGenericSigningRequest,
};
