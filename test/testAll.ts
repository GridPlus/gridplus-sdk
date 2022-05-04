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
import Common, { Chain, Hardfork } from '@ethereumjs/common';
import { TransactionFactory as EthTxFactory } from '@ethereumjs/tx';
import { expect } from 'chai';
import { question } from 'readline-sync';
import {
  getFwVersionConst,
  HARDENED_OFFSET,
  responseCodes,
  responseMsgs,
} from '../src/constants';
import { Constants } from '../src/index';
import { randomBytes } from '../src/util';
import helpers from './testUtil/helpers';

let client, id;
let continueTests = true;

describe('Connect and Pair', () => {
  before(() => {
    client = helpers.setupTestClient(process.env);
    if (process.env.DEVICE_ID) {
      id = process.env.DEVICE_ID;
    }
  });

  beforeEach(() => {
    expect(continueTests).to.equal(
      true,
      'Error found in prior test. Aborting.',
    );
    continueTests = false;
  });

  //-------------------------------------------
  // TESTS
  //-------------------------------------------
  it('Should connect to a Lattice', async () => {
    // Again, we assume that if an `id` has already been set, we are paired
    // with the hardcoded privkey above.
    if (!process.env.DEVICE_ID) {
      const _id = question('Please enter the ID of your test device: ');
      id = _id;
      const isPaired = await client.connect(id);
      expect(isPaired).to.equal(false);
      expect(client.isPaired).to.equal(false);
      expect(client.hasActiveWallet()).to.equal(false);
    }
    continueTests = true;
  });

  it('Should attempt to pair with pairing secret', async () => {
    if (!process.env.DEVICE_ID) {
      const secret = question('Please enter the pairing secret: ');
      const hasActiveWallet = await client.pair(secret);
      expect(hasActiveWallet).to.equal(true);
      expect(client.hasActiveWallet()).to.equal(true);
    }
    continueTests = true;
  });

  it('Should try to connect again but recognize the pairing already exists', async () => {
    const isPaired = await client.connect(id);
    expect(isPaired).to.equal(true);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);
    continueTests = true;
  });

  it('Should test SDK dehydration/rehydration', async () => {
    const addrData = {
      startPath: [
        helpers.BTC_PURPOSE_P2SH_P2WPKH,
        helpers.BTC_COIN,
        HARDENED_OFFSET,
        0,
        0,
      ],
      n: 1,
    };
    const addrs1 = await client.getAddresses(addrData);
    // Test a second client
    const stateData = client.getStateData();
    const clientTwo = helpers.setupTestClient(null, stateData);
    const addrs2 = await clientTwo.getAddresses(addrData);
    expect(JSON.stringify(addrs1)).to.equal(
      JSON.stringify(addrs2),
      'Client not rehydrated properly',
    );
    continueTests = true;
  });

  it('Should get addresses', async () => {
    const fwConstants = getFwVersionConst(client.fwVersion);
    const addrData = {
      startPath: [
        helpers.BTC_PURPOSE_P2SH_P2WPKH,
        helpers.BTC_COIN,
        HARDENED_OFFSET,
        0,
        0,
      ],
      n: 5,
    };
    // Bitcoin addresses
    // NOTE: The format of address will be based on the user's Lattice settings
    //       By default, this will be P2SH(P2WPKH), i.e. addresses that start with `3`
    let addrs;
    addrs = await client.getAddresses(addrData);
    expect(addrs.length).to.equal(5);
    expect(addrs[0][0]).to.equal('3');

    // Ethereum addresses
    addrData.startPath[0] = helpers.BTC_PURPOSE_P2PKH;
    addrData.startPath[1] = helpers.ETH_COIN;
    addrData.n = 1;
    addrs = await client.getAddresses(addrData);
    expect(addrs.length).to.equal(1);
    expect(addrs[0].slice(0, 2)).to.equal('0x');
    // If firmware supports it, try shorter paths
    if (fwConstants.flexibleAddrPaths) {
      const flexData = {
        startPath: [
          helpers.BTC_PURPOSE_P2PKH,
          helpers.ETH_COIN,
          HARDENED_OFFSET,
          0,
        ],
        n: 1,
      };
      addrs = await client.getAddresses(flexData);
      expect(addrs.length).to.equal(1);
      expect(addrs[0].slice(0, 2)).to.equal('0x');
    }
    // Should fail for non-EVM purpose and non-matching coin_type
    addrData.startPath[0] = helpers.BTC_PURPOSE_P2WPKH;
    addrData.n = 1;
    await client.getAddresses(addrData);
    // Switch to BTC coin. Should work now.
    addrData.startPath[1] = helpers.BTC_COIN;
    // Bech32
    addrs = await client.getAddresses(addrData);
    expect(addrs.length).to.equal(1);
    expect(addrs[0].slice(0, 3)).to.be.oneOf(['bc1']);
    addrData.startPath[0] = helpers.BTC_PURPOSE_P2SH_P2WPKH;
    addrData.n = 5;

    addrData.startPath[4] = 1000000;
    addrData.n = 3;
    addrs = await client.getAddresses(addrData);
    expect(addrs.length).to.equal(addrData.n);
    addrData.startPath[4] = 0;
    addrData.n = 1;

    // Unsupported purpose (m/<purpose>/)
    addrData.startPath[0] = 0; // Purpose 0 -- undefined
    try {
      addrs = await client.getAddresses(addrData);
    } catch (err) {
      expect(err).to.not.equal(null);
    }
    addrData.startPath[0] = helpers.BTC_PURPOSE_P2SH_P2WPKH;

    // Unsupported currency
    addrData.startPath[1] = HARDENED_OFFSET + 5; // 5' currency - aka unknown
    try {
      addrs = await client.getAddresses(addrData);
      throw new Error('Expected failure but got success.');
    } catch (err) {
      expect(err).to.not.equal(null);
    }
    addrData.startPath[1] = helpers.BTC_COIN;
    // Too many addresses (n>10)
    addrData.n = 11;
    try {
      addrs = await client.getAddresses(addrData);
      throw new Error('Expected failure but got success.');
    } catch (err) {
      expect(err).to.not.equal(null);
    }
    continueTests = true;
  });

  it('Should sign Ethereum transactions', async () => {
    if (client.fwVersion.major === 0 && client.fwVersion.minor < 15) {
      console.warn('Please update firmware. Skipping ETH signing tests.');
      continueTests = true;
      return;
    }
    const fwConstants = getFwVersionConst(client.fwVersion);
    const signerPath = [
      helpers.BTC_PURPOSE_P2PKH,
      helpers.ETH_COIN,
      HARDENED_OFFSET,
      0,
      0,
    ];
    const common = new Common({
      chain: Chain.Mainnet,
      hardfork: Hardfork.London,
    });
    let txData = {
      type: 1,
      gasPrice: 1200000000,
      nonce: 0,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 1000000000000,
      data: '0x17e914679b7e160613be4f8c2d3203d236286d74eb9192f6d6f71b9118a42bb033ccd8e8',
    };
    let tx = EthTxFactory.fromTxData(txData, { common });
    const req = {
      data: {
        signerPath,
        payload: tx.getMessageToSign(false),
        curveType: Constants.SIGNING.CURVES.SECP256K1,
        hashType: Constants.SIGNING.HASHES.KECCAK256,
        encodingType: Constants.SIGNING.ENCODINGS.EVM,
      },
    };

    // Legacy transaction
    await client.sign(req);

    // Switch to newer type
    txData = {
      type: 2,
      maxFeePerGas: 1200000000,
      maxPriorityFeePerGas: 1200000000,
      nonce: 0,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 1000000000000,
      data: '0x17e914679b7e160613be4f8c2d3203d236286d74eb9192f6d6f71b9118a42bb033ccd8e8',
    };

    // Test data range
    const maxDataSz =
      fwConstants.ethMaxDataSz +
      fwConstants.extraDataMaxFrames * fwConstants.extraDataFrameSz;
    // NOTE: This will display a prehashed payload for bridged general signing
    // requests because `ethMaxDataSz` represents the `data` field for legacy
    // requests, but it represents the entire payload for general signing requests.
    txData.data = randomBytes(maxDataSz);
    tx = EthTxFactory.fromTxData(txData, { common });
    req.data.payload = tx.getMessageToSign(false);
    await client.sign(req);
    question(
      'Please REJECT the next request if the warning screen displays. Press enter to continue.',
    );
    req.data.data = randomBytes(maxDataSz + 1);
    tx = EthTxFactory.fromTxData(txData, { common });
    req.data.payload = tx.getMessageToSign(false);
    let rejected = false;
    try {
      await client.sign(req);
    } catch (err) {
      rejected =
        err.message.indexOf(responseMsgs[responseCodes.RESP_ERR_USER_DECLINED]) > -1;
    } finally {
      expect(rejected).to.equal(true);
    }
    continueTests = true;
  });

  it('Should sign legacy Bitcoin inputs', async () => {
    const txData = {
      prevOuts: [
        {
          txHash:
            '6e78493091f80d89a92ae3152df7fbfbdc44df09cf01a9b76c5113c02eaf2e0f',
          value: 10000,
          index: 1,
          signerPath: [
            helpers.BTC_PURPOSE_P2SH_P2WPKH,
            helpers.BTC_TESTNET_COIN,
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
        helpers.BTC_PURPOSE_P2SH_P2WPKH,
        helpers.BTC_TESTNET_COIN,
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
    expect(sigResp.tx).to.not.equal(null);
    expect(sigResp.txHash).to.not.equal(null);
    continueTests = true;
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
            helpers.BTC_PURPOSE_P2SH_P2WPKH,
            helpers.BTC_TESTNET_COIN,
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
        helpers.BTC_PURPOSE_P2SH_P2WPKH,
        helpers.BTC_TESTNET_COIN,
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
    expect(sigResp.tx).to.not.equal(null);
    expect(sigResp.txHash).to.not.equal(null);
    continueTests = true;
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
            helpers.BTC_PURPOSE_P2SH_P2WPKH,
            helpers.BTC_TESTNET_COIN,
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
        helpers.BTC_PURPOSE_P2SH_P2WPKH,
        helpers.BTC_TESTNET_COIN,
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
    expect(sigResp.tx).to.not.equal(null);
    expect(sigResp.txHash).to.not.equal(null);
    continueTests = true;
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
            helpers.BTC_PURPOSE_P2WPKH,
            helpers.BTC_TESTNET_COIN,
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
        helpers.BTC_PURPOSE_P2WPKH,
        helpers.BTC_TESTNET_COIN,
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
    expect(sigResp.tx).to.not.equal(null);
    expect(sigResp.txHash).to.not.equal(null);
    expect(sigResp.changeRecipient.slice(0, 2)).to.equal('tb');
  });

  /*
  This feature does not work with general signing requests and will
  need to be deprecated in its current form and replaced with handlers
  in decoder utils
  it('Should test permission limits', async () => {
    try {
      continueTests = false;
      // Fail to add permissions where limit or window is 0
      const opts = {
        currency: 'ETH',
        timeWindow: 0,
        limit: 5,
        decimals: 18,
        asset: null,
      };
      try {
        await client.addPermissionV0(opts);
      } catch (err) {
        expect(err).to.equal('Time window and spending limit must be positive.');
      }
      try {
        opts.timeWindow = 300;
        opts.limit = 0;
        await client.addPermissionV0(opts);
      } catch (err) {
        expect(err).to.equal('Time window and spending limit must be positive.');
      }
      // Add a 5-minute permission allowing 5 wei to be spent
      opts.timeWindow = 300;
      opts.limit = 5;
      await client.addPermissionV0(opts);
      // Fail to add the same permission again
      try {
        await client.addPermissionV0(opts);
      } catch (err) {
        const expectedCode = responseCodes.RESP_ERR_ALREADY;
        expect(
          err.message.indexOf(responseMsgs[expectedCode])
        ).to.be.greaterThan(-1);
      }
      // Spend 2 wei
      const txData = {
        nonce: 0,
        gasPrice: 1200000000,
        gasLimit: 50000,
        to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
        value: 2,
        data: null,
      };
      const req = {
        currency: 'ETH',
        data: {
          signerPath: [
            helpers.BTC_PURPOSE_P2PKH,
            helpers.ETH_COIN,
            HARDENED_OFFSET,
            0,
            0,
          ],
          ...txData,
          chainId: 4,
        },
      };
      // Test the spending limit. The first two requests should auto-sign.
      // Spend once -> 3 wei left
      let signResp = await client.sign(req);
      expect(signResp.tx).to.not.equal(null);
      // Spend again -> 1 wei left
      signResp = await client.sign(req);
      expect(signResp.tx).to.not.equal(null);
      // Spend again. This time it should fail to load the permission
      question(
        'Please REJECT the following transaction request. Press enter to continue.'
      );
      try {
        signResp = await client.sign(req);
        expect(signResp.tx).to.equal(null);
      } catch (err) {
        const expectedCode = responseCodes.RESP_ERR_USER_DECLINED;
        expect(
          err.message.indexOf(responseMsgs[expectedCode])
        ).to.be.greaterThan(-1);
      }
      // Spend 1 wei this time. This should be allowed by the permission.
      req.data.value = 1;
      signResp = await client.sign(req);
      expect(signResp.tx).to.not.equal(null);
      continueTests = true;
    } catch (err) {
      expect(err).to.equal(null, err);
    }
  });
  */
});
