/**
Generic signing module. Any payload can be sent to the Lattice and
will be displayed in full (note that \n and \t characters will be
displayed as line breaks and tabs on the screen).

This payload should be coupled with:
* Signer's BIP44 path
* Curve on which to derive the signing key
* Hash function to use on the message
*/
import { sha256 } from 'hash.js/lib/hash/sha';
import { keccak256 } from 'js-sha3';
import { HARDENED_OFFSET, signingSchema } from './constants';
import { Constants } from './index';
import {
  buildSignerPathBuf,
  existsIn,
  getV,
  fixLen,
  parseDER,
  splitFrames,
} from './util';

export const buildGenericSigningMsgRequest = function (req) {
  const {
    signerPath,
    curveType,
    hashType,
    encodingType = null,
    decoder = null,
    omitPubkey = false,
    fwConstants,
    blsDst = Constants.SIGNING.BLS_DST.BLS_DST_NUL,
  } = req;
  const {
    extraDataFrameSz,
    extraDataMaxFrames,
    prehashAllowed,
    genericSigning,
    varAddrPathSzAllowed,
  } = fwConstants;
  const {
    curveTypes,
    encodingTypes,
    hashTypes,
    baseDataSz,
    baseReqSz,
    calldataDecoding,
  } = genericSigning;
  const encodedPayload = getEncodedPayload(
    req.payload,
    encodingType,
    encodingTypes,
  );
  const { encoding } = encodedPayload;
  let { payloadBuf } = encodedPayload;
  const origPayloadBuf = payloadBuf;
  let payloadDataSz = payloadBuf.length;
  // Size of data payload that can be included in the first/base request
  const maxExpandedSz = baseDataSz + extraDataMaxFrames * extraDataFrameSz;
  // Sanity checks
  if (!payloadDataSz) {
    throw new Error('Payload could not be handled.');
  } else if (
    !genericSigning ||
    !extraDataFrameSz ||
    !extraDataMaxFrames ||
    !prehashAllowed
  ) {
    throw new Error('Unsupported. Please update your Lattice firmware.');
  } else if (!existsIn(curveType, curveTypes)) {
    throw new Error('Unsupported curve type.');
  } else if (!existsIn(hashType, hashTypes)) {
    throw new Error('Unsupported hash type.');
  }

  // If there is a decoder attached to our payload, add it to
  // the data field of the request.
  const hasDecoder = (decoder && calldataDecoding && decoder.length <= calldataDecoding.maxSz);
  // Make sure the payload AND decoder data fits in the firmware buffer.
  // If it doesn't, we can't include the decoder because the payload will likely
  // be pre-hashed and the decoder data isn't part of the message to sign.
  const decoderFits = (hasDecoder && payloadBuf.length + decoder.length <= maxExpandedSz);
  if (hasDecoder && decoderFits) {
    const decoderBuf = Buffer.alloc(8 + decoder.length);
    // First write th reserved word
    decoderBuf.writeUInt32LE(calldataDecoding.reserved, 0);
    // Then write size, then the data
    decoderBuf.writeUInt32LE(decoder.length, 4);
    Buffer.from(decoder).copy(decoderBuf, 8);
    payloadBuf = Buffer.concat([payloadBuf, decoderBuf]);
  }

  // Ed25519 specific sanity checks
  if (curveType === curveTypes.ED25519) {
    if (hashType !== hashTypes.NONE) {
      throw new Error('Signing on ed25519 requires unhashed message');
    }
    signerPath.forEach((idx) => {
      if (idx < HARDENED_OFFSET) {
        throw new Error(
          'Signing on ed25519 requires all signer path indices be hardened.',
        );
      }
    });
  }
  // BLS12_381 specific processing
  else if (curveType === curveTypes.BLS12_381_G2) {
    // For BLS signing we need to prefix 4 bytes to represent the
    // domain separator (DST). If none is provided, we use the default
    // value of DST_NUL.
    const blsDstBuf = Buffer.alloc(4);
    blsDstBuf.writeUInt32LE(blsDst);
    payloadBuf = Buffer.concat([blsDstBuf, payloadBuf]);
    payloadDataSz += blsDstBuf.length;
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

  // Flow data into extraData requests if applicable
  const extraDataPayloads = [];
  let prehash = null;

  let didPrehash = false;
  if (payloadBuf.length > baseDataSz) {
    if (prehashAllowed && payloadBuf.length > maxExpandedSz) {
      // If we prehash, we need to provide the full payload size
      buf.writeUInt16LE(payloadBuf.length, off);
      off += 2;
      didPrehash = true;
      // If we have to prehash, only hash the actual payload data, i.e. exclude
      // any optional calldata decoder data.
      const payloadData = payloadBuf.slice(0, payloadDataSz);
      // If this payload is too large to send, but the Lattice allows a prehashed message, do that
      if (hashType === hashTypes.NONE) {
        // This cannot be done for ED25519 signing, which must sign the full message
        throw new Error(
          'Message too large to send and could not be prehashed (hashType=NONE).',
        );
      } else if (hashType === hashTypes.KECCAK256) {
        prehash = Buffer.from(keccak256(payloadData), 'hex');
      } else if (hashType === hashTypes.SHA256) {
        prehash = Buffer.from(
          sha256().update(payloadData).digest('hex'),
          'hex',
        );
      } else {
        throw new Error('Unsupported hash type.');
      }
    } else {
      // Split overflow data into extraData frames
      const frames = splitFrames(
        payloadBuf.slice(baseDataSz),
        extraDataFrameSz,
      );
      frames.forEach((frame) => {
        const szLE = Buffer.alloc(4);
        szLE.writeUInt32LE(frame.length, 0);
        extraDataPayloads.push(Buffer.concat([szLE, frame]));
      });
    }
  }

  // If we didn't prehash, we know the full request (including calldata info) fits.
  // Set the payload size to only include message data. This will inform firmware
  // where to slice off calldata info.
  if (!didPrehash) {
    buf.writeUInt16LE(payloadDataSz, off);
    off += 2;
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
    encodingType,
    hashType,
    omitPubkey,
    origPayloadBuf,
  };
};

export const parseGenericSigningResponse = function (res, off, req) {
  const parsed = {
    pubkey: null,
    sig: null,
  };
  // Parse BIP44 path
  // Parse pubkey and then sig
  if (req.curveType === Constants.SIGNING.CURVES.SECP256K1) {
    // Handle `GpEccPubkey256_t`
    if (!req.omitPubkey) {
      const compression = res.readUInt8(off);
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
        throw new Error('Bad compression byte in signing response.');
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
    // If this is an EVM request, we want to add a `v`. Other request
    // types do not require this additional signature param.
    if (req.encodingType === Constants.SIGNING.ENCODINGS.EVM) {
      const vBn = getV(req.origPayloadBuf, parsed);
      // NOTE: For backward-compatibility reasons we are returning
      // a Buffer for `v` here. In the future, we will switch to
      // returning `v` as a BN and `r`,`s` as Buffers (they are hex
      // strings right now).
      parsed.sig.v = vBn.toArrayLike(Buffer);
    }
  } else if (req.curveType === Constants.SIGNING.CURVES.ED25519) {
    if (!req.omitPubkey) {
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
  } else if (req.curveType === Constants.SIGNING.CURVES.BLS12_381_G2) {
    if (!req.omitPubkey) {
      // Handle `GpBLS12_381_G1Pub_t`
      parsed.pubkey = Buffer.alloc(48);
      res.slice(off, off + 48).copy(parsed.pubkey);
    }
    off += 48;
    // Handle `GpBLS12_381_G2Sig_t`
    parsed.sig = Buffer.alloc(96)
    res.slice(off, off + 96).copy(parsed.sig);
  } else {
    throw new Error('Unsupported curve.');
  }
  return parsed;
};

export const getEncodedPayload = function (
  payload,
  encoding,
  allowedEncodings,
) {
  if (!encoding) {
    encoding = Constants.SIGNING.ENCODINGS.NONE;
  }
  // Make sure the encoding type specified is supported by firmware
  if (!existsIn(encoding, allowedEncodings)) {
    throw new Error(
      'Encoding not supported by Lattice firmware. You may want to update.',
    );
  }
  let payloadBuf;
  if (!payload) {
    throw new Error('No payload included');
  }
  if (typeof payload === 'string' && payload.slice(0, 2) === '0x') {
    payloadBuf = Buffer.from(payload.slice(2), 'hex');
  } else {
    payloadBuf = Buffer.from(payload);
  }
  // Build the request with the specified encoding type
  return {
    payloadBuf,
    encoding,
  };
};