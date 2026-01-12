import bs58check from 'bs58check';
import { SLIP132_VERSION_BYTES, BTC_PURPOSES } from './constants';
import type { BtcNetwork, BtcPurpose, XpubPrefix } from './types';

/**
 * Get the 4-byte version prefix from an extended public key.
 */
export function getVersionBytes(xpub: string): number {
  const decoded = bs58check.decode(xpub);
  const view = new DataView(
    decoded.buffer,
    decoded.byteOffset,
    decoded.byteLength,
  );
  return view.getUint32(0, false); // false = big-endian
}

/**
 * Get the prefix string (xpub, ypub, zpub, etc.) from an extended public key.
 */
export function getPrefix(xpub: string): XpubPrefix {
  const version = getVersionBytes(xpub);
  for (const [prefix, bytes] of Object.entries(SLIP132_VERSION_BYTES)) {
    if (bytes.public === version) {
      return prefix as XpubPrefix;
    }
  }
  throw new Error(`Unknown xpub version: 0x${version.toString(16)}`);
}

/**
 * Normalize any extended public key to standard xpub/tpub format.
 * This strips SLIP-132 encoding (ypub/zpub/upub/vpub) back to base format.
 */
export function normalize(xpub: string): string {
  const prefix = getPrefix(xpub);
  const isTestnet = ['tpub', 'upub', 'vpub'].includes(prefix);
  const targetVersion = isTestnet
    ? SLIP132_VERSION_BYTES.tpub.public
    : SLIP132_VERSION_BYTES.xpub.public;

  return convertVersion(xpub, targetVersion);
}

/**
 * Format an extended public key with the appropriate SLIP-132 prefix
 * based on purpose and network.
 */
export function format(
  xpub: string,
  purpose: BtcPurpose,
  network: BtcNetwork = 'mainnet',
): string {
  const isTestnet = network !== 'mainnet';

  let targetVersion: number;
  switch (purpose) {
    case BTC_PURPOSES.LEGACY:
      targetVersion = isTestnet
        ? SLIP132_VERSION_BYTES.tpub.public
        : SLIP132_VERSION_BYTES.xpub.public;
      break;
    case BTC_PURPOSES.WRAPPED:
      targetVersion = isTestnet
        ? SLIP132_VERSION_BYTES.upub.public
        : SLIP132_VERSION_BYTES.ypub.public;
      break;
    case BTC_PURPOSES.NATIVE:
      targetVersion = isTestnet
        ? SLIP132_VERSION_BYTES.vpub.public
        : SLIP132_VERSION_BYTES.zpub.public;
      break;
    default:
      throw new Error(`Unknown purpose: ${purpose}`);
  }

  return convertVersion(xpub, targetVersion);
}

/**
 * Convert an extended public key to a different version.
 */
function convertVersion(xpub: string, targetVersion: number): string {
  const decoded = bs58check.decode(xpub);
  const converted = new Uint8Array(decoded.length);
  const view = new DataView(converted.buffer);
  view.setUint32(0, targetVersion, false); // false = big-endian
  converted.set(decoded.subarray(4), 4); // copy bytes after version
  return bs58check.encode(converted);
}

/**
 * Infer the BTC purpose from an extended public key prefix.
 */
export function inferPurpose(xpub: string): BtcPurpose {
  const prefix = getPrefix(xpub);
  switch (prefix) {
    case 'xpub':
    case 'tpub':
      return BTC_PURPOSES.LEGACY;
    case 'ypub':
    case 'upub':
      return BTC_PURPOSES.WRAPPED;
    case 'zpub':
    case 'vpub':
      return BTC_PURPOSES.NATIVE;
    default:
      throw new Error(`Cannot infer purpose from prefix: ${prefix}`);
  }
}
