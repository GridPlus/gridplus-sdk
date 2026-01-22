import type {
  BtcProvider,
  BlockbookProviderConfig,
  BlockbookSummary,
  BlockbookTransaction,
  BlockbookUtxo,
  BlockbookBroadcastResponse,
  BlockbookFeeEstimateResponse,
  FeeRates,
  PagingOptions,
} from './types';

/**
 * Type guard for xpub response with transactions.
 * The response is an object that may contain a transactions array.
 */
function isXpubWithTransactionsResponse(
  value: unknown,
): value is { transactions?: BlockbookTransaction[] } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if ('transactions' in obj && obj.transactions !== undefined) {
    return Array.isArray(obj.transactions);
  }
  return true;
}

/**
 * Type guard for BlockbookBroadcastResponse
 */
function isBroadcastResponse(
  value: unknown,
): value is BlockbookBroadcastResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'result' in value &&
    typeof (value as BlockbookBroadcastResponse).result === 'string'
  );
}

/**
 * Type guard for BlockbookFeeEstimateResponse
 */
function isFeeEstimateResponse(
  value: unknown,
): value is BlockbookFeeEstimateResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'result' in value &&
    typeof (value as BlockbookFeeEstimateResponse).result === 'string'
  );
}

const DEFAULT_BLOCKBOOK_URLS = {
  mainnet: 'https://btc1.trezor.io',
  testnet: 'https://tbtc1.trezor.io',
} as const;

/**
 * Blockbook provider for Bitcoin chain data.
 */
export class BlockbookProvider implements BtcProvider {
  private baseUrl: string;

  constructor(config?: BlockbookProviderConfig) {
    if (config?.baseUrl) {
      this.baseUrl = config.baseUrl.replace(/\/$/, '');
    } else {
      const network = config?.network ?? 'mainnet';
      this.baseUrl = DEFAULT_BLOCKBOOK_URLS[network];
    }
  }

  /**
   * Get account summary for an xpub.
   */
  async getSummary(xpub: string): Promise<BlockbookSummary> {
    const response = await this.fetch(`/api/v2/xpub/${xpub}?details=basic`);
    return response as BlockbookSummary;
  }

  /**
   * Get transaction history for an xpub.
   */
  async getTransactions(
    xpub: string,
    options: PagingOptions = {},
  ): Promise<BlockbookTransaction[]> {
    const { page = 1, pageSize = 50 } = options;
    const params = new URLSearchParams({
      details: 'txs',
      page: String(page),
      pageSize: String(pageSize),
    });

    const response = await this.fetch(`/api/v2/xpub/${xpub}?${params}`);
    if (!isXpubWithTransactionsResponse(response)) {
      throw new Error('Invalid response from Blockbook xpub endpoint');
    }
    return response.transactions ?? [];
  }

  /**
   * Get unspent transaction outputs for an xpub.
   */
  async getUtxos(xpub: string): Promise<BlockbookUtxo[]> {
    const response = await this.fetch(`/api/v2/utxo/${xpub}`);
    return response as BlockbookUtxo[];
  }

  /**
   * Broadcast a signed transaction.
   */
  async broadcast(rawTx: string): Promise<string> {
    const response = await this.fetch('/api/v2/sendtx/', {
      method: 'POST',
      body: rawTx,
    });

    if (isBroadcastResponse(response)) {
      return response.result;
    }
    throw new Error('Unexpected broadcast response format from Blockbook');
  }

  /**
   * Get current fee rate estimates.
   * Blockbook returns estimates for different confirmation targets.
   */
  async getFeeRates(): Promise<FeeRates> {
    const [fast, medium, slow] = await Promise.all([
      this.fetchFeeEstimate(2),
      this.fetchFeeEstimate(6),
      this.fetchFeeEstimate(12),
    ]);

    return {
      fast: Math.ceil(fast),
      medium: Math.ceil(medium),
      slow: Math.ceil(slow),
    };
  }

  private async fetchFeeEstimate(blocks: number): Promise<number> {
    const response = await this.fetch(`/api/v2/estimatefee/${blocks}`);
    if (!isFeeEstimateResponse(response)) {
      throw new Error(
        `Fee estimation failed: invalid response format for ${blocks} blocks`,
      );
    }
    const btcPerKb = Number.parseFloat(response.result);
    if (Number.isNaN(btcPerKb) || btcPerKb <= 0) {
      throw new Error(
        `Fee estimation failed: invalid fee rate "${response.result}" for ${blocks} blocks`,
      );
    }
    return btcPerKb * 100000;
  }

  private async fetch(
    path: string,
    options: RequestInit = {},
  ): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Blockbook request failed: ${response.status} ${text}`);
    }

    return response.json();
  }
}

/**
 * Create a Blockbook provider instance.
 */
export function createBlockbookProvider(
  config?: BlockbookProviderConfig,
): BtcProvider {
  return new BlockbookProvider(config);
}
