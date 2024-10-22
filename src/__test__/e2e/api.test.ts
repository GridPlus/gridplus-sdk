/* eslint-disable quotes */
import { getClient } from './../../api/utilities';
import { question } from 'readline-sync';
import { RLP } from '@ethereumjs/rlp';
import {
  fetchActiveWallets,
  fetchAddress,
  fetchAddresses,
  fetchBip44ChangeAddresses,
  fetchBtcLegacyAddresses,
  fetchBtcSegwitAddresses,
  fetchAddressesByDerivationPath,
  fetchSolanaAddresses,
  pair,
  signBtcLegacyTx,
  signBtcSegwitTx,
  signBtcWrappedSegwitTx,
  signMessage,
} from '../../api';
import { HARDENED_OFFSET } from '../../constants';
import { BTC_PURPOSE_P2SH_P2WPKH, BTC_TESTNET_COIN } from '../utils/helpers';
import { dexlabProgram } from './signing/solana/__mocks__/programs';
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
          chainId: 1,
          nonce: 0,
          gasLimit: '50000',
          to: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
          value: '1000000000000',
          data: '0x38ed17390000000000000000000000000000000000000000000c1c173c5b782a5b154ab900000000000000000000000000000000000000000000000f380d77022fe8c32600000000000000000000000000000000000000000000000000000000000000a00000000000000000000000007ae7684581f0298241c3d6a6567a48d56b42b15c00000000000000000000000000000000000000000000000000000000622f8d27000000000000000000000000000000000000000000000000000000000000000300000000000000000000000095ad61b0a150d79219dcf64e1e6cc01f0b64c4ce000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000050522c769e01eb06c02bd299066509d8f97a69ae',
          gasPrice: '1200000000',
        } as const;

        test('generic', async () => {
          await sign(txData);
        });

        test('legacy', async () => {
          const rawTx = RLP.encode([
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
    describe('fetchAddresses', () => {
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

      test('fetchSolanaAddresses', async () => {
        const addresses = await fetchSolanaAddresses();
        expect(addresses).toHaveLength(10);
      });

      test('fetchBip44ChangeAddresses', async () => {
        const addresses = await fetchBip44ChangeAddresses();
        expect(addresses).toHaveLength(10);
      });
    });

    describe('fetchAddressesByDerivationPath', () => {
      test('fetch single specific address', async () => {
        const addresses =
          await fetchAddressesByDerivationPath("44'/60'/0'/0/0");
        expect(addresses).toHaveLength(1);
        expect(addresses[0]).toBeTruthy();
      });

      test('fetch multiple addresses with wildcard', async () => {
        const addresses = await fetchAddressesByDerivationPath(
          "44'/60'/0'/0/X",
          {
            n: 5,
          },
        );
        expect(addresses).toHaveLength(5);
        addresses.forEach((address) => expect(address).toBeTruthy());
      });

      test('fetch addresses with offset', async () => {
        const addresses = await fetchAddressesByDerivationPath(
          "44'/60'/0'/0/X",
          {
            n: 3,
            startPathIndex: 10,
          },
        );
        expect(addresses).toHaveLength(3);
        addresses.forEach((address) => expect(address).toBeTruthy());
      });

      test('fetch addresses with lowercase x wildcard', async () => {
        const addresses = await fetchAddressesByDerivationPath(
          "44'/60'/0'/0/x",
          {
            n: 2,
          },
        );
        expect(addresses).toHaveLength(2);
        addresses.forEach((address) => expect(address).toBeTruthy());
      });

      test('fetch addresses with wildcard in middle of path', async () => {
        const addresses = await fetchAddressesByDerivationPath(
          "44'/60'/X'/0/0",
          {
            n: 3,
          },
        );
        expect(addresses).toHaveLength(3);
        addresses.forEach((address) => expect(address).toBeTruthy());
      });

      test('fetch solana addresses with wildcard in middle of path', async () => {
        const addresses = await fetchAddressesByDerivationPath(
          "44'/501'/X'/0'",
          {
            n: 1,
          },
        );
        expect(addresses).toHaveLength(1);
        addresses.forEach((address) => expect(address).toBeTruthy());
      });

      test('error on invalid derivation path', async () => {
        await expect(
          fetchAddressesByDerivationPath('invalid/path'),
        ).rejects.toThrow();
      });

      test('fetch single address when n=1 with wildcard', async () => {
        const addresses = await fetchAddressesByDerivationPath(
          "44'/60'/0'/0/X",
          {
            n: 1,
          },
        );
        expect(addresses).toHaveLength(1);
        expect(addresses[0]).toBeTruthy();
      });

      test('fetch no addresses when n=0', async () => {
        const addresses = await fetchAddressesByDerivationPath(
          "44'/60'/0'/0/X",
          {
            n: 0,
          },
        );
        expect(addresses).toHaveLength(0);
      });
    });

    describe('fetchAddress', () => {
      test('fetchAddress', async () => {
        const address = await fetchAddress();
        expect(address).toBeTruthy();
      });
    });
  });

  describe('fetchActiveWallets', () => {
    test('fetchActiveWallets', async () => {
      const wallet = await fetchActiveWallets();
      expect(wallet).toBeTruthy();
    });
  });
});
