import type {
  BtcProvider,
  BlockbookProviderConfig,
  BlockbookSummary,
  BlockbookTransaction,
  BlockbookUtxo,
  FeeRates,
  PagingOptions,
} from './types';

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
    return (response as any).transactions ?? [];
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

    if (typeof response === 'object' && response && 'result' in response) {
      return (response as any).result;
    }
    throw new Error('Unexpected broadcast response');
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
    const btcPerKb = parseFloat((response as any).result);
    if (isNaN(btcPerKb) || btcPerKb <= 0) {
      return 1;
    }
    return btcPerKb * 100000;
  }

  private async fetch(path: string, options: RequestInit = {}): Promise<unknown> {
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
