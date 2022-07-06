import bitwise from 'bitwise';
import { Byte, UInt4 } from 'bitwise/types';
import {
  ADDR_STR_LEN,
  decResLengths,
  EXTERNAL,
  getFwVersionConst,
} from '../constants';
import { decryptResponse, encryptRequest, request } from '../shared/functions';
import {
  validateFwVersion,
  validateIsUInt4,
  validateNAddresses,
  validateSharedSecret,
  validateStartPath,
  validateUrl,
  validateWallet,
} from '../shared/validators';
import { isValidAssetPath } from '../util';

/**
 * `getAddresses` takes a starting path and a number to get the addresses or public keys associated
 * with the active wallet.
 * @category Lattice
 * @returns An array of addresses or public keys.
 */
export async function getAddresses ({
  startPath,
  n,
  flag,
  client,
}: GetAddressesRequestFunctionParams): Promise<Buffer[]> {
  const { url, fwVersion, wallet, sharedSecret } =
    validateGetAddressesRequest({
      startPath,
      n,
      flag,
      url: client.url,
      fwVersion: client.fwVersion,
      wallet: client.getActiveWallet(),
      sharedSecret: client.sharedSecret,
    });

  const payload = encodeGetAddressesRequest({
    startPath,
    n,
    flag,
    fwVersion,
    wallet,
  });

  const encryptedPayload = encryptGetAddressesRequest({
    payload,
    sharedSecret,
  });

  const encryptedResponse = await requestGetAddresses(encryptedPayload, url);

  const { decryptedData, newEphemeralPub } = decryptGetAddressesResponse(
    encryptedResponse,
    sharedSecret,
  );

  client.ephemeralPub = newEphemeralPub;

  const data = decodeGetAddresses(decryptedData, flag);

  return data;
}

export const validateGetAddressesRequest = ({
  startPath,
  n,
  flag,
  url,
  fwVersion,
  wallet,
  sharedSecret,
}: ValidateGetAddressesRequestParams) => {
  validateStartPath(startPath);
  validateNAddresses(n);
  validateIsUInt4(flag);
  const validUrl = validateUrl(url);
  const validFwVersion = validateFwVersion(fwVersion);
  const validWallet = validateWallet(wallet);
  const validSharedSecret = validateSharedSecret(sharedSecret);

  return {
    url: validUrl,
    fwVersion: validFwVersion,
    wallet: validWallet,
    sharedSecret: validSharedSecret,
  };
};

export const encodeGetAddressesRequest = ({
  fwVersion,
  startPath,
  n,
  wallet,
  flag,
}: EncodeGetAddressesRequestParams) => {
  const fwConstants = getFwVersionConst(fwVersion);
  const flags = fwConstants.getAddressFlags || [] as any[];
  const isPubkeyOnly =
    flags.indexOf(flag) > -1 &&
    (flag === EXTERNAL.GET_ADDR_FLAGS.ED25519_PUB ||
      flag === EXTERNAL.GET_ADDR_FLAGS.SECP256K1_PUB);
  if (!isPubkeyOnly && !isValidAssetPath(startPath, fwConstants)) {
    throw new Error('Parent derivation path is not supported');
  }
  let sz = 32 + 20 + 1; // walletUID + 5 u32 indices + count/flag
  if (fwConstants.varAddrPathSzAllowed) {
    sz += 1; // pathDepth
  } else if (startPath.length !== 5) {
    throw new Error(
      'Your Lattice firmware only supports derivation paths with 5 indices. Please upgrade.',
    );
  }
  const payload = Buffer.alloc(sz);
  let off = 0;

  wallet.uid.copy(payload, off);
  off += 32;
  // Build the start path (5x u32 indices)
  if (fwConstants.varAddrPathSzAllowed) {
    payload.writeUInt8(startPath.length, off);
    off += 1;
  }
  for (let i = 0; i < 5; i++) {
    if (i <= startPath.length) {
      const val = startPath[i] ?? 0;
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
        fwConstants.getAddressFlags.indexOf(flag) > -1
        ? (flag as UInt4)
        : 0;
    const flagBits = bitwise.nibble.read(flagVal);
    const countBits = bitwise.nibble.read(n as UInt4);
    val = bitwise.byte.write(flagBits.concat(countBits) as Byte);
  } else {
    // Very old firmware does not support client flag. We can deprecate client soon.
    val = n;
  }
  payload.writeUInt8(val, off);
  off++;
  return payload;
};

export const encryptGetAddressesRequest = ({
  payload,
  sharedSecret,
}: EncrypterParams) => {
  return encryptRequest({
    requestCode: 'GET_ADDRESSES',
    payload,
    sharedSecret,
  });
};

export const requestGetAddresses = async (payload: Buffer, url: string) => {
  return request({ payload, url });
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
  const { ED25519_PUB, SECP256K1_PUB } = EXTERNAL.GET_ADDR_FLAGS;
  const arePubkeys = flag === ED25519_PUB || flag === SECP256K1_PUB;
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

export const decryptGetAddressesResponse = (
  response: Buffer,
  sharedSecret: Buffer,
) => {
  const { decryptedData, newEphemeralPub } = decryptResponse(
    response,
    decResLengths.getAddresses,
    sharedSecret,
  );
  return { decryptedData, newEphemeralPub };
};
