import { Chain, Common, Hardfork } from '@ethereumjs/common';
import { TransactionFactory } from '@ethereumjs/tx';
import { question } from 'readline-sync';
import { pair, sign } from '../../../api';
import { setupClient } from '../../utils/setup';
import { randomBytes } from '../../../util';

describe('big txs', () => {
  test('pair', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }
  });

  describe('signing', () => {
    test('big', async () => {
      const numBytes = 2500; // edit this number to change the number of bytes in the data field

      const txData = {
        type: 1,
        maxFeePerGas: 1200000000,
        maxPriorityFeePerGas: 1200000000,
        nonce: 0,
        gasLimit: 50000,
        to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
        value: 1000000000000,
        data: `0x${randomBytes(numBytes).toString('hex')}`,
        gasPrice: 1200000000,
      };

      const common = new Common({
        chain: Chain.Mainnet,
        hardfork: Hardfork.London,
      });
      const tx = TransactionFactory.fromTxData(txData, { common });
      const payload = tx.getMessageToSign(false);

      await sign(payload);
    });
    test('too big', async () => {
      const numBytes = 3000; // edit this number to change the number of bytes in the data field
      const txData = {
        type: 1,
        maxFeePerGas: 1200000000,
        maxPriorityFeePerGas: 1200000000,
        nonce: 0,
        gasLimit: 50000,
        to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
        value: 1000000000000,
        data: `0x${randomBytes(numBytes).toString('hex')}`,
        gasPrice: 1200000000,
      };

      const common = new Common({
        chain: Chain.Mainnet,
        hardfork: Hardfork.London,
      });
      const tx = TransactionFactory.fromTxData(txData, { common });
      const payload = tx.getMessageToSign(false);

      await sign(payload);
    });
    test('way too big', async () => {
      const numBytes = 100000; // edit this number to change the number of bytes in the data field
      const txData = {
        type: 1,
        maxFeePerGas: 1200000000,
        maxPriorityFeePerGas: 1200000000,
        nonce: 0,
        gasLimit: 50000,
        to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
        value: 1000000000000,
        data: `0x${randomBytes(numBytes).toString('hex')}`,
        gasPrice: 1200000000,
      };

      const common = new Common({
        chain: Chain.Mainnet,
        hardfork: Hardfork.London,
      });
      const tx = TransactionFactory.fromTxData(txData, { common });
      const payload = tx.getMessageToSign(false);

      await sign(payload);
    });
  });
});
