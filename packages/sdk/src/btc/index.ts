// Re-export everything from @gridplus/btc
export {
  // Constants
  HARDENED_OFFSET,
  SLIP132_VERSION_BYTES,
  BTC_PURPOSES,
  BTC_COIN_TYPES,
  BTC_NETWORKS,
  // SLIP-132 utilities
  slip132,
  getVersionBytes,
  getPrefix,
  normalize,
  format,
  inferPurpose,
  // Network utilities
  network,
  inferFromXpub,
  getCoinType,
  getNetworkFromCoinType,
  isTestnet,
  // Transaction building
  buildTxReq,
  estimateFee,
  // Wallet utilities
  getSummary,
  getSnapshot,
  // Provider
  provider,
  createBlockbookProvider,
  BlockbookProvider,
} from '@gridplus/btc';

export type {
  BtcPurpose,
  BtcCoinType,
  BtcNetwork,
  XpubPrefix,
  ScriptType,
  XpubOptions,
  XpubsOptions,
  PreviousOutput,
  WalletUtxo,
  WalletSummary,
  WalletSnapshot,
  WalletOptions,
  TxBuildInput,
  TxBuildResult,
  BtcProvider,
  BlockbookProviderConfig,
  BlockbookUtxo,
  BlockbookTransaction,
  BlockbookSummary,
  FeeRates,
  PagingOptions,
} from '@gridplus/btc';

// Lattice-specific xpub fetching (requires SDK dependencies)
export { getXpub, getXpubs, getAllXpubs } from './xpub';
