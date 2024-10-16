import { HARDENED_OFFSET } from '../constants';
import { KeyPair, ActiveWallets, FirmwareVersion } from '../types';

/**
 * Get 64 bytes representing the public key This is the uncompressed key without the leading 04
 * byte
 * @param KeyPair - //TODO Describe the keypair
 * @param LE - Whether to return the public key in little endian format.
 * @returns A Buffer containing the public key.
 */
export const getPubKeyBytes = (key: KeyPair, LE = false) => {
  const k = key.getPublic();
  const p = k.encode('hex', true);
  const pb = Buffer.from(p, 'hex');
  if (LE === true) {
    // Need to flip X and Y components to little endian
    const x = pb.slice(1, 33).reverse();
    const y = pb.slice(33, 65).reverse();
    // @ts-expect-error - TODO: Find out why Buffer won't accept pb[0]
    return Buffer.concat([pb[0], x, y]);
  } else {
    return pb;
  }
};

/**
 * Get the shared secret, derived via ECDH from the local private key and the ephemeral public key
 * @internal
 * @returns Buffer
 */
export const getSharedSecret = (key: KeyPair, ephemeralPub: KeyPair) => {
  // Once every ~256 attempts, we will get a key that starts with a `00` byte, which can lead to
  // problems initializing AES if we don't force a 32 byte BE buffer.
  return Buffer.from(key.derive(ephemeralPub.getPublic()).toArray('be', 32));
};

// Given a set of wallet data, which contains two wallet descriptors, parse the data and save it
// to memory
export const parseWallets = (walletData): ActiveWallets => {
  // Read the external wallet data first. If it is non-null, the external wallet will be the
  // active wallet of the device and we should save it. If the external wallet is blank, it means
  // there is no card present and we should save and use the interal wallet. If both wallets are
  // empty, it means the device still needs to be set up.
  const walletDescriptorLen = 71;
  // Internal first
  let off = 0;
  const activeWallets: ActiveWallets = {
    internal: {
      uid: undefined,
      capabilities: undefined,
      name: undefined,
      external: false,
    },
    external: {
      uid: undefined,
      capabilities: undefined,
      name: undefined,
      external: true,
    },
  };
  activeWallets.internal.uid = walletData.slice(off, off + 32);
  // NOTE: `capabilities` and `name` were deprecated in Lattice firmware.
  // They never provided any real information, but have been archived here
  // since the response size has been preserved and we may bring them back
  // in a different form.
  // activeWallets.internal.capabilities = walletData.readUInt32BE(off + 32);
  // activeWallets.internal.name = walletData.slice(
  // off + 36,
  // off + walletDescriptorLen,
  // );
  // Offset the first item
  off += walletDescriptorLen;
  // External
  activeWallets.external.uid = walletData.slice(off, off + 32);
  // activeWallets.external.capabilities = walletData.readUInt32BE(off + 32);
  // activeWallets.external.name = walletData.slice(
  // off + 36,
  // off + walletDescriptorLen,
  // );
  return activeWallets;
};

// Determine if a provided firmware version matches or exceeds the current firmware version
export const isFWSupported = (
  fwVersion: FirmwareVersion,
  versionSupported: FirmwareVersion,
): boolean => {
  const { major, minor, fix } = fwVersion;
  const { major: _major, minor: _minor, fix: _fix } = versionSupported;
  return (
    major > _major ||
    (major >= _major && minor > _minor) ||
    (major >= _major && minor >= _minor && fix >= _fix)
  );
};

/**
 * Convert a set of BIP39 path indices to a string
 * @param path - Set of indices
 */
export const getPathStr = function (path) {
  let pathStr = 'm';
  path.forEach((idx) => {
    if (idx >= HARDENED_OFFSET) {
      pathStr += `/${idx - HARDENED_OFFSET}'`;
    } else {
      pathStr += `/${idx}`;
    }
  });
  return pathStr;
};
