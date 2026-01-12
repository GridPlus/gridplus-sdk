export {
  SLIP132_VERSION_BYTES,
  BTC_PURPOSES,
  BTC_COIN_TYPES,
  BTC_NETWORKS,
} from './constants';

export type {
  BtcPurpose,
  BtcCoinType,
  BtcNetwork,
  XpubPrefix,
  XpubOptions,
  XpubsOptions,
  WalletUtxo,
  WalletSummary,
  WalletSnapshot,
  TxBuildInput,
  TxBuildResult,
} from './types';

export * as slip132 from './slip132';
export * as network from './network';

export { getXpub, getXpubs, getAllXpubs } from './xpub';
export { buildTxReq, estimateFee } from './tx';
export { getSummary, getSnapshot } from './wallet';

export * as provider from './provider';
export { createBlockbookProvider } from './provider/blockbook';
export type {
  BtcProvider,
  BlockbookProviderConfig,
  FeeRates,
  PagingOptions,
} from './provider/types';
