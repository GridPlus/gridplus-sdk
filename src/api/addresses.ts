import {
  BTC_LEGACY_CHANGE_DERIVATION,
  BTC_LEGACY_DERIVATION,
  BTC_SEGWIT_CHANGE_DERIVATION,
  BTC_SEGWIT_DERIVATION,
  BTC_WRAPPED_SEGWIT_CHANGE_DERIVATION,
  BTC_WRAPPED_SEGWIT_DERIVATION,
  DEFAULT_ETH_DERIVATION,
  HARDENED_OFFSET,
  LEDGER_LEGACY_DERIVATION,
  LEDGER_LIVE_DERIVATION,
  MAX_ADDR,
  SOLANA_DERIVATION,
} from '../constants';
import { getStartPath, parseDerivationPath, queue } from './utilities';

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

/**
 * Fetches a single address from the device.
 *
 * @note By default, this function fetches m/44'/60'/0'/0/0
 * @param path - either the index of ETH signing path or the derivation path to fetch
 */
export const fetchAddress = async (
  path: number | WalletPath = 0,
): Promise<string> => {
  return fetchAddresses({
    startPath:
      typeof path === 'number'
        ? getStartPath(DEFAULT_ETH_DERIVATION, path)
        : path,
    n: 1,
  }).then((addrs) => addrs[0]);
};

function createFetchBtcAddressesFunction(derivationPath: number[]) {
  return async (
    { n, startPathIndex }: FetchAddressesParams = {
      n: MAX_ADDR,
      startPathIndex: 0,
    },
  ) => {
    return fetchAddresses({
      startPath: getStartPath(derivationPath, startPathIndex),
      n,
    });
  };
}
export const fetchBtcLegacyAddresses = createFetchBtcAddressesFunction(
  BTC_LEGACY_DERIVATION,
);
export const fetchBtcSegwitAddresses = createFetchBtcAddressesFunction(
  BTC_SEGWIT_DERIVATION,
);
export const fetchBtcWrappedSegwitAddresses = createFetchBtcAddressesFunction(
  BTC_WRAPPED_SEGWIT_DERIVATION,
);
export const fetchBtcLegacyChangeAddresses = createFetchBtcAddressesFunction(
  BTC_LEGACY_CHANGE_DERIVATION,
);
export const fetchBtcSegwitChangeAddresses = createFetchBtcAddressesFunction(
  BTC_SEGWIT_CHANGE_DERIVATION,
);
export const fetchBtcWrappedSegwitChangeAddresses =
  createFetchBtcAddressesFunction(BTC_WRAPPED_SEGWIT_CHANGE_DERIVATION);

export const fetchSolanaAddresses = async (
  { n, startPathIndex }: FetchAddressesParams = {
    n: MAX_ADDR,
    startPathIndex: 0,
  },
) => {
  return fetchAddresses({
    startPath: getStartPath(SOLANA_DERIVATION, startPathIndex, 2),
    n,
    flag: 4,
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

export const fetchBip44ChangeAddresses = async (
  { n, startPathIndex }: FetchAddressesParams = {
    n: MAX_ADDR,
    startPathIndex: 0,
  },
) => {
  const addresses = [];
  for (let i = 0; i < n; i++) {
    addresses.push(
      queue((client) => {
        const startPath = [
          44 + HARDENED_OFFSET,
          501 + HARDENED_OFFSET,
          startPathIndex + i + HARDENED_OFFSET,
          0 + HARDENED_OFFSET,
        ];
        return client
          .getAddresses({
            startPath,
            n: 1,
            flag: 4,
          })
          .then((addresses) => addresses.map((address) => `${address}`));
      }),
    );
  }
  return Promise.all(addresses);
};

export async function fetchAddressesByDerivationPath(
  path: string,
  { n = 1, startPathIndex = 0 }: FetchAddressesParams = {},
): Promise<string[]> {
  const parsedPath = parseDerivationPath(path);
  const hasWildcard = path.toLowerCase().includes('x');
  const wildcardIndex = parsedPath.findIndex((part) => part === 0);

  if (!hasWildcard) {
    return queue((client) =>
      client.getAddresses({
        startPath: parsedPath,
        n: 1,
      }),
    );
  }

  const basePath = parsedPath.slice(0, wildcardIndex);

  const addresses: string[] = [];
  for (let i = 0; i < n; i++) {
    const currentPath = [
      ...basePath,
      startPathIndex + i,
      ...parsedPath.slice(wildcardIndex + 1),
    ];
    const result = await queue((client) =>
      client.getAddresses({
        startPath: currentPath,
        iterIdx: wildcardIndex,
        n: 1,
      }),
    );
    addresses.push(...result);
  }

  return addresses;
}
