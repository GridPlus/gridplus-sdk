import type { Address } from 'viem';
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
import { GetAddressesRequestParams, WalletPath } from '../types';
import {
  getStartPath,
  parseDerivationPathComponents,
  queue,
  getFlagFromPath,
} from './utilities';

type FetchAddressesParams = {
  n?: number;
  startPathIndex?: number;
  flag?: number;
};

export const fetchAddresses = async (
  overrides?: GetAddressesRequestParams,
): Promise<Address[]> => {
  let allAddresses: Address[] = [];
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
        .then((addresses: Buffer[] | string[]) => {
          const addressArray = addresses.map((addr) => {
            const addressStr =
              typeof addr === 'string' ? addr : addr.toString();
            return addressStr as Address;
          });
          if (addressArray.length > 0) {
            allAddresses = [...allAddresses, ...addressArray];
            totalFetched += addressArray.length;
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
): Promise<Address> => {
  return fetchAddresses({
    startPath:
      typeof path === 'number'
        ? getStartPath(DEFAULT_ETH_DERIVATION, path)
        : path,
    n: 1,
  }).then((addrs) => addrs[0]);
};

function createFetchBtcAddressesFunction(derivationPath: number[]) {
  return async ({
    n = MAX_ADDR,
    startPathIndex = 0,
  }: FetchAddressesParams = {}): Promise<Address[]> => {
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

export const fetchSolanaAddresses = async ({
  n = MAX_ADDR,
  startPathIndex = 0,
}: FetchAddressesParams = {}): Promise<Address[]> => {
  return fetchAddresses({
    startPath: getStartPath(SOLANA_DERIVATION, startPathIndex, 2),
    n,
    flag: 4,
  });
};

export const fetchLedgerLiveAddresses = async ({
  n = MAX_ADDR,
  startPathIndex = 0,
}: FetchAddressesParams = {}): Promise<Address[][]> => {
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
          .then((addresses) =>
            addresses.map((address) => `${address}` as Address),
          ),
      ),
    );
  }
  return Promise.all(addresses);
};

export const fetchLedgerLegacyAddresses = async ({
  n = MAX_ADDR,
  startPathIndex = 0,
}: FetchAddressesParams = {}): Promise<Address[][]> => {
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
          .then((addresses) =>
            addresses.map((address) => `${address}` as Address),
          ),
      ),
    );
  }
  return Promise.all(addresses);
};

export const fetchBip44ChangeAddresses = async ({
  n = MAX_ADDR,
  startPathIndex = 0,
}: FetchAddressesParams = {}): Promise<Address[][]> => {
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
          .then((addresses) =>
            addresses.map((address) => `${address}` as Address),
          );
      }),
    );
  }
  return Promise.all(addresses);
};

export async function fetchAddressesByDerivationPath(
  path: string,
  { n = 1, startPathIndex = 0, flag }: FetchAddressesParams = {},
): Promise<Address[]> {
  const components = path.split('/').filter(Boolean);
  const parsedPath = parseDerivationPathComponents(components);
  const _flag = getFlagFromPath(parsedPath);
  const wildcardIndex = components.findIndex((part) =>
    part.toLowerCase().includes('x'),
  );

  if (wildcardIndex === -1) {
    return queue((client) =>
      client
        .getAddresses({
          startPath: parsedPath,
          flag: flag || _flag,
          n,
        })
        .then((addresses) =>
          addresses.map((addr) => {
            const addressStr =
              typeof addr === 'string' ? addr : addr.toString();
            return addressStr as Address;
          }),
        ),
    );
  }

  const addresses: Address[] = [];
  for (let i = 0; i < n; i++) {
    const currentPath = [...parsedPath];
    currentPath[wildcardIndex] =
      currentPath[wildcardIndex] + startPathIndex + i;

    const result = await queue((client) =>
      client
        .getAddresses({
          startPath: currentPath,
          flag: flag || _flag,
          n: 1,
        })
        .then((addresses) =>
          addresses.map((addr) => {
            const addressStr =
              typeof addr === 'string' ? addr : addr.toString();
            return addressStr as Address;
          }),
        ),
    );
    addresses.push(...result);
  }

  return addresses;
}
