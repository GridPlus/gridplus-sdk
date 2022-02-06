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
import { signingSchema } from './constants'
import { buildSignerPathBuf, ensureHexBuffer, fixLen, splitFrames, parseDER } from './util'

export const buildGenericSigningMsgRequest = function(req) {
  const { signerPath, curveType, hashType, payload, omitPubkey=false, fwConstants } = req;
  const {
    extraDataFrameSz,
    extraDataMaxFrames,
    prehashAllowed,
    genericSigning,
    varAddrPathSzAllowed,
  } = fwConstants;
  const { curveTypes, encodingTypes, hashTypes, maxMsgSz } = genericSigning;
  try {
    const curveIdx = curveTypes.indexOf(curveType.toUpperCase());
    const hashIdx = hashTypes.indexOf(hashType.toUpperCase());

    // If the buffer passed in is a string and is not prefixed with 0x, treat as utf8.
    // Otherwise treat it as a hex buffer.
    const isHex = Buffer.isBuffer(payload) || (typeof payload === 'string' && payload.slice(0, 2) === '0x');
    const payloadBuf = isHex ? ensureHexBuffer(payload) : Buffer.from(payload, 'utf8');
    const encodingType = isHex ? encodingTypes.indexOf('HEX') : encodingTypes.indexOf('UTF8');
    // Sanity checks
    if (payloadBuf.length === 0) {
      throw new Error('Payload could not be handled.')
    } else if (!genericSigning || !extraDataFrameSz || !extraDataMaxFrames || !prehashAllowed) {
      throw new Error('Unsupported. Please update your Lattice firmware.');
    } else if (curveIdx < 0) {
      throw new Error(`Unsupported curve type. Allowed types: ${JSON.stringify(curveTypes)}`);
    } else if (hashIdx < 0) {
      throw new Error(`Unsupported hash type. Allowed types: ${JSON.stringify(hashTypes)}`);
    } else if (payloadBuf.length > maxMsgSz) {
      throw new Error(`Data too large. Must be <${maxMsgSz} bytes (got ${payloadBuf.length})`);
    }
    const maxExpandedSz = maxMsgSz + (extraDataMaxFrames * extraDataFrameSz);
    if (payloadBuf.length > maxExpandedSz) {
      throw new Error(
        `Payload field too large (got ${payloadBuf.length}; must be <=${maxExpandedSz} bytes)`
      );
    }
    const buf = Buffer.alloc(maxMsgSz);
    let off = 0;
    buf.writeUint32LE(encodingType);
    off += 4;
    buf.writeUint8(hashIdx, off);
    off += 1;
    buf.writeUint8(curveIdx, off);
    off += 1;
    const signerPathBuf = buildSignerPathBuf(signerPath, varAddrPathSzAllowed);
    signerPathBuf.copy(buf, off);
    off += signerPathBuf.length;
    buf.writeUint8(omitPubkey ? 1 : 0, off);
    off += 1;
    buf.writeUint16LE(payloadBuf.length, off);
    off += 2;
    // Copy the first `maxMsgSz` bytes into the buffer. If there is more data, we will
    // add it to extraFrames for use in follow up requests.
    payloadBuf.copy(buf.slice(0, maxMsgSz - off), off);

     // Flow data into extraData requests if applicable
    const extraDataPayloads = [];
    // let prehash = null;
    if (payloadBuf.length > maxMsgSz) {
      if (prehashAllowed && totalSz > maxExpandedSz) {
        // If this payload is too large to send, but the Lattice allows a prehashed message, do that
        // prehash = Buffer.from(
        //   keccak256(get_rlp_encoded_preimage(rawTx, type)),
        //   'hex'
        // );
        throw new Error('todo')
      } else {
        // Split overflow data into extraData frames
        const frames = splitFrames(
          payloadBuf.slice(maxMsgSz - off),
          extraDataFrameSz
        );
        frames.forEach((frame) => {
          const szLE = Buffer.alloc(4);
          szLE.writeUInt32LE(frame.length, 0);
          extraDataPayloads.push(Buffer.concat([szLE, frame]));
        });
      }
    } 

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
  // Pubkey data in C struct is 65 bytes
  const pubkeyFullSz = 65;
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
        parsed.pubkey.writeUint8(compression, 0);
        res.slice(off, off + 32).copy(parsed.pubkey, 1);
      } else if (compression === 0x04) {
        // Uncompressed key
        parsed.pubkey = Buffer.alloc(65);
        parsed.pubkey.writeUint8(compression, 0);
        res.slice(off).copy(parsed.pubkey, 1);
      } else {
        throw new Error('Bad compression byte in signing response.')
      }
      off += 64;
    } else {
      // Skip pubkey section
      off += pubkeyFullSz;
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
    off += pubkeyFullSz;
    // Handle `GpEdDSASig_t`
    parsed.sig = res.slice(off, off + 64);
  } else {
    throw new Error('Unsupported curve.')
  }  
  return { data: parsed };
}