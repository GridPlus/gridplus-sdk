import { getClient } from './../../api/utilities';
import { Chain, Common, Hardfork } from '@ethereumjs/common';
import { TransactionFactory } from '@ethereumjs/tx';
import { question } from 'readline-sync';
import { encode } from 'rlp';
import {
  fetchActiveWallets,
  fetchAddresses,
  fetchBtcLegacyAddresses,
  fetchBtcSegwitAddresses,
  pair,
  signBtcLegacyTx,
  signBtcSegwitTx,
  signBtcWrappedSegwitTx,
  signMessage,
} from '../../api';
import { HARDENED_OFFSET } from '../../constants';
import { BTC_PURPOSE_P2SH_P2WPKH, BTC_TESTNET_COIN } from '../utils/helpers';
import { dexlabProgram } from './signing/__mocks__/programs';
import {
  addAddressTags,
  fetchAddressTags,
  fetchLedgerLiveAddresses,
  removeAddressTags,
  sign,
  signSolanaTx,
} from '../../api/index';
import { setupClient } from '../utils/setup';
import { buildRandomMsg } from '../utils/builders';

describe('API', () => {
  test('pair', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }
  });

  describe('signing', () => {
    describe('bitcoin', () => {
      const btcTxData = {
        prevOuts: [
          {
            txHash:
              '6e78493091f80d89a92ae3152df7fbfbdc44df09cf01a9b76c5113c02eaf2e0f',
            value: 10000,
            index: 1,
            signerPath: [
              BTC_PURPOSE_P2SH_P2WPKH,
              BTC_TESTNET_COIN,
              HARDENED_OFFSET,
              0,
              0,
            ],
          },
        ],
        recipient: 'mhifA1DwiMPHTjSJM8FFSL8ibrzWaBCkVT',
        value: 1000,
        fee: 1000,
        changePath: [
          BTC_PURPOSE_P2SH_P2WPKH,
          BTC_TESTNET_COIN,
          HARDENED_OFFSET,
          1,
          0,
        ],
      };
      test('legacy', async () => {
        await signBtcLegacyTx(btcTxData);
      });

      test('segwit', async () => {
        await signBtcSegwitTx(btcTxData);
      });

      test('wrapped segwit', async () => {
        await signBtcWrappedSegwitTx(btcTxData);
      });
    });

    describe('ethereum', () => {
      describe('messages', () => {
        test('signPersonal', async () => {
          await signMessage('test message');
        });

        test('eip712', async () => {
          await signMessage(buildRandomMsg('eip712', getClient()));
        });
      });

      describe('transactions', () => {
        const txData = {
          type: 1,
          maxFeePerGas: 1200000000,
          maxPriorityFeePerGas: 1200000000,
          nonce: 0,
          gasLimit: 50000,
          to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
          value: 1000000000000,
          data: '0x17e914679b7e160613be4f8c2d3203d236286d74eb9192f6d6f71b9118a42bb033ccd8e8',
          gasPrice: 1200000000,
        };

        test('generic', async () => {
          const common = new Common({
            chain: Chain.Mainnet,
            hardfork: Hardfork.London,
          });
          const tx = TransactionFactory.fromTxData(txData, { common });
          const payload = tx.getMessageToSign(false);

          await sign(payload);
        });

        test('legacy', async () => {
          const rawTx = encode([
            txData.nonce,
            txData.gasPrice,
            txData.gasLimit,
            txData.to,
            txData.value,
            txData.data,
          ]);
          await sign(rawTx);
        });
      });
    });

    describe('solana', () => {
      test('sign solana', async () => {
        await signSolanaTx(dexlabProgram);
      });
    });
  });

  describe('address tags', () => {
    test('addAddressTags', async () => {
      await addAddressTags([{ test: 'test' }]);
    });

    test('fetchAddressTags', async () => {
      const addressTags = await fetchAddressTags();
      expect(addressTags.some((tag) => tag.key === 'test')).toBeTruthy();
    });

    test('removeAddressTags', async () => {
      const addressTags = await fetchAddressTags();
      await removeAddressTags(addressTags);
      expect(await fetchAddressTags()).toHaveLength(0);
    });
  });

  describe('addresses', () => {
    test('fetchAddresses', async () => {
      const addresses = await fetchAddresses();
      expect(addresses).toHaveLength(10);
    });

    test('fetchAddresses[1]', async () => {
      const addresses = await fetchAddresses({ n: 1 });
      expect(addresses).toHaveLength(1);
    });

    test('fetchAddresses[12]', async () => {
      const addresses = await fetchAddresses({ n: 12 });
      expect(addresses).toHaveLength(12);
    });

    test('fetchBtcLegacyAddresses', async () => {
      const addresses = await fetchBtcLegacyAddresses();
      expect(addresses).toHaveLength(10);
    });

    test('fetchBtcSegwitAddresses[12]', async () => {
      const addresses = await fetchBtcSegwitAddresses({ n: 12 });
      expect(addresses).toHaveLength(12);
    });

    test('fetchLedgerLiveAddresses', async () => {
      const addresses = await fetchLedgerLiveAddresses();
      expect(addresses).toHaveLength(10);
    });
  });

  describe('fetchActiveWallet', () => {
    test('fetchActiveWallet', async () => {
      const wallet = await fetchActiveWallets();
      expect(wallet).toBeTruthy();
    });
  });
});
