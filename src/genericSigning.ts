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
import { Constants } from './index'
import { 
  buildSignerPathBuf, ensureHexBuffer, existsIn, fixLen, 
  isAsciiStr, splitFrames, parseDER
} from './util'

export const buildGenericSigningMsgRequest = function(req) {
  const { 
    signerPath, curveType, hashType, encodingType=null, 
    omitPubkey=false, fwConstants 
  } = req;
  const {
    extraDataFrameSz, extraDataMaxFrames, prehashAllowed,
    genericSigning, varAddrPathSzAllowed,
  } = fwConstants;
  const { 
    curveTypes, encodingTypes, hashTypes, baseDataSz, baseReqSz 
  } = genericSigning;
  try {
    const { encoding, payloadBuf } = getEncodedPayload(req.payload, encodingType, encodingTypes);
    
    // Sanity checks
    if (payloadBuf.length === 0) {
      throw new Error('Payload could not be handled.')
    } else if (!genericSigning || !extraDataFrameSz || !extraDataMaxFrames || !prehashAllowed) {
      throw new Error('Unsupported. Please update your Lattice firmware.');
    } else if (!existsIn(curveType, curveTypes)) {
      throw new Error('Unsupported curve type.');
    } else if (!existsIn(hashType, hashTypes)) {
      throw new Error('Unsupported hash type.');
    }

    // Ed25519 specific sanity checks
    if (curveType === curveTypes.ED25519) {
      if (hashType !== hashTypes.NONE) {
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
    buf.writeUInt32LE(encoding, off);
    off += 4;
    buf.writeUInt8(hashType, off);
    off += 1;
    buf.writeUInt8(curveType, off);
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
        if (hashType === hashTypes.NONE) {
          // This cannot be done for ED25519 signing, which must sign the full message
          throw new Error('Message too large to send and could not be prehashed (hashType=NONE).');
        } else if (hashType === hashTypes.KECCAK256) {
          prehash = Buffer.from(keccak256(payloadBuf), 'hex');
        } else if (hashType === hashTypes.SHA256) {
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
      curveType,
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
  if (curveType === Constants.SIGNING.CURVES.SECP256K1) {
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
  } else if (curveType === Constants.SIGNING.CURVES.ED25519) {
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

export const getEncodedPayload = function(payload, encodingType, allowedEncodings) {
  let encoding = encodingType;
  if (encoding === null) {
    // If no encoding type was passed, we will display the payload as either
    // ASCII or a hex string. Determine which one of the default encodings to use.
    // If the buffer passed in is a string and is not prefixed with 0x, treat as utf8.
    // Otherwise treat it as a hex buffer.
    let isHex = Buffer.isBuffer(payload) || 
                (typeof payload === 'string' && payload.slice(0, 2) === '0x');
    if (!isHex && !isAsciiStr(payload, true)) {
      // If this is not '0x' prefixed but is not valid ASCII, convert to hex payload
      isHex = true;
      payload = `0x${Buffer.from(payload).toString('hex')}`
    }
    // Set encodingType to real value
    encoding =  isHex ? 
                Constants.SIGNING.ENCODINGS.HEX : 
                Constants.SIGNING.ENCODINGS.ASCII;
  }

  // Make sure the encoding type specified is supported by firmware
  if (!existsIn(encoding, allowedEncodings)) {
    throw new Error('Encoding type not supported by Lattice firmware.');
  }

  // Build the request with the specified encoding type
  if (encoding === Constants.SIGNING.ENCODINGS.HEX) {
    return {
      payloadBuf: ensureHexBuffer(payload),
      encoding,
    };
  } else if (encoding === Constants.SIGNING.ENCODINGS.ASCII) {
    return {
      payloadBuf: Buffer.from(payload),
      encoding,
    };
  } else {
    throw new Error('Unhandled encoding type.')
  }
}