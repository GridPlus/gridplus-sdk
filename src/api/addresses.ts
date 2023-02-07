import {
  BTC_LEGACY_DERIVATION,
  BTC_SEGWIT_DERIVATION,
  BTC_WRAPPED_SEGWIT_DERIVATION,
  DEFAULT_ETH_DERIVATION,
  LEDGER_LEGACY_DERIVATION,
  LEDGER_LIVE_DERIVATION,
  MAX_ADDR,
  SOLANA_DERIVATION,
} from '../constants';
import { getStartPath, queue } from './utilities';

export const fetchAddresses = async (
  overrides?: GetAddressesRequestParams,
): Promise<string[]> => {
  return queue((client) =>
    client
      .getAddresses({
        startPath: DEFAULT_ETH_DERIVATION,
        n: MAX_ADDR,
        ...overrides,
      })
      .then((addrs) => addrs.map((addr) => `${addr}`)),
  );
};

export const fetchBtcLegacyAddresses = async (
  n = MAX_ADDR,
  startPathIndex?: number,
): Promise<string[]> => {
  return fetchAddresses({
    startPath: getStartPath(BTC_LEGACY_DERIVATION, startPathIndex),
    n,
  });
};

export const fetchBtCSegwitAddresses = async (
  n = MAX_ADDR,
  startPathIndex?: number,
): Promise<string[]> => {
  return fetchAddresses({
    startPath: getStartPath(BTC_SEGWIT_DERIVATION, startPathIndex),
    n,
  });
};

export const fetchBtcWrappedSegwitAddresses = async (
  n = MAX_ADDR,
  startPathIndex?: number,
): Promise<string[]> => {
  return fetchAddresses({
    startPath: getStartPath(BTC_WRAPPED_SEGWIT_DERIVATION, startPathIndex),
    n,
  });
};

export const fetchSolanaAddresses = async (
  n = MAX_ADDR,
  startPathIndex?: number,
): Promise<string[]> => {
  return fetchAddresses({
    startPath: getStartPath(SOLANA_DERIVATION, startPathIndex, 2),
    n,
  });
};

export const fetchLedgerLiveAddresses = async (
  n = MAX_ADDR,
  startPathIndex?: number,
): Promise<string[]> => {
  const addresses = [];
  for (let i = 0; i < n; i++) {
    addresses.push(
      queue((client) =>
        client
          .getAddresses({
            startPath: getStartPath(
              LEDGER_LIVE_DERIVATION,
              startPathIndex + i,
              2,
            ),
            n: 1,
          })
          .then((addresses) => addresses.map((address) => `${address}`)),
      ),
    );
  }
  return Promise.all(addresses);
};

export const fetchLedgerLegacyAddresses = async (
  n = MAX_ADDR,
  startPathIndex?: number,
): Promise<string[]> => {
  const addresses = [];
  for (let i = 0; i < n; i++) {
    addresses.push(
      queue((client) =>
        client
          .getAddresses({
            startPath: getStartPath(
              LEDGER_LEGACY_DERIVATION,
              startPathIndex + i,
              3,
            ),
            n: 1,
          })
          .then((addresses) => addresses.map((address) => `${address}`)),
      ),
    );
  }
  return Promise.all(addresses);
};
