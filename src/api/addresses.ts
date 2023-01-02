import {
  BTC_LEGACY_DERIVATION,
  BTC_SEGWIT_DERIVATION,
  BTC_WRAPPED_SEGWIT_DERIVATION,
  DEFAULT_ETH_DERIVATION,
  HARDENED_OFFSET,
} from '../constants';
import { queue } from './utilities';

export const fetchAddresses = async (
  overrides?: GetAddressesRequestParams,
): Promise<string[]> => {
  return queue((client) =>
    client
      .getAddresses({
        startPath: DEFAULT_ETH_DERIVATION,
        n: 10,
        ...overrides,
      })
      .then((addrs) => addrs.map((addr) => `${addr}`)),
  );
};

export const fetchBtcLegacyAddresses = async (n = 10): Promise<string[]> => {
  return fetchAddresses({
    startPath: BTC_LEGACY_DERIVATION,
    n,
  });
};

export const fetchBtCSegwitAddresses = async (n = 10): Promise<string[]> => {
  return fetchAddresses({
    startPath: BTC_SEGWIT_DERIVATION,
    n,
  });
};

export const fetchBtcWrappedSegwitAddresses = async (
  n = 10,
): Promise<string[]> => {
  return fetchAddresses({
    startPath: BTC_WRAPPED_SEGWIT_DERIVATION,
    n,
  });
};

export const fetchLedgerLiveAddresses = async (n = 10): Promise<string[]> => {
  const addresses = [];
  for (let i = 0; i < n; i++) {
    addresses.push(
      queue((client) =>
        client
          .getAddresses({
            startPath: [
              HARDENED_OFFSET + 49,
              HARDENED_OFFSET + 60,
              HARDENED_OFFSET,
              i,
              0,
            ],
            n: 1,
          })
          .then((addresses) => addresses.map((address) => address.toString())),
      ),
    );
  }
  return Promise.all(addresses);
};
