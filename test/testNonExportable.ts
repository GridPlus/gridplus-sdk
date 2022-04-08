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
import { expect } from 'chai';
import { question } from 'readline-sync';
import { Constants } from '../src/index'
import { HARDENED_OFFSET} from '../src/constants';
import helpers from './testUtil/helpers';

//---------
// Constants
//---------
let client, txReq, continueTests = false;
const DEFAULT_SIGNER = [
  helpers.BTC_PURPOSE_P2PKH,
  helpers.ETH_COIN,
  HARDENED_OFFSET,
  0,
  0,
];

//---------
// Tests
//---------
describe('Connect', () => {
  before(() => {
    // Setup the SDK client
    client = helpers.setupTestClient(process.env);
  })

  it('Should connect to a Lattice and make sure it is already paired.', async () => {
    continueTests = false;
    expect(process.env.DEVICE_ID).to.not.equal(null);
    await client.connect(process.env.DEVICE_ID);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);
    continueTests = true;
  })

  it('Should ask if the user wants to test a card with a non-exportable seed', async () => {
    // NOTE: non-exportable seeds were deprecated from the normal setup pathway in firmware v0.12.0
    const result = question(
      'Do you have a non-exportable SafeCard seed loaded and wish to continue? (Y/N) '
    );
    if (result.toLowerCase() !== 'y') {
      console.log('\nTest must be run with a SafeCard loaded with a non-exportable seed.\n');
      process.exit(1);
    }
  })
})

describe('Test non-exportable seed on SafeCard', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(
      true,
      'Unauthorized or critical failure. Aborting'
    );
    continueTests = false;
  })

  it('Should test that ETH transaction sigs differ and validate on secp256k1', async () => {
    // Test ETH transactions
    const tx = EthTxFactory.fromTxData({
      type: 2,
      maxFeePerGas: 1200000000,
      maxPriorityFeePerGas: 1200000000,
      nonce: 0,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 100,
      data: '0xdeadbeef',
    }, { 
      common: new Common({ chain: Chain.Mainnet, hardfork: Hardfork.London })
    })
    txReq = {
      data: {
        signerPath: DEFAULT_SIGNER,
        payload: tx.getMessageToSign(false),
        curveType: Constants.SIGNING.CURVES.SECP256K1,
        hashType: Constants.SIGNING.HASHES.KECCAK256,
        encodingType: Constants.SIGNING.ENCODINGS.EVM,
      }
    };
    // Validate that tx sigs are non-uniform
    const tx1Resp = await client.sign(txReq);
    const tx2Resp = await client.sign(txReq);
    const tx3Resp = await client.sign(txReq);
    const tx4Resp = await client.sign(txReq);
    const tx5Resp = await client.sign(txReq);
    // Check sig 1
    expect(helpers.getSigStr(tx1Resp, tx)).to.not.equal(helpers.getSigStr(tx2Resp, tx));
    expect(helpers.getSigStr(tx1Resp, tx)).to.not.equal(helpers.getSigStr(tx3Resp, tx));
    expect(helpers.getSigStr(tx1Resp, tx)).to.not.equal(helpers.getSigStr(tx4Resp, tx));
    expect(helpers.getSigStr(tx1Resp, tx)).to.not.equal(helpers.getSigStr(tx5Resp, tx));
    // Check sig 2
    expect(helpers.getSigStr(tx2Resp, tx)).to.not.equal(helpers.getSigStr(tx1Resp, tx));
    expect(helpers.getSigStr(tx2Resp, tx)).to.not.equal(helpers.getSigStr(tx3Resp, tx));
    expect(helpers.getSigStr(tx2Resp, tx)).to.not.equal(helpers.getSigStr(tx4Resp, tx));
    expect(helpers.getSigStr(tx2Resp, tx)).to.not.equal(helpers.getSigStr(tx5Resp, tx));
    // Check sig 3
    expect(helpers.getSigStr(tx3Resp, tx)).to.not.equal(helpers.getSigStr(tx1Resp, tx));
    expect(helpers.getSigStr(tx3Resp, tx)).to.not.equal(helpers.getSigStr(tx2Resp, tx));
    expect(helpers.getSigStr(tx3Resp, tx)).to.not.equal(helpers.getSigStr(tx4Resp, tx));
    expect(helpers.getSigStr(tx3Resp, tx)).to.not.equal(helpers.getSigStr(tx5Resp, tx));
    // Check sig 4
    expect(helpers.getSigStr(tx4Resp, tx)).to.not.equal(helpers.getSigStr(tx1Resp, tx));
    expect(helpers.getSigStr(tx4Resp, tx)).to.not.equal(helpers.getSigStr(tx2Resp, tx));
    expect(helpers.getSigStr(tx4Resp, tx)).to.not.equal(helpers.getSigStr(tx3Resp, tx));
    expect(helpers.getSigStr(tx4Resp, tx)).to.not.equal(helpers.getSigStr(tx5Resp, tx));
    // Check sig 5
    expect(helpers.getSigStr(tx5Resp, tx)).to.not.equal(helpers.getSigStr(tx1Resp, tx));
    expect(helpers.getSigStr(tx5Resp, tx)).to.not.equal(helpers.getSigStr(tx2Resp, tx));
    expect(helpers.getSigStr(tx5Resp, tx)).to.not.equal(helpers.getSigStr(tx3Resp, tx));
    expect(helpers.getSigStr(tx5Resp, tx)).to.not.equal(helpers.getSigStr(tx4Resp, tx));
    continueTests = true;
  })

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
    const msg1Resp = await client.sign(msgReq);
    const msg2Resp = await client.sign(msgReq);
    const msg3Resp = await client.sign(msgReq);
    const msg4Resp = await client.sign(msgReq);
    const msg5Resp = await client.sign(msgReq);
    // Check sig 1
    expect(helpers.getSigStr(msg1Resp)).to.not.equal(helpers.getSigStr(msg2Resp));
    expect(helpers.getSigStr(msg1Resp)).to.not.equal(helpers.getSigStr(msg3Resp));
    expect(helpers.getSigStr(msg1Resp)).to.not.equal(helpers.getSigStr(msg4Resp));
    expect(helpers.getSigStr(msg1Resp)).to.not.equal(helpers.getSigStr(msg5Resp));
    // Check sig 2
    expect(helpers.getSigStr(msg2Resp)).to.not.equal(helpers.getSigStr(msg1Resp));
    expect(helpers.getSigStr(msg2Resp)).to.not.equal(helpers.getSigStr(msg3Resp));
    expect(helpers.getSigStr(msg2Resp)).to.not.equal(helpers.getSigStr(msg4Resp));
    expect(helpers.getSigStr(msg2Resp)).to.not.equal(helpers.getSigStr(msg5Resp));
    // Check sig 3
    expect(helpers.getSigStr(msg3Resp)).to.not.equal(helpers.getSigStr(msg1Resp));
    expect(helpers.getSigStr(msg3Resp)).to.not.equal(helpers.getSigStr(msg2Resp));
    expect(helpers.getSigStr(msg3Resp)).to.not.equal(helpers.getSigStr(msg4Resp));
    expect(helpers.getSigStr(msg3Resp)).to.not.equal(helpers.getSigStr(msg5Resp));
    // Check sig 4
    expect(helpers.getSigStr(msg4Resp)).to.not.equal(helpers.getSigStr(msg1Resp));
    expect(helpers.getSigStr(msg4Resp)).to.not.equal(helpers.getSigStr(msg2Resp));
    expect(helpers.getSigStr(msg4Resp)).to.not.equal(helpers.getSigStr(msg3Resp));
    expect(helpers.getSigStr(msg4Resp)).to.not.equal(helpers.getSigStr(msg5Resp));
    // Check sig 5
    expect(helpers.getSigStr(msg5Resp)).to.not.equal(helpers.getSigStr(msg1Resp));
    expect(helpers.getSigStr(msg5Resp)).to.not.equal(helpers.getSigStr(msg2Resp));
    expect(helpers.getSigStr(msg5Resp)).to.not.equal(helpers.getSigStr(msg3Resp));
    expect(helpers.getSigStr(msg5Resp)).to.not.equal(helpers.getSigStr(msg4Resp));
    continueTests = true;
  });
})