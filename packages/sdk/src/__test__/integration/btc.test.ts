import { btc } from '../../index';

describe('BTC Integration', () => {
  describe('slip132 + network integration', () => {
    it('formats and infers network correctly', () => {
      const xpub =
        'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8';

      const zpub = btc.slip132.format(xpub, 84, 'mainnet');
      expect(zpub.startsWith('zpub')).toBe(true);

      const network = btc.network.inferFromXpub(zpub);
      expect(network).toBe('mainnet');

      const purpose = btc.slip132.inferPurpose(zpub);
      expect(purpose).toBe(84);
    });
  });

  describe('tx + wallet integration', () => {
    it('builds transaction from wallet UTXOs', () => {
      const utxos: btc.WalletUtxo[] = [
        {
          txid: 'abc123',
          vout: 0,
          value: 100000,
          confirmations: 6,
          address: 'bc1q...',
          path: [0x80000054, 0x80000000, 0x80000000, 0, 0],
          scriptType: 'p2wpkh',
        },
      ];

      const result = btc.buildTxReq({
        utxos,
        recipient: 'bc1qtest...',
        value: 50000,
        feeRate: 10,
        purpose: 84,
        changeIndex: 0,
      });

      expect(result.value).toBe(50000);
      expect(result.prevOuts).toHaveLength(1);
      expect(result.changeValue).toBeGreaterThan(0);
      expect(result.fee).toBeGreaterThan(0);
    });
  });
});
