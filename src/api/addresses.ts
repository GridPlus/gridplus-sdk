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

type FetchAddressesParams = {
  n?: number;
  startPathIndex?: number;
};

export const fetchAddresses = async (overrides?: GetAddressesRequestParams) => {
  let allAddresses: string[] = [];
  let totalFetched = 0;
  const totalToFetch = overrides?.n || MAX_ADDR;

  while (totalFetched < totalToFetch) {
    const batchSize = Math.min(MAX_ADDR, totalToFetch - totalFetched);
    const startPath = getStartPath(DEFAULT_ETH_DERIVATION, totalFetched);
    await queue((client) =>
      client
        .getAddresses({
          startPath,
          ...overrides,
          n: batchSize,
        })
        .then((addresses: string[]) => {
          if (addresses.length > 0) {
            allAddresses = [...allAddresses, ...addresses];
            totalFetched += addresses.length;
          }
        }),
    );
  }

  return allAddresses;
};

export const fetchBtcLegacyAddresses = async (
  { n, startPathIndex }: FetchAddressesParams = {
    n: MAX_ADDR,
    startPathIndex: 0,
  },
) => {
  return fetchAddresses({
    startPath: getStartPath(BTC_LEGACY_DERIVATION, startPathIndex),
    n,
  });
};

export const fetchBtcSegwitAddresses = async (
  { n, startPathIndex }: FetchAddressesParams = {
    n: MAX_ADDR,
    startPathIndex: 0,
  },
) => {
  return fetchAddresses({
    startPath: getStartPath(BTC_SEGWIT_DERIVATION, startPathIndex),
    n,
  });
};

export const fetchBtcWrappedSegwitAddresses = async (
  { n, startPathIndex }: FetchAddressesParams = {
    n: MAX_ADDR,
    startPathIndex: 0,
  },
) => {
  return fetchAddresses({
    startPath: getStartPath(BTC_WRAPPED_SEGWIT_DERIVATION, startPathIndex),
    n,
  });
};

export const fetchSolanaAddresses = async (
  { n, startPathIndex }: FetchAddressesParams = {
    n: MAX_ADDR,
    startPathIndex: 0,
  },
) => {
  return fetchAddresses({
    startPath: getStartPath(SOLANA_DERIVATION, startPathIndex, 2),
    n,
  });
};

export const fetchLedgerLiveAddresses = async (
  { n, startPathIndex }: FetchAddressesParams = {
    n: MAX_ADDR,
    startPathIndex: 0,
  },
) => {
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
  { n, startPathIndex }: FetchAddressesParams = {
    n: MAX_ADDR,
    startPathIndex: 0,
  },
) => {
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
