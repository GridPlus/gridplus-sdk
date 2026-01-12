import type { WalletUtxo } from '../../../btc/types';
import { buildTxReq, estimateFee } from '../../../btc/tx';
import { HARDENED_OFFSET } from '../../../constants';

const utxos: WalletUtxo[] = [
  {
    txid: 'tx1',
    vout: 0,
    value: 100000,
    confirmations: 6,
    address: 'bc1qtest',
    path: [
      HARDENED_OFFSET + 84,
      HARDENED_OFFSET,
      HARDENED_OFFSET,
      0,
      0,
    ],
    scriptType: 'p2wpkh',
  },
];

describe('btc/tx', () => {
  it('estimates fee for a standard segwit tx', () => {
    const fee = estimateFee(1, 10, 'p2wpkh');
    expect(fee).toBe(1420);
  });

  it('builds a tx request with change', () => {
    const result = buildTxReq({
      utxos,
      recipient: 'bc1qrecipient',
      value: 50000,
      feeRate: 10,
      purpose: 84,
      changeIndex: 5,
    });

    expect(result.prevOuts).toHaveLength(1);
    expect(result.fee).toBe(1420);
    expect(result.changeValue).toBe(48580);
    expect(result.changePath).toEqual([
      HARDENED_OFFSET + 84,
      HARDENED_OFFSET,
      HARDENED_OFFSET,
      1,
      5,
    ]);
  });

  it('selects the largest UTXO first', () => {
    const result = buildTxReq({
      utxos: [
        { ...utxos[0], txid: 'small', value: 20000 },
        { ...utxos[0], txid: 'large', value: 80000 },
      ],
      recipient: 'bc1qrecipient',
      value: 50000,
      feeRate: 10,
      purpose: 84,
      changeIndex: 0,
    });

    expect(result.prevOuts).toHaveLength(1);
    expect(result.prevOuts[0].txHash).toBe('large');
  });

  it('throws for empty UTXO set', () => {
    expect(() =>
      buildTxReq({
        utxos: [],
        recipient: 'bc1qrecipient',
        value: 50000,
        feeRate: 10,
        purpose: 84,
        changeIndex: 0,
      }),
    ).toThrow('No UTXOs available');
  });

  it('throws for invalid value or fee rate', () => {
    expect(() =>
      buildTxReq({
        utxos,
        recipient: 'bc1qrecipient',
        value: 0,
        feeRate: 10,
        purpose: 84,
        changeIndex: 0,
      }),
    ).toThrow('Value must be positive');

    expect(() =>
      buildTxReq({
        utxos,
        recipient: 'bc1qrecipient',
        value: 1000,
        feeRate: 0,
        purpose: 84,
        changeIndex: 0,
      }),
    ).toThrow('Fee rate must be positive');
  });

  it('throws when funds are insufficient', () => {
    expect(() =>
      buildTxReq({
        utxos,
        recipient: 'bc1qrecipient',
        value: 99000,
        feeRate: 10,
        purpose: 84,
        changeIndex: 0,
      }),
    ).toThrow('Insufficient funds');
  });
});
