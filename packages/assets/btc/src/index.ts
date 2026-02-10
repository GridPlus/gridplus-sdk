// Constants
export {
  HARDENED_OFFSET,
  SLIP132_VERSION_BYTES,
  BTC_PURPOSES,
  BTC_COIN_TYPES,
  BTC_NETWORKS,
} from './constants';

// Types
export type {
  BtcPurpose,
  BtcCoinType,
  BtcNetwork,
  XpubPrefix,
  ScriptType,
  BtcAddressFormat,
  XpubOptions,
  XpubsOptions,
  PreviousOutput,
  BitcoinSignPayload,
  WalletUtxo,
  WalletSummary,
  WalletSnapshot,
  TxBuildInput,
  TxBuildResult,
} from './types';

// SLIP-132 utilities
export * as slip132 from './slip132';
export {
  getVersionBytes,
  getPrefix,
  normalize,
  format,
  inferPurpose,
} from './slip132';

// Network utilities
export * as network from './network';
export {
  inferFromXpub,
  getCoinType,
  getNetworkFromCoinType,
  isTestnet,
} from './network';

// Transaction building
export { buildTxReq, estimateFee } from './tx';

// Wallet utilities
export { getSummary, getSnapshot } from './wallet';
export type { WalletOptions } from './wallet';

// Provider
export * as provider from './provider';
export {
  createBlockbookProvider,
  BlockbookProvider,
} from './provider/blockbook';
export type {
  BtcProvider,
  BlockbookProviderConfig,
  BlockbookUtxo,
  BlockbookTransaction,
  BlockbookSummary,
  FeeRates,
  PagingOptions,
} from './provider/types';

// Asset module
export { btc } from './asset';
export type {
  AssetCapabilities,
  AssetModule,
  Account,
  GetAccountsParams,
  GetAddressParams,
  GetPublicKeyParams,
  SignRequest,
  SignResult,
} from '@gridplus/asset-core';

export type {
  BtcAdapter,
  BtcAdapterOptions,
  BtcGetAccountsParams,
  BtcGetAddressParams,
  BtcGetPublicKeyParams,
  BtcSignRequest,
  Signer,
} from './asset';
