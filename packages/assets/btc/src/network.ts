import {
  BTC_COIN_TYPES,
  BTC_NETWORKS,
  SLIP132_VERSION_BYTES,
} from './constants';
import type { BtcCoinType, BtcNetwork } from './types';
import { getVersionBytes } from './slip132';

/**
 * Infer the network (mainnet/testnet) from an extended public key.
 */
export function inferFromXpub(xpub: string): BtcNetwork {
  const version = getVersionBytes(xpub);

  const mainnetVersions = new Set<number>([
    SLIP132_VERSION_BYTES.xpub.public,
    SLIP132_VERSION_BYTES.ypub.public,
    SLIP132_VERSION_BYTES.zpub.public,
  ]);
  if (mainnetVersions.has(version)) {
    return BTC_NETWORKS.MAINNET;
  }

  const testnetVersions = new Set<number>([
    SLIP132_VERSION_BYTES.tpub.public,
    SLIP132_VERSION_BYTES.upub.public,
    SLIP132_VERSION_BYTES.vpub.public,
  ]);
  if (testnetVersions.has(version)) {
    return BTC_NETWORKS.TESTNET;
  }

  throw new Error(`Unknown xpub version: 0x${version.toString(16)}`);
}

/**
 * Get the BIP44 coin type for a given network.
 */
export function getCoinType(network: BtcNetwork): BtcCoinType;
export function getCoinType(override: BtcCoinType): BtcCoinType;
export function getCoinType(
  networkOrOverride: BtcNetwork | BtcCoinType,
): BtcCoinType {
  if (typeof networkOrOverride === 'number') {
    return networkOrOverride;
  }

  switch (networkOrOverride) {
    case BTC_NETWORKS.MAINNET:
      return BTC_COIN_TYPES.MAINNET;
    case BTC_NETWORKS.TESTNET:
    case BTC_NETWORKS.REGTEST:
      return BTC_COIN_TYPES.TESTNET;
    default:
      throw new Error(`Unknown network: ${networkOrOverride}`);
  }
}

/**
 * Get network name from coin type.
 */
export function getNetworkFromCoinType(coinType: BtcCoinType): BtcNetwork {
  switch (coinType) {
    case BTC_COIN_TYPES.MAINNET:
      return BTC_NETWORKS.MAINNET;
    case BTC_COIN_TYPES.TESTNET:
      return BTC_NETWORKS.TESTNET;
    default:
      throw new Error(`Unknown coin type: ${coinType}`);
  }
}

/**
 * Check if a network is testnet-like (testnet or regtest).
 */
export function isTestnet(network: BtcNetwork): boolean {
  return network === BTC_NETWORKS.TESTNET || network === BTC_NETWORKS.REGTEST;
}
