/**
 * Tests for establishing a connection to a target Lattice and validating
 * basic functionality.
 *
 * This test suite serves two purposes:
 *
 * 1. You need to run this before you can run any other tests. Run it with `REUSE_KEY=1`
 *    as an `env` param. This will ask you for a device ID and will attempt a pairing
 *    with the target Lattice. Note that the Lattice cannot already be paired so you may
 *    need to remove the SDK permission before proceeding to re-pair. After you pair,
 *    the connection will be cached locally and you can run subsequent tests with
 *    `DEVICE_ID=<yourDeviceId>` as an `env` param. This includes *any* test, including
 *    this one.
 *
 * 2. You can run this to just validate basic connectivity. If you don't need to cache
 *    the connection you can run this without any `env` params and it will attempt to
 *    pair with a target Lattice.
 */
import { TransactionFactory as EthTxFactory } from '@ethereumjs/tx';
import { question } from 'readline-sync';
import { HARDENED_OFFSET } from '../../constants';
import { LatticeResponseCode, ProtocolConstants } from '../../protocol';
import { randomBytes } from '../../util';
import { buildEthSignRequest } from '../utils/builders';
import { getDeviceId } from '../utils/getters';
import {
  BTC_COIN,
  BTC_PURPOSE_P2PKH,
  BTC_PURPOSE_P2SH_P2WPKH,
  BTC_PURPOSE_P2WPKH,
  BTC_TESTNET_COIN,
  ETH_COIN,
  setupTestClient,
} from '../utils/helpers';

import { setupClient } from '../utils/setup';

const id = getDeviceId();

describe('General', () => {
  let client;

  test('pair', async () => {
    client = await setupClient();
  });
  describe.skip('Should sign Ethereum transactions', () => {
    it('should sign Legacy transactions', async () => {
      const { req } = await buildEthSignRequest(client);
      await client.sign(req);
    });

    it('should sign newer transactions', async () => {
      const { txData, req, common } = await buildEthSignRequest(client, {
        type: 1,
        gasPrice: 1200000000,
        nonce: 0,
        gasLimit: 50000,
        to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
        value: 1000000000000,
        data: '0x17e914679b7e160613be4f8c2d3203d236286d74eb9192f6d6f71b9118a42bb033ccd8e8',
      });
      // NOTE: This will display a prehashed payload for bridged general signing
      // requests because `ethMaxDataSz` represents the `data` field for legacy
      // requests, but it represents the entire payload for general signing requests.
      const tx = EthTxFactory.fromTxData(txData, { common });
      req.data.payload = tx.getMessageToSign(false);
      await client.sign(req);
    });

    it('should sign bad transactions', async () => {
      const { txData, req, maxDataSz, common } = await buildEthSignRequest(
        client,
      );
      await question(
        'Please REJECT the next request if the warning screen displays. Press enter to continue.',
      );
      txData.data = randomBytes(maxDataSz);
      req.data.data = randomBytes(maxDataSz + 1);
      const tx = EthTxFactory.fromTxData(txData, { common });
      req.data.payload = tx.getMessageToSign(false);
      await expect(client.sign(req)).rejects.toThrow(
        `${ProtocolConstants.responseMsg[LatticeResponseCode.userDeclined]}`,
      );
    });
  });

  describe('Should sign Bitcoin transactions', () => {
    it('Should sign legacy Bitcoin inputs', async () => {
      const txData = {
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
        // isSegwit: false, // old encoding
        changePath: [
          BTC_PURPOSE_P2SH_P2WPKH,
          BTC_TESTNET_COIN,
          HARDENED_OFFSET,
          1,
          0,
        ],
      };
      const req = {
        currency: 'BTC',
        data: txData,
      };

      // Sign a legit tx
      const sigResp = await client.sign(req);
      expect(sigResp.tx).not.toEqual(null);
      expect(sigResp.txHash).not.toEqual(null);
    });

    it('Should sign wrapped segwit Bitcoin inputs', async () => {
      const txData = {
        prevOuts: [
          {
            txHash:
              'ab8288ef207f11186af98db115aa7120aa36ceb783e8792fb7b2f39c88109a99',
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
        recipient: '2NGZrVvZG92qGYqzTLjCAewvPZ7JE8S8VxE',
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
      const req = {
        currency: 'BTC',
        data: txData,
      };
      // Sign a legit tx
      const sigResp = await client.sign(req);
      expect(sigResp.tx).not.toEqual(null);
      expect(sigResp.txHash).not.toEqual(null);
    });

    it('Should sign wrapped segwit Bitcoin inputs to a bech32 address', async () => {
      const txData = {
        prevOuts: [
          {
            txHash:
              'f93d0a77f58b4274d84f427d647f1f27e38b4db79fd975691e15109fde7ea06e',
            value: 1802440,
            index: 1,
            signerPath: [
              BTC_PURPOSE_P2SH_P2WPKH,
              BTC_TESTNET_COIN,
              HARDENED_OFFSET,
              1,
              0,
            ],
          },
        ],
        recipient: 'tb1qym0z2a939lefrgw67ep5flhf43dvpg3h4s96tn',
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
      const req = {
        currency: 'BTC',
        data: txData,
      };
      // Sign a legit tx
      const sigResp = await client.sign(req);
      expect(sigResp.tx).not.toEqual(null);
      expect(sigResp.txHash).not.toEqual(null);
    });

    it('Should sign an input from a native segwit account', async () => {
      const txData = {
        prevOuts: [
          {
            txHash:
              'b2efdbdd3340d2bc547671ce3993a6f05d70343c07578f9d7f5626fdfc06fa35',
            value: 76800,
            index: 0,
            signerPath: [
              84 + HARDENED_OFFSET, // BIP84 for native segwit
              BTC_TESTNET_COIN,
              HARDENED_OFFSET,
              0,
              0,
            ],
          },
        ],
        recipient: '2N4gqWT4oqWL2gz9ps92z9fm2Bg3FUkqG7Q',
        value: 70000,
        fee: 4380,
        isSegwit: true,
        changePath: [
          BTC_PURPOSE_P2WPKH,
          BTC_TESTNET_COIN,
          HARDENED_OFFSET,
          1,
          0,
        ],
      };
      const req = {
        currency: 'BTC',
        data: txData,
      };
      // Sign a legit tx
      const sigResp = await client.sign(req);
      expect(sigResp.tx).not.toEqual(null);
      expect(sigResp.txHash).not.toEqual(null);
      console.log(sigResp);
      expect(sigResp.changeRecipient?.slice(0, 2)).toEqual('bc');
    });
  });
});
