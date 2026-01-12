import type { BtcProvider } from '../../../btc/provider/types';
import { getSnapshot, getSummary } from '../../../btc/wallet';
import { HARDENED_OFFSET } from '../../../constants';

const provider: BtcProvider = {
  getSummary: vi.fn(),
  getTransactions: vi.fn(),
  getUtxos: vi.fn(),
  broadcast: vi.fn(),
  getFeeRates: vi.fn(),
};

describe('btc/wallet', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns wallet summary with parsed values', async () => {
    (provider.getSummary as any).mockResolvedValue({
      address: 'xpub',
      balance: '100000',
      totalReceived: '150000',
      totalSent: '50000',
      unconfirmedBalance: '0',
      unconfirmedTxs: 0,
      txs: 3,
    });
    (provider.getUtxos as any).mockResolvedValue([
      {
        txid: 'tx1',
        vout: 0,
        value: '50000',
        height: 1,
        confirmations: 6,
      },
    ]);

    const summary = await getSummary({ xpub: 'xpub', provider });
    expect(summary.balance).toBe(100000);
    expect(summary.txCount).toBe(3);
    expect(summary.utxoCount).toBe(1);
  });

  it('builds a wallet snapshot with address info', async () => {
    (provider.getSummary as any).mockResolvedValue({
      address: 'xpub',
      balance: '100000',
      totalReceived: '150000',
      totalSent: '50000',
      unconfirmedBalance: '0',
      unconfirmedTxs: 0,
      txs: 3,
      tokens: [
        {
          type: 'XPUBAddress',
          name: 'bc1qreceive',
          path: "m/84'/0'/0'/0/3",
          transfers: 1,
          decimals: 8,
          balance: '0',
          totalReceived: '0',
          totalSent: '0',
        },
        {
          type: 'XPUBAddress',
          name: 'bc1qchange',
          path: "m/84'/0'/0'/1/1",
          transfers: 1,
          decimals: 8,
          balance: '0',
          totalReceived: '0',
          totalSent: '0',
        },
      ],
    });
    (provider.getUtxos as any).mockResolvedValue([
      {
        txid: 'tx1',
        vout: 0,
        value: '50000',
        height: 1,
        confirmations: 6,
        address: 'bc1qutxo',
        path: "m/84'/0'/0'/0/0",
      },
    ]);

    const snapshot = await getSnapshot({
      xpub: 'xpub',
      provider,
      purpose: 84,
    });

    expect(snapshot.utxos).toHaveLength(1);
    expect(snapshot.utxos[0].scriptType).toBe('p2wpkh');
    expect(snapshot.utxos[0].path).toEqual([
      HARDENED_OFFSET + 84,
      HARDENED_OFFSET + 0,
      HARDENED_OFFSET + 0,
      0,
      0,
    ]);
    expect(snapshot.addresses.receiving).toEqual(['bc1qreceive']);
    expect(snapshot.addresses.change).toEqual(['bc1qchange']);
    expect(snapshot.nextReceiveIndex).toBe(4);
    expect(snapshot.nextChangeIndex).toBe(2);
  });
});
