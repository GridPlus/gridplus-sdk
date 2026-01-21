/** UTXO as returned by Blockbook */
export interface BlockbookUtxo {
  txid: string;
  vout: number;
  value: string;
  height: number;
  confirmations: number;
  address?: string;
  path?: string;
}

/** Transaction as returned by Blockbook */
export interface BlockbookTransaction {
  txid: string;
  version: number;
  vin: Array<{
    txid: string;
    vout: number;
    sequence: number;
    addresses: string[];
    value: string;
  }>;
  vout: Array<{
    value: string;
    n: number;
    addresses: string[];
    isOwn?: boolean;
  }>;
  blockHeight: number;
  confirmations: number;
  blockTime: number;
  value: string;
  valueIn: string;
  fees: string;
}

/** Address/Xpub summary from Blockbook */
export interface BlockbookSummary {
  address: string;
  balance: string;
  totalReceived: string;
  totalSent: string;
  unconfirmedBalance: string;
  unconfirmedTxs: number;
  txs: number;
  usedTokens?: number;
  tokens?: Array<{
    type: string;
    name: string;
    path: string;
    transfers: number;
    decimals: number;
    balance: string;
    totalReceived: string;
    totalSent: string;
  }>;
}

/** Paging options for transaction queries */
export interface PagingOptions {
  page?: number;
  pageSize?: number;
  from?: number;
  to?: number;
}

/** Fee rate estimates */
export interface FeeRates {
  fast: number; // sats/vbyte - ~10 min confirmation
  medium: number; // sats/vbyte - ~30 min confirmation
  slow: number; // sats/vbyte - ~60 min confirmation
  economy?: number; // sats/vbyte - lowest priority
}

/** BTC Provider interface - abstraction over chain data sources */
export interface BtcProvider {
  /** Get account summary for an xpub */
  getSummary(xpub: string): Promise<BlockbookSummary>;

  /** Get transaction history for an xpub */
  getTransactions(
    xpub: string,
    options?: PagingOptions,
  ): Promise<BlockbookTransaction[]>;

  /** Get unspent transaction outputs for an xpub */
  getUtxos(xpub: string): Promise<BlockbookUtxo[]>;

  /** Broadcast a signed transaction */
  broadcast(rawTx: string): Promise<string>;

  /** Get current fee rate estimates */
  getFeeRates(): Promise<FeeRates>;
}

/** Provider configuration */
export interface BlockbookProviderConfig {
  baseUrl?: string;
  network?: 'mainnet' | 'testnet';
}

/** Response from xpub endpoint with transaction details */
export interface BlockbookXpubResponse extends BlockbookSummary {
  transactions?: BlockbookTransaction[];
}

/** Response from broadcast endpoint */
export interface BlockbookBroadcastResponse {
  result: string;
}

/** Response from fee estimate endpoint */
export interface BlockbookFeeEstimateResponse {
  result: string;
}
