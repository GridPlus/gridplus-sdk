import { HARDENED_OFFSET } from '../constants';
import { LatticeGetAddressesFlag } from '../protocol/latticeConstants';
import { queue } from '../api/utilities';
import { BTC_PURPOSES, BTC_COIN_TYPES } from './constants';
import { format } from './slip132';
import type { BtcPurpose, BtcCoinType, XpubOptions, XpubsOptions } from './types';

/**
 * Build the derivation path for fetching an xpub.
 * Path format: m/purpose'/coinType'/account'
 */
function buildXpubPath(
  purpose: BtcPurpose,
  coinType: BtcCoinType,
  account: number,
): number[] {
  return [
    purpose + HARDENED_OFFSET,
    coinType + HARDENED_OFFSET,
    account + HARDENED_OFFSET,
  ];
}

/**
 * Fetch a single extended public key from the Lattice device.
 *
 * @param options - Configuration for which xpub to fetch
 * @param options.purpose - BIP purpose (44=legacy, 49=wrapped segwit, 84=native segwit)
 * @param options.coinType - Coin type (0=mainnet, 1=testnet). Defaults to 0 (mainnet)
 * @param options.account - Account index. Defaults to 0
 * @returns Extended public key formatted with appropriate SLIP-132 prefix
 *
 * @example
 * // Fetch native segwit xpub (zpub) for mainnet
 * const zpub = await getXpub({ purpose: 84 });
 *
 * @example
 * // Fetch legacy xpub for testnet account 1
 * const tpub = await getXpub({ purpose: 44, coinType: 1, account: 1 });
 */
export async function getXpub(options: XpubOptions): Promise<string> {
  const { purpose, coinType = BTC_COIN_TYPES.MAINNET, account = 0 } = options;

  const startPath = buildXpubPath(purpose, coinType, account);
  const network = coinType === BTC_COIN_TYPES.TESTNET ? 'testnet' : 'mainnet';

  const result = await queue((client) =>
    client.getAddresses({
      startPath,
      n: 1,
      flag: LatticeGetAddressesFlag.secp256k1Xpub,
    }),
  );

  if (!result || result.length === 0) {
    throw new Error('Failed to fetch xpub from device');
  }

  return format(result[0], purpose, network);
}

/**
 * Fetch multiple extended public keys from the Lattice device.
 *
 * @param options - Configuration for which xpubs to fetch
 * @param options.purposes - Array of BIP purposes to fetch
 * @param options.coinType - Coin type (0=mainnet, 1=testnet). Defaults to 0 (mainnet)
 * @param options.account - Account index. Defaults to 0
 * @returns Map of purpose to extended public key
 *
 * @example
 * // Fetch all three xpub types for mainnet
 * const xpubs = await getXpubs({ purposes: [44, 49, 84] });
 * console.log(xpubs.get(84)); // zpub...
 */
export async function getXpubs(
  options: XpubsOptions,
): Promise<Map<BtcPurpose, string>> {
  const { purposes, coinType = BTC_COIN_TYPES.MAINNET, account = 0 } = options;

  const results = new Map<BtcPurpose, string>();

  for (const purpose of purposes) {
    const xpub = await getXpub({ purpose, coinType, account });
    results.set(purpose, xpub);
  }

  return results;
}

/**
 * Convenience function to fetch all standard xpubs (legacy, wrapped, native).
 */
export async function getAllXpubs(
  coinType: BtcCoinType = BTC_COIN_TYPES.MAINNET,
  account: number = 0,
): Promise<{ xpub: string; ypub: string; zpub: string }> {
  const xpubs = await getXpubs({
    purposes: [BTC_PURPOSES.LEGACY, BTC_PURPOSES.WRAPPED, BTC_PURPOSES.NATIVE],
    coinType,
    account,
  });

  return {
    xpub: xpubs.get(BTC_PURPOSES.LEGACY)!,
    ypub: xpubs.get(BTC_PURPOSES.WRAPPED)!,
    zpub: xpubs.get(BTC_PURPOSES.NATIVE)!,
  };
}
