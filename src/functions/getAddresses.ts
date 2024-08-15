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
  iterIdx,
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
    iterIdx,
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
  iterIdx,
}: {
  startPath: number[];
  n: number;
  flag: number;
  fwConstants: FirmwareConstants;
  wallet: Wallet;
  iterIdx?: number;
}) => {
  const flags = fwConstants.getAddressFlags || ([] as any[]);
  const isPubkeyOnly =
    flags.indexOf(flag) > -1 &&
    (flag === LatticeGetAddressesFlag.ed25519Pubkey ||
      flag === LatticeGetAddressesFlag.secp256k1Pubkey ||
      flag === LatticeGetAddressesFlag.bls12_381Pubkey);
  if (!isPubkeyOnly && !isValidAssetPath(startPath, fwConstants)) {
    throw new Error(
      'Derivation path or flag is not supported. Try updating Lattice firmware.',
    );
  }

  // Ensure path depth is valid (2-5 indices)
  if (startPath.length < 2 || startPath.length > 5) {
    throw new Error('Derivation path must include 2-5 indices.');
  }

  // Validate iterIdx (0-5)
  if (iterIdx < 0 || iterIdx > 5) {
    throw new Error('Iteration index must be between 0 and 5.');
  }

  // Ensure iterIdx is not greater than path depth
  if (iterIdx > startPath.length) {
    throw new Error('Iteration index cannot be greater than path depth.');
  }

  const sz = 32 + 1 + 20 + 1; // walletUID + pathDepth_IterIdx + 5 u32 indices + count/flag
  const payload = Buffer.alloc(sz);
  let off = 0;

  // walletUID
  wallet.uid.copy(payload, off);
  off += 32;

  // pathDepth_IterIdx
  const pathDepth_IterIdx = ((iterIdx & 0x0f) << 4) | (startPath.length & 0x0f);
  payload.writeUInt8(pathDepth_IterIdx, off);
  off += 1;

  // Build the start path (5x u32 indices)
  for (let i = 0; i < 5; i++) {
    const val = i < startPath.length ? startPath[i] : 0;
    payload.writeUInt32BE(val, off);
    off += 4;
  }

  // Combine count and flag into a single byte
  const countVal = n & 0x0f;
  const flagVal = (flag & 0x0f) << 4;
  payload.writeUInt8(countVal | flagVal, off);

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
