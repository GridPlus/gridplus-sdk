/**
Generic signing module. Any payload can be sent to the Lattice and
will be displayed in full (note that \n and \t characters will be
displayed as line breaks and tabs on the screen).

This payload should be coupled with:
* Signer's BIP44 path
* Curve on which to derive the signing key
* Hash function to use on the message
*/
import { Buffer } from 'buffer/';
import { keccak256 } from 'js-sha3';
import { sha256 } from 'hash.js/lib/hash/sha'
import { HARDENED_OFFSET, signingSchema } from './constants'
import { 
  buildSignerPathBuf, ensureHexBuffer, fixLen, isAsciiStr, splitFrames, parseDER 
} from './util'

export const buildGenericSigningMsgRequest = function(req) {
  const { signerPath, curveType, hashType, omitPubkey=false, fwConstants } = req;
  let { payload } = req;
  const {
    extraDataFrameSz,
    extraDataMaxFrames,
    prehashAllowed,
    genericSigning,
    varAddrPathSzAllowed,
  } = fwConstants;
  const { curveTypes, encodingTypes, hashTypes, baseDataSz, baseReqSz } = genericSigning;
  try {
    if (typeof hashType !== 'string' || typeof curveType !== 'string') {
      throw new Error('hashType and curveType must be included as strings.')
    }

    const HASH_T = hashType.toUpperCase();
    const CURVE_T = curveType.toUpperCase();
    const curveIdx = curveTypes.indexOf(CURVE_T);
    const hashIdx = hashTypes.indexOf(HASH_T);

    // If the buffer passed in is a string and is not prefixed with 0x, treat as utf8.
    // Otherwise treat it as a hex buffer.
    // NOTE: Right now we only support hex and ascii encodings, though we may support stricter
    // schemes in the future.
    let isHex = Buffer.isBuffer(payload) || (typeof payload === 'string' && payload.slice(0, 2) === '0x');
    if (!isHex && !isAsciiStr(payload, true)) {
      // If this is not '0x' prefixed but is not valid ASCII, convert to hex payload
      isHex = true;
      payload = `0x${Buffer.from(payload).toString('hex')}`
    }
    const payloadBuf = isHex ? ensureHexBuffer(payload) : Buffer.from(payload, 'utf8');
    const encodingType = isHex ? encodingTypes.indexOf('HEX') : encodingTypes.indexOf('ASCII');
    
    // Sanity checks
    if (payloadBuf.length === 0) {
      throw new Error('Payload could not be handled.')
    } else if (!genericSigning || !extraDataFrameSz || !extraDataMaxFrames || !prehashAllowed) {
      throw new Error('Unsupported. Please update your Lattice firmware.');
    } else if (curveIdx < 0) {
      throw new Error(`Unsupported curve type. Allowed types: ${JSON.stringify(curveTypes)}`);
    } else if (hashIdx < 0) {
      throw new Error(`Unsupported hash type. Allowed types: ${JSON.stringify(hashTypes)}`);
    }

    // Ed25519 specific sanity checks
    if (CURVE_T === 'ED25519') {
      if (HASH_T !== 'NONE') {
        throw new Error('Signing on ed25519 requires unhashed message');
      }
      signerPath.forEach((idx) => {
        if (idx < HARDENED_OFFSET) {
          throw new Error('Signing on ed25519 requires all signer path indices be hardened.')
        }
      })
    }
    
    // Build the request buffer with metadata and then the payload to sign.
    const buf = Buffer.alloc(baseReqSz);
    let off = 0;
    buf.writeUInt32LE(encodingType, off);
    off += 4;
    buf.writeUInt8(hashIdx, off);
    off += 1;
    buf.writeUInt8(curveIdx, off);
    off += 1;
    const signerPathBuf = buildSignerPathBuf(signerPath, varAddrPathSzAllowed);
    signerPathBuf.copy(buf, off);
    off += signerPathBuf.length;
    buf.writeUInt8(omitPubkey ? 1 : 0, off);
    off += 1;
    buf.writeUInt16LE(payloadBuf.length, off);
    off += 2;

    // Size of data payload that can be included in the first/base request
    const maxExpandedSz = baseDataSz + (extraDataMaxFrames * extraDataFrameSz);
    // Flow data into extraData requests if applicable
    const extraDataPayloads = [];
    let prehash = null;

    if (payloadBuf.length > baseDataSz) {
      if (prehashAllowed && payloadBuf.length > maxExpandedSz) {
        // If this payload is too large to send, but the Lattice allows a prehashed message, do that
        if (HASH_T === 'NONE') {
          // This cannot be done for ED25519 signing, which must sign the full message
          throw new Error('Message too large to send and could not be prehashed (hashType=NONE).');
        } else if (HASH_T === 'KECCAK256') {
          prehash = Buffer.from(keccak256(payloadBuf), 'hex');
        } else if (HASH_T === 'SHA256') {
          prehash = Buffer.from(sha256().update(payloadBuf).digest('hex'), 'hex');
        } else {
          throw new Error('Unsupported hash type.')
        }
      } else {
        // Split overflow data into extraData frames
        const frames = splitFrames(
          payloadBuf.slice(baseDataSz),
          extraDataFrameSz
        );
        frames.forEach((frame) => {
          const szLE = Buffer.alloc(4);
          szLE.writeUInt32LE(frame.length, 0);
          extraDataPayloads.push(Buffer.concat([szLE, frame]));
        });
      }
    }
    
    // If the message had to be prehashed, we will only copy the hash data into the request.
    // Otherwise copy as many payload bytes into the request as possible. Follow up data
    // from `frames` will come in follow up requests.
    const toCopy = prehash ? prehash : payloadBuf;
    toCopy.copy(buf, off);

    // Return all the necessary data
    return {
      payload: buf,
      extraDataPayloads,
      schema: signingSchema.GENERAL_SIGNING,
      curveType: CURVE_T,
      omitPubkey
    }
  } catch (err) {
    return { err: err.message };
  }
}

export const parseGenericSigningResponse = function(res, off, curveType, omitPubkey) {
  const parsed = {
    pubkey: null,
    sig: null,
  }
  // Parse BIP44 path
  // Parse pubkey and then sig
  if (curveType === 'SECP256K1') {
    // Handle `GpEccPubkey256_t`
    if (!omitPubkey) {
      const compression = res.readUint8(off);
      off += 1;
      if (compression === 0x02 || compression === 0x03) {
        // Compressed key - only copy x
        parsed.pubkey = Buffer.alloc(33);
        parsed.pubkey.writeUInt8(compression, 0);
        res.slice(off, off + 32).copy(parsed.pubkey, 1);
      } else if (compression === 0x04) {
        // Uncompressed key
        parsed.pubkey = Buffer.alloc(65);
        parsed.pubkey.writeUInt8(compression, 0);
        res.slice(off).copy(parsed.pubkey, 1);
      } else {
        throw new Error('Bad compression byte in signing response.')
      }
      off += 64;
    } else {
      // Skip pubkey section
      off += 65;
    }
    // Handle `GpECDSASig_t`
    parsed.sig = parseDER(res.slice(off, off + 2 + res[off + 1]));
    // Remove any leading zeros in signature components to ensure
    // the result is a 64 byte sig
    parsed.sig.r = fixLen(parsed.sig.r, 32);
    parsed.sig.s = fixLen(parsed.sig.s, 32);
  } else if (curveType === 'ED25519') {
    if (!omitPubkey) {
      // Handle `GpEdDSAPubkey_t`
      parsed.pubkey = Buffer.alloc(32);
      res.slice(off, off + 32).copy(parsed.pubkey);
    }
    off += 32;
    // Handle `GpEdDSASig_t`
    parsed.sig = {
      r: res.slice(off, off + 32),
      s: res.slice(off + 32, off + 64),
    };
  } else {
    throw new Error('Unsupported curve.')
  }  
  return parsed;
}