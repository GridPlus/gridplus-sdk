import {
  BlockbookProvider,
  createBlockbookProvider,
} from '../../../provider/blockbook';

const buildResponse = (data: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data),
});

describe('btc/provider/blockbook', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses baseUrl without trailing slash', async () => {
    const provider = new BlockbookProvider({ baseUrl: 'https://example.com/' });
    fetchMock.mockResolvedValueOnce(
      buildResponse({
        address: 'xpub',
        balance: '0',
        totalReceived: '0',
        totalSent: '0',
        unconfirmedBalance: '0',
        unconfirmedTxs: 0,
        txs: 0,
      }),
    );

    await provider.getSummary('xpub123');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/api/v2/xpub/xpub123?details=basic',
      expect.any(Object),
    );
  });

  it('fetches summary data', async () => {
    const provider = createBlockbookProvider({
      baseUrl: 'https://example.com',
    });
    fetchMock.mockResolvedValueOnce(
      buildResponse({
        address: 'xpub',
        balance: '100',
        totalReceived: '150',
        totalSent: '50',
        unconfirmedBalance: '0',
        unconfirmedTxs: 0,
        txs: 2,
      }),
    );

    const summary = await provider.getSummary('xpub123');
    expect(summary.balance).toBe('100');
  });

  it('fetches transactions with paging', async () => {
    const provider = new BlockbookProvider({ baseUrl: 'https://example.com' });
    fetchMock.mockResolvedValueOnce(
      buildResponse({
        transactions: [
          {
            txid: 'tx1',
            version: 1,
            vin: [],
            vout: [],
            blockHeight: 1,
            confirmations: 1,
            blockTime: 0,
            value: '0',
            valueIn: '0',
            fees: '0',
          },
        ],
      }),
    );

    const txs = await provider.getTransactions('xpub123', {
      page: 2,
      pageSize: 10,
    });
    expect(fetchMock.mock.calls[0][0]).toContain('page=2');
    expect(fetchMock.mock.calls[0][0]).toContain('pageSize=10');
    expect(txs).toHaveLength(1);
  });

  it('fetches UTXOs', async () => {
    const provider = new BlockbookProvider({ baseUrl: 'https://example.com' });
    fetchMock.mockResolvedValueOnce(
      buildResponse([
        {
          txid: 'tx1',
          vout: 0,
          value: '1000',
          height: 1,
          confirmations: 1,
        },
      ]),
    );

    const utxos = await provider.getUtxos('xpub123');
    expect(utxos).toHaveLength(1);
  });

  it('broadcasts a raw transaction', async () => {
    const provider = new BlockbookProvider({ baseUrl: 'https://example.com' });
    fetchMock.mockResolvedValueOnce(buildResponse({ result: 'txid123' }));

    const txid = await provider.broadcast('rawtx');
    expect(txid).toBe('txid123');
  });

  it('throws on non-ok responses', async () => {
    const provider = new BlockbookProvider({ baseUrl: 'https://example.com' });
    fetchMock.mockResolvedValueOnce(
      buildResponse({ error: 'bad' }, false, 500),
    );

    await expect(provider.getSummary('xpub123')).rejects.toThrow(
      'Blockbook request failed: 500',
    );
  });

  it('fetches fee rates with conversions', async () => {
    const provider = new BlockbookProvider({ baseUrl: 'https://example.com' });
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/estimatefee/2')) {
        return Promise.resolve(buildResponse({ result: '0.00002' }));
      }
      if (url.includes('/estimatefee/6')) {
        return Promise.resolve(buildResponse({ result: '0.00003' }));
      }
      if (url.includes('/estimatefee/12')) {
        return Promise.resolve(buildResponse({ result: '0.00001' }));
      }
      return Promise.resolve(buildResponse({}));
    });

    const fees = await provider.getFeeRates();
    expect(fees).toEqual({ fast: 2, medium: 3, slow: 1 });
  });
});
