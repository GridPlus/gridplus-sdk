import bitwise from 'bitwise';
import { Byte, UInt4 } from 'bitwise/types';
import {
  ADDR_STR_LEN,
  decResLengths,
  EXTERNAL,
  getFwVersionConst,
} from '../constants';
import {
  decryptEncryptedLatticeResponseData,
  deserializeResponseMsgPayloadData,
  serializeSecureRequestMsg,
  serializeSecureRequestEncryptedPayloadData,
  LatticeSecureEncryptedRequestType,
  LatticeSecureMsgType,
} from '../protocol';
import { request } from '../shared/functions';
import {
  validateConnectedClient,
  validateIsUInt4,
  validateNAddresses,
  validateStartPath,
} from '../shared/validators';
import { isValidAssetPath, randomBytes } from '../util';

/**
 * `getAddresses` takes a starting path and a number to get the addresses or public keys associated
 * with the active wallet.
 * @category Lattice
 * @returns An array of addresses or public keys.
 */
export async function getAddresses (
  req: GetAddressesRequestFunctionParams
): Promise<Buffer[]> {
  // Validate request params
  validateGetAddressesRequest(req);
  // Build data for this request
  const data = encodeGetAddressesRequest(req);
  // Build the secure request message
  const msgId = randomBytes(4);
  const payloadData = serializeSecureRequestEncryptedPayloadData(
    req.client,
    data,
    LatticeSecureEncryptedRequestType.getAddresses
  );
  const msg = serializeSecureRequestMsg(
    req.client,
    msgId,
    LatticeSecureMsgType.encrypted,
    payloadData
  );
  // Send request to Lattice
  const resp = await request({ 
    url: req.client.url, 
    payload: msg 
  });
  // Deserialize the response payload data
  const encRespPayloadData = deserializeResponseMsgPayloadData(
    req.client,
    msgId,
    resp
  );
  // Decrypt and return data
  const decRespPayloadData = decryptEncryptedLatticeResponseData(
    req.client, 
    encRespPayloadData
  );
  return decodeGetAddresses(decRespPayloadData, req.flag)
}

export const validateGetAddressesRequest = (
  req: GetAddressesRequestFunctionParams
) => {
  validateStartPath(req.startPath);
  validateNAddresses(req.n);
  validateIsUInt4(req.flag);
  validateConnectedClient(req.client);
};

export const encodeGetAddressesRequest = (
  req: GetAddressesRequestFunctionParams
) => {
  const fwConstants = getFwVersionConst(req.client.getFwVersion());
  const flags = fwConstants.getAddressFlags || [] as any[];
  const isPubkeyOnly =
    flags.indexOf(req.flag) > -1 &&
    (
      req.flag === EXTERNAL.GET_ADDR_FLAGS.ED25519_PUB ||
      req.flag === EXTERNAL.GET_ADDR_FLAGS.SECP256K1_PUB ||
      req.flag === EXTERNAL.GET_ADDR_FLAGS.BLS12_381_G1_PUB
    );
  if (!isPubkeyOnly && !isValidAssetPath(req.startPath, fwConstants)) {
    throw new Error(
      'Derivation path or flag is not supported. Try updating Lattice firmware.'
    );
  }
  let sz = 32 + 20 + 1; // walletUID + 5 u32 indices + count/flag
  if (fwConstants.varAddrPathSzAllowed) {
    sz += 1; // pathDepth
  } else if (req.startPath.length !== 5) {
    throw new Error(
      'Your Lattice firmware only supports derivation paths with 5 indices. Please upgrade.',
    );
  }
  const payload = Buffer.alloc(sz);
  let off = 0;

  req.client.getActiveWallet().uid.copy(payload, off);
  off += 32;
  // Build the start path (5x u32 indices)
  if (fwConstants.varAddrPathSzAllowed) {
    payload.writeUInt8(req.startPath.length, off);
    off += 1;
  }
  for (let i = 0; i < 5; i++) {
    if (i <= req.startPath.length) {
      const val = req.startPath[i] ?? 0;
      payload.writeUInt32BE(val, off);
    }
    off += 4;
  }
  // Specify the number of subsequent addresses to request. We also allow the user to skip the
  // cache and request any address related to the asset in the wallet.
  let val,
    flagVal: UInt4 = 0;
  if (fwConstants.addrFlagsAllowed) {
    // A 4-bit flag can be used for non-standard address requests Client needs to be combined with
    // `n` as a 4 bit value
    flagVal =
      fwConstants.getAddressFlags &&
        fwConstants.getAddressFlags.indexOf(req.flag) > -1
        ? (req.flag as UInt4)
        : 0;
    const flagBits = bitwise.nibble.read(flagVal);
    const countBits = bitwise.nibble.read(req.n as UInt4);
    val = bitwise.byte.write(flagBits.concat(countBits) as Byte);
  } else {
    // Very old firmware does not support client flag. We can deprecate client soon.
    val = req.n;
  }
  payload.writeUInt8(val, off);
  off++;
  return payload;
};

/**
 * @internal
 * @return an array of address strings or pubkey buffers
 */
export const decodeGetAddresses = (data: any, flag: number): Buffer[] => {
  let off = 65; // Skip 65 byte pubkey prefix
  // Look for addresses until we reach the end (a 4 byte checksum)
  const addrs: any[] = [];
  // Pubkeys are formatted differently in the response
  const { ED25519_PUB, SECP256K1_PUB, BLS12_381_G1_PUB } = EXTERNAL.GET_ADDR_FLAGS;
  const arePubkeys = flag === ED25519_PUB || flag === SECP256K1_PUB || flag === BLS12_381_G1_PUB;
  if (arePubkeys) {
    off += 1; // skip uint8 representing pubkey type
  }
  while (off + 4 < decResLengths.getAddresses) {
    if (arePubkeys) {
      // Pubkeys are shorter and are returned as buffers
      const pubBytes = data.slice(off, off + 65);
      const isEmpty = pubBytes.every((byte: number) => byte === 0x00);
      if (!isEmpty && flag === ED25519_PUB) {
        // ED25519 pubkeys are 32 bytes
        addrs.push(pubBytes.slice(0, 32));
      } else if (!isEmpty && flag === BLS12_381_G1_PUB) {
        // BLS12_381_G1 keys are 48 bytes
        addrs.push(pubBytes.slice(0, 48));
      } else if (!isEmpty) {
        // Only other returned pubkeys are ECC, or 65 bytes Note that we return full
        // (uncompressed) ECC pubkeys
        addrs.push(pubBytes);
      }
      off += 65;
    } else {
      // Otherwise we are dealing with address strings
      const addrBytes = data.slice(off, off + ADDR_STR_LEN);
      off += ADDR_STR_LEN;
      // Return the UTF-8 representation
      const len = addrBytes.indexOf(0); // First 0 is the null terminator
      if (len > 0) {
        addrs.push(addrBytes.slice(0, len).toString());
      }
    }
  }

  return addrs;
};