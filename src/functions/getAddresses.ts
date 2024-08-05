import bitwise from 'bitwise';
import { Byte, UInt4 } from 'bitwise/types';
import {
  LatticeGetAddressesFlag,
  LatticeSecureEncryptedRequestType,
  ProtocolConstants,
  encryptedSecureRequest,
} from '../protocol';
import {
  validateConnectedClient,
  validateIsUInt4,
  validateNAddresses,
  validateStartPath,
  validateWallet,
} from '../shared/validators';
import { isValidAssetPath } from '../util';

/**
 * `getAddresses` takes a starting path and a number to get the addresses or public keys associated
 * with the active wallet.
 * @category Lattice
 * @returns An array of addresses or public keys.
 */
export async function getAddresses({
  client,
  startPath: _startPath,
  n: _n,
  flag: _flag,
}: GetAddressesRequestFunctionParams): Promise<Buffer[]> {
  const { url, sharedSecret, ephemeralPub, fwConstants } =
    validateConnectedClient(client);
  const activeWallet = validateWallet(client.getActiveWallet());

  const { startPath, n, flag } = validateGetAddressesRequest({
    startPath: _startPath,
    n: _n,
    flag: _flag,
  });

  const data = encodeGetAddressesRequest({
    startPath,
    n,
    flag,
    fwConstants,
    wallet: activeWallet,
  });

  const { decryptedData, newEphemeralPub } = await encryptedSecureRequest({
    data,
    requestType: LatticeSecureEncryptedRequestType.getAddresses,
    sharedSecret,
    ephemeralPub,
    url,
  });

  client.mutate({
    ephemeralPub: newEphemeralPub,
  });

  return decodeGetAddressesResponse(decryptedData, flag);
}

export const validateGetAddressesRequest = ({
  startPath,
  n,
  flag,
}: {
  startPath?: number[];
  n?: number;
  flag?: number;
}) => {
  return {
    startPath: validateStartPath(startPath),
    n: validateNAddresses(n),
    flag: validateIsUInt4(flag),
  };
};

export const encodeGetAddressesRequest = ({
  startPath,
  n,
  flag,
  fwConstants,
  wallet,
}: {
  startPath: number[];
  n: number;
  flag: number;
  fwConstants: FirmwareConstants;
  wallet: Wallet;
}) => {
  // const flags = fwConstants.getAddressFlags || ([] as any[]);
  // const isPubkeyOnly =
  //   flags.indexOf(flag) > -1 &&
  //   (flag === LatticeGetAddressesFlag.ed25519Pubkey ||
  //     flag === LatticeGetAddressesFlag.secp256k1Pubkey ||
  //     flag === LatticeGetAddressesFlag.bls12_381Pubkey);
  // if (!isPubkeyOnly && !isValidAssetPath(startPath, fwConstants)) {
  //   throw new Error(
  //     'Derivation path or flag is not supported. Try updating Lattice firmware.',
  //   );
  // }
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

/**
 * @internal
 * @return an array of address strings or pubkey buffers
 */
export const decodeGetAddressesResponse = (
  data: Buffer,
  flag: number,
): Buffer[] => {
  let off = 0;
  // Look for addresses until we reach the end (a 4 byte checksum)
  const addrs: any[] = [];
  // Pubkeys are formatted differently in the response
  const arePubkeys =
    flag === LatticeGetAddressesFlag.secp256k1Pubkey ||
    flag === LatticeGetAddressesFlag.ed25519Pubkey ||
    flag === LatticeGetAddressesFlag.bls12_381Pubkey;
  if (arePubkeys) {
    off += 1; // skip uint8 representing pubkey type
  }
  const respDataLength =
    ProtocolConstants.msgSizes.secure.data.response.encrypted[
      LatticeSecureEncryptedRequestType.getAddresses
    ];
  while (off < respDataLength) {
    if (arePubkeys) {
      // Pubkeys are shorter and are returned as buffers
      const pubBytes = data.slice(off, off + 65);
      const isEmpty = pubBytes.every((byte: number) => byte === 0x00);
      if (!isEmpty && flag === LatticeGetAddressesFlag.ed25519Pubkey) {
        // ED25519 pubkeys are 32 bytes
        addrs.push(pubBytes.slice(0, 32));
      } else if (!isEmpty && flag === LatticeGetAddressesFlag.bls12_381Pubkey) {
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
      const addrBytes = data.slice(off, off + ProtocolConstants.addrStrLen);
      off += ProtocolConstants.addrStrLen;
      // Return the UTF-8 representation
      const len = addrBytes.indexOf(0); // First 0 is the null terminator
      if (len > 0) {
        addrs.push(addrBytes.slice(0, len).toString());
      }
    }
  }

  return addrs;
};
