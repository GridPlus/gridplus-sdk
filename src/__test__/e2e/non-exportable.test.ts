/**
 * Legacy SafeCards had the ability to block export of the seed from the card.
 * This was beneficial from a security standpoint, but limited the cryptography
 * by what was available on the card. This option has been deprecated in newer
 * versions of GridPlus firmware, but we still want to support cards that do
 * not allow seed export, as we may bring that feature back in the future.
 *
 * In addition to the limitied cryptogrpahy, signature determinism is not possible
 * in the SafeCard applet as it exists today. These tests simply confirm that
 * signing the same message multiple times results in signatures that all appear
 * different, but cryptographically validate on the secp256k1 curve.
 *
 * You must have `FEATURE_TEST_RUNNER=1` enabled in firmware to run these tests.
 */
import Common, { Chain, Hardfork } from '@ethereumjs/common';
import { TransactionFactory as EthTxFactory } from '@ethereumjs/tx';
import { question } from 'readline-sync';
import { ecdsaRecover } from 'secp256k1';
import { Constants } from '../..';
import { DEFAULT_SIGNER } from '../utils/builders';
import { getSigStr } from '../utils/helpers';
import { initializeClient } from '../utils/initializeClient';

const client = initializeClient();
describe('Non-Exportable Seed', () => {
  describe('Setup', () => {
    it('Should ask if the user wants to test a card with a non-exportable seed', async () => {
      // NOTE: non-exportable seeds were deprecated from the normal setup pathway in firmware v0.12.0
      const result = await question(
        'Do you have a non-exportable SafeCard seed loaded and wish to continue? (Y/N) ',
      );
      if (result.toLowerCase() !== 'y') {
        console.log(
          '\nTest must be run with a SafeCard loaded with a non-exportable seed.\n',
        );
        process.exit(1);
      }
    });
  });

  describe('Test non-exportable seed on SafeCard', () => {
    it('Should test that ETH transaction sigs differ and validate on secp256k1', async () => {
      // Test ETH transactions
      const tx = EthTxFactory.fromTxData(
        {
          type: 2,
          maxFeePerGas: 1200000000,
          maxPriorityFeePerGas: 1200000000,
          nonce: 0,
          gasLimit: 50000,
          to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
          value: 100,
          data: '0xdeadbeef',
        },
        {
          common: new Common({ chain: Chain.Mainnet, hardfork: Hardfork.London }),
        },
      );
      const txReq = {
        data: {
          signerPath: DEFAULT_SIGNER,
          payload: tx.getMessageToSign(false),
          curveType: Constants.SIGNING.CURVES.SECP256K1,
          hashType: Constants.SIGNING.HASHES.KECCAK256,
          encodingType: Constants.SIGNING.ENCODINGS.EVM,
        },
      };
      // Validate that tx sigs are non-uniform
      const tx1Resp = await client.sign(txReq);
      validateSig(tx1Resp, tx.getMessageToSign(true));
      const tx2Resp = await client.sign(txReq);
      validateSig(tx2Resp, tx.getMessageToSign(true));
      const tx3Resp = await client.sign(txReq);
      validateSig(tx3Resp, tx.getMessageToSign(true));
      const tx4Resp = await client.sign(txReq);
      validateSig(tx4Resp, tx.getMessageToSign(true));
      const tx5Resp = await client.sign(txReq);
      validateSig(tx5Resp, tx.getMessageToSign(true));
      // Check sig 1
      expect(getSigStr(tx1Resp, tx)).not.toEqual(
        getSigStr(tx2Resp, tx),
      );
      expect(getSigStr(tx1Resp, tx)).not.toEqual(
        getSigStr(tx3Resp, tx),
      );
      expect(getSigStr(tx1Resp, tx)).not.toEqual(
        getSigStr(tx4Resp, tx),
      );
      expect(getSigStr(tx1Resp, tx)).not.toEqual(
        getSigStr(tx5Resp, tx),
      );
      // Check sig 2
      expect(getSigStr(tx2Resp, tx)).not.toEqual(
        getSigStr(tx1Resp, tx),
      );
      expect(getSigStr(tx2Resp, tx)).not.toEqual(
        getSigStr(tx3Resp, tx),
      );
      expect(getSigStr(tx2Resp, tx)).not.toEqual(
        getSigStr(tx4Resp, tx),
      );
      expect(getSigStr(tx2Resp, tx)).not.toEqual(
        getSigStr(tx5Resp, tx),
      );
      // Check sig 3
      expect(getSigStr(tx3Resp, tx)).not.toEqual(
        getSigStr(tx1Resp, tx),
      );
      expect(getSigStr(tx3Resp, tx)).not.toEqual(
        getSigStr(tx2Resp, tx),
      );
      expect(getSigStr(tx3Resp, tx)).not.toEqual(
        getSigStr(tx4Resp, tx),
      );
      expect(getSigStr(tx3Resp, tx)).not.toEqual(
        getSigStr(tx5Resp, tx),
      );
      // Check sig 4
      expect(getSigStr(tx4Resp, tx)).not.toEqual(
        getSigStr(tx1Resp, tx),
      );
      expect(getSigStr(tx4Resp, tx)).not.toEqual(
        getSigStr(tx2Resp, tx),
      );
      expect(getSigStr(tx4Resp, tx)).not.toEqual(
        getSigStr(tx3Resp, tx),
      );
      expect(getSigStr(tx4Resp, tx)).not.toEqual(
        getSigStr(tx5Resp, tx),
      );
      // Check sig 5
      expect(getSigStr(tx5Resp, tx)).not.toEqual(
        getSigStr(tx1Resp, tx),
      );
      expect(getSigStr(tx5Resp, tx)).not.toEqual(
        getSigStr(tx2Resp, tx),
      );
      expect(getSigStr(tx5Resp, tx)).not.toEqual(
        getSigStr(tx3Resp, tx),
      );
      expect(getSigStr(tx5Resp, tx)).not.toEqual(
        getSigStr(tx4Resp, tx),
      );
    });

    it('Should test that ETH message sigs differ and validate on secp256k1', async () => {
      // Validate that signPersonal message sigs are non-uniform
      const msgReq = {
        currency: 'ETH_MSG',
        data: {
          signerPath: DEFAULT_SIGNER,
          protocol: 'signPersonal',
          payload: 'test message',
        },
      };
      // NOTE: This uses the legacy signing pathway, which validates the signature
      // Once we move this to generic signing, we will need to validate these.
      const msg1Resp = await client.sign(msgReq);
      const msg2Resp = await client.sign(msgReq);
      const msg3Resp = await client.sign(msgReq);
      const msg4Resp = await client.sign(msgReq);
      const msg5Resp = await client.sign(msgReq);
      // Check sig 1
      expect(getSigStr(msg1Resp)).not.toEqual(
        getSigStr(msg2Resp),
      );
      expect(getSigStr(msg1Resp)).not.toEqual(
        getSigStr(msg3Resp),
      );
      expect(getSigStr(msg1Resp)).not.toEqual(
        getSigStr(msg4Resp),
      );
      expect(getSigStr(msg1Resp)).not.toEqual(
        getSigStr(msg5Resp),
      );
      // Check sig 2
      expect(getSigStr(msg2Resp)).not.toEqual(
        getSigStr(msg1Resp),
      );
      expect(getSigStr(msg2Resp)).not.toEqual(
        getSigStr(msg3Resp),
      );
      expect(getSigStr(msg2Resp)).not.toEqual(
        getSigStr(msg4Resp),
      );
      expect(getSigStr(msg2Resp)).not.toEqual(
        getSigStr(msg5Resp),
      );
      // Check sig 3
      expect(getSigStr(msg3Resp)).not.toEqual(
        getSigStr(msg1Resp),
      );
      expect(getSigStr(msg3Resp)).not.toEqual(
        getSigStr(msg2Resp),
      );
      expect(getSigStr(msg3Resp)).not.toEqual(
        getSigStr(msg4Resp),
      );
      expect(getSigStr(msg3Resp)).not.toEqual(
        getSigStr(msg5Resp),
      );
      // Check sig 4
      expect(getSigStr(msg4Resp)).not.toEqual(
        getSigStr(msg1Resp),
      );
      expect(getSigStr(msg4Resp)).not.toEqual(
        getSigStr(msg2Resp),
      );
      expect(getSigStr(msg4Resp)).not.toEqual(
        getSigStr(msg3Resp),
      );
      expect(getSigStr(msg4Resp)).not.toEqual(
        getSigStr(msg5Resp),
      );
      // Check sig 5
      expect(getSigStr(msg5Resp)).not.toEqual(
        getSigStr(msg1Resp),
      );
      expect(getSigStr(msg5Resp)).not.toEqual(
        getSigStr(msg2Resp),
      );
      expect(getSigStr(msg5Resp)).not.toEqual(
        getSigStr(msg3Resp),
      );
      expect(getSigStr(msg5Resp)).not.toEqual(
        getSigStr(msg4Resp),
      );
    });
  });
})

function validateSig (resp: any, hash: Buffer) {
  const rs = new Uint8Array(Buffer.concat([resp.sig.r, resp.sig.s]));
  const pubkeyA = Buffer.from(ecdsaRecover(rs, 0, hash, false)).toString('hex');
  const pubkeyB = Buffer.from(ecdsaRecover(rs, 1, hash, false)).toString('hex');
  if (
    resp.pubkey.toString('hex') !== pubkeyA &&
    resp.pubkey.toString('hex') !== pubkeyB
  ) {
    throw new Error('Signature did not validate.');
  }
}
