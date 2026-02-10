import {
  BTC_COIN_TYPES,
  BTC_PURPOSES,
  HARDENED_OFFSET,
} from './constants';
import type {
  BtcAddressFormat,
  BtcCoinType,
  BtcPurpose,
  BitcoinSignPayload,
  XpubOptions,
  XpubsOptions,
} from './types';
import type {
  Account,
  Address,
  AssetAdapter,
  AssetModule,
  DerivationPath,
  GetAccountsParams,
  GetAddressParams,
  GetPublicKeyParams,
  PublicKey,
  Signer as CoreSigner,
} from '@gridplus/asset-core';

export type BtcSignRequest = {
  kind: 'transaction';
  payload: BitcoinSignPayload;
  options?: { format?: BtcAddressFormat };
};

export type BtcGetAddressParams = GetAddressParams & {
  includePublicKey?: boolean;
  format?: BtcAddressFormat;
  purpose?: BtcPurpose;
  coinType?: BtcCoinType;
};

export type BtcGetAccountsParams = GetAccountsParams & {
  format?: BtcAddressFormat;
  purpose?: BtcPurpose;
  coinType?: BtcCoinType;
};

export type BtcGetPublicKeyParams = GetPublicKeyParams & {
  purpose?: BtcPurpose;
  coinType?: BtcCoinType;
};

export type Signer = CoreSigner<BtcSignRequest> & {
  getXpub?: (options: XpubOptions) => Promise<string>;
  getXpubs?: (options: XpubsOptions) => Promise<Map<BtcPurpose, string>>;
  getAllXpubs?: (
    coinType?: BtcCoinType,
    account?: number,
  ) => Promise<{ xpub: string; ypub: string; zpub: string }>;
};

export type BtcAdapter = AssetAdapter<
  BtcSignRequest,
  BtcGetAddressParams,
  BtcGetAccountsParams,
  BtcGetPublicKeyParams,
  Account
> & {
  getXpub?(options: XpubOptions): Promise<string>;
  getXpubs?(options: XpubsOptions): Promise<Map<BtcPurpose, string>>;
  getAllXpubs?(
    coinType?: BtcCoinType,
    account?: number,
  ): Promise<{ xpub: string; ypub: string; zpub: string }>;
};

export type BtcAdapterOptions = {
  purpose?: BtcPurpose;
  coinType?: BtcCoinType;
  accountIndex?: number;
  change?: number;
  format?: BtcAddressFormat;
};

const DEFAULT_PURPOSE: BtcPurpose = BTC_PURPOSES.NATIVE;
const DEFAULT_COIN_TYPE: BtcCoinType = BTC_COIN_TYPES.MAINNET;
const DEFAULT_ACCOUNT = 0;
const DEFAULT_CHANGE = 0;
const DEFAULT_ADDRESS_INDEX = 0;

const buildPath = (
  purpose: BtcPurpose,
  coinType: BtcCoinType,
  accountIndex: number,
  change: number,
  addressIndex: number,
): DerivationPath => {
  return [
    purpose + HARDENED_OFFSET,
    coinType + HARDENED_OFFSET,
    accountIndex + HARDENED_OFFSET,
    change,
    addressIndex,
  ];
};

const inferFormatFromPurpose = (purpose: BtcPurpose): BtcAddressFormat => {
  if (purpose === BTC_PURPOSES.LEGACY) return 'legacy';
  if (purpose === BTC_PURPOSES.WRAPPED) return 'wrapped';
  return 'native';
};

const resolvePurpose = (
  params?: BtcGetAddressParams,
  options?: BtcAdapterOptions,
): BtcPurpose => params?.purpose ?? options?.purpose ?? DEFAULT_PURPOSE;

const resolveCoinType = (
  params?: BtcGetAddressParams,
  options?: BtcAdapterOptions,
): BtcCoinType => params?.coinType ?? options?.coinType ?? DEFAULT_COIN_TYPE;

const resolveFormat = (
  purpose: BtcPurpose,
  params?: { format?: BtcAddressFormat },
  options?: BtcAdapterOptions,
): BtcAddressFormat =>
  params?.format ?? options?.format ?? inferFormatFromPurpose(purpose);

const resolveAccountIndex = (
  params?: BtcGetAddressParams,
  options?: BtcAdapterOptions,
): number => params?.accountIndex ?? options?.accountIndex ?? DEFAULT_ACCOUNT;

const resolveChange = (
  params?: { change?: number },
  options?: BtcAdapterOptions,
): number => params?.change ?? options?.change ?? DEFAULT_CHANGE;

const resolveAddressIndex = (params?: { addressIndex?: number }): number =>
  params?.addressIndex ?? DEFAULT_ADDRESS_INDEX;

const resolvePath = (
  params?: BtcGetAddressParams,
  options?: BtcAdapterOptions,
): DerivationPath => {
  return buildPath(resolvePurpose(params, options), resolveCoinType(params, options), resolveAccountIndex(params, options), resolveChange(params, options), resolveAddressIndex(params));
};

export const btc: AssetModule<
  BtcSignRequest,
  BtcAdapter,
  BtcAdapterOptions,
  Signer
> = {
  id: 'btc',
  name: 'Bitcoin',
  coinType: BTC_COIN_TYPES.MAINNET,
  curve: 'secp256k1',
  defaultPath: buildPath(
    DEFAULT_PURPOSE,
    DEFAULT_COIN_TYPE,
    DEFAULT_ACCOUNT,
    DEFAULT_CHANGE,
    DEFAULT_ADDRESS_INDEX,
  ),
  supports: {
    signTransaction: true,
    signMessage: false,
    signTypedData: false,
    signArbitrary: false,
    getPublicKey: true,
    getXpub: true,
  },
  create: (signer: Signer, options: BtcAdapterOptions = {}): BtcAdapter => {
    const getAddress = async (params: BtcGetAddressParams = {}): Promise<Address> => {
      const path = resolvePath(params, options);
      return signer.getAddress(path, { format: params.format });
    };

    const getPublicKey = async (
      params: BtcGetPublicKeyParams = {},
    ): Promise<PublicKey> => {
      const path = resolvePath(params, options);
      return signer.getPublicKey(path, { compressed: true });
    };

    const getAddresses = async (
      params: BtcGetAccountsParams = {},
    ): Promise<Address[]> => {
      const purpose = resolvePurpose(params, options);
      const format = resolveFormat(purpose, params, options);
      const startIndex = params.startIndex ?? 0;
      const addresses: Address[] = [];
      for (let i = 0; i < (params.count ?? 1); i += 1) {
        const path = resolvePath({ ...params, addressIndex: startIndex + i, purpose, format }, options);
        addresses.push(await getAddress({ ...params, path, format }));
      }
      return addresses;
    };

    const getAccount = async (
      params: BtcGetAddressParams = {},
    ): Promise<Account> => {
      const address = await getAddress(params);
      const publicKey = params.includePublicKey
        ? await getPublicKey(params)
        : undefined;
      const purpose = resolvePurpose(params, options);
      const coinType = resolveCoinType(params, options);
      const accountIndex = resolveAccountIndex(params, options);
      const change = resolveChange(params, options);
      const addressIndex = resolveAddressIndex(params);
      const path =
        params.path ??
        buildPath(purpose, coinType, accountIndex, change, addressIndex);
      return {
        address,
        publicKey,
        path,
        index: addressIndex,
      };
    };

    const getAccounts = async (
      params: BtcGetAccountsParams = {},
    ): Promise<Account[]> => {
      const purpose = resolvePurpose(params, options);
      const coinType = resolveCoinType(params, options);
      const format = resolveFormat(purpose, params, options);
      const accountIndex = resolveAccountIndex(params, options);
      const change = resolveChange(params, options);
      const startIndex = params.startIndex ?? 0;
      const count = params.count ?? 1;
      const accounts: Account[] = [];
      for (let i = 0; i < count; i += 1) {
        const addressIndex = startIndex + i;
        const path = buildPath(
          purpose,
          coinType,
          accountIndex,
          change,
          addressIndex,
        );
        const address = await signer.getAddress(path, { format });
        const publicKey = params.includePublicKey
          ? await signer.getPublicKey(path, { compressed: true })
          : undefined;
        accounts.push({
          address,
          publicKey,
          path,
          index: addressIndex,
        });
      }
      return accounts;
    };

    const getXpub = async (opts: XpubOptions) => {
      if (!signer.getXpub) {
        throw new Error('Signer does not support getXpub');
      }
      return signer.getXpub(opts);
    };

    const getXpubs = async (opts: XpubsOptions) => {
      if (!signer.getXpubs) {
        throw new Error('Signer does not support getXpubs');
      }
      return signer.getXpubs(opts);
    };

    const getAllXpubs = async (coinType?: BtcCoinType, account?: number) => {
      if (!signer.getAllXpubs) {
        throw new Error('Signer does not support getAllXpubs');
      }
      return signer.getAllXpubs(coinType, account);
    };

    return {
      getAddress,
      getAddresses,
      getPublicKey,
      getAccount,
      getAccounts,
      sign: (request) => signer.sign(request),
      getXpub: signer.getXpub ? getXpub : undefined,
      getXpubs: signer.getXpubs ? getXpubs : undefined,
      getAllXpubs: signer.getAllXpubs ? getAllXpubs : undefined,
    };
  },
  utils: {
    buildPath,
    inferFormatFromPurpose,
  },
};
