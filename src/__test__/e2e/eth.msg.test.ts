/** Tests for ETH transaction edge cases
 * NOTE: You must run the following BEFORE executing these tests:
 *
 * 1. Pair with the device once. This will ask you for your deviceID, which will act as a salt for
 *    your pairing:
 *
 *    env REUSE_KEY=1 npm run test
 *
 * 2. Connect with the same deviceID you specfied in 1:
 *
 *    env DEVICE_ID='<your_device_id>' npm test
 *
 * After you do the above, you can run this test with `npm run test-eth`
 *
 * NOTE: It is highly suggested that you set `AUTO_SIGN_DEV_ONLY=1` in the firmware root
 *        CMakeLists.txt file (for dev units)
 */

import { HARDENED_OFFSET } from '../../constants';
import { randomBytes } from '../../util';
import { buildEthMsgReq, buildRandomMsg } from '../utils/builders';
import { getN } from '../utils/getters';
import { initializeClient } from '../utils/initializeClient';
import { runEthMsg } from '../utils/runners';

const numRandom = getN() ? getN() : 20; // Number of random tests to conduct

describe('ETH Messages', () => {
  const client = initializeClient();

  describe('Test ETH personalSign', function () {
    it('Should throw error when message contains non-ASCII characters', async () => {
      const protocol = 'signPersonal';
      const msg = '⚠️';
      const msg2 = 'ASCII plus ⚠️';
      await expect(client.sign(buildEthMsgReq(msg, protocol))).rejects.toThrow(
        /Lattice can only display ASCII/,
      );
      await expect(client.sign(buildEthMsgReq(msg2, protocol))).rejects.toThrow(
        /Lattice can only display ASCII/,
      );
    });

    it('Should test ASCII buffers', async () => {
      await runEthMsg(
        buildEthMsgReq(Buffer.from('i am an ascii buffer'), 'signPersonal'),
        client,
      );
      await runEthMsg(
        buildEthMsgReq(Buffer.from('{\n\ttest: foo\n}'), 'signPersonal'),
        client,
      );
    });

    it('Should test hex buffers', async () => {
      await runEthMsg(
        buildEthMsgReq(Buffer.from('abcdef', 'hex'), 'signPersonal'),
        client,
      );
    });

    it('Should test a message that needs to be prehashed', async () => {
      await runEthMsg(
        buildEthMsgReq(randomBytes(4000), 'signPersonal'),
        client,
      );
    });

    it('Msg: sign_personal boundary conditions and auto-rejected requests', async () => {
      const protocol = 'signPersonal';
      const fwConstants = client.getFwConstants();
      // `personal_sign` requests have a max size smaller than other requests because a header
      // is displayed in the text region of the screen. The size of this is captured
      // by `fwConstants.personalSignHeaderSz`.
      const maxMsgSz =
        fwConstants.ethMaxMsgSz +
        fwConstants.personalSignHeaderSz +
        fwConstants.extraDataMaxFrames * fwConstants.extraDataFrameSz;
      const maxValid = `0x${randomBytes(maxMsgSz).toString('hex')}`;
      const minInvalid = `0x${randomBytes(maxMsgSz + 1).toString('hex')}`;
      const zeroInvalid = '0x';
      // The largest non-hardened index which will take the most chars to print
      const x = HARDENED_OFFSET - 1;
      // Okay sooo this is a bit awkward. We have to use a known coin_type here (e.g. ETH)
      // or else firmware will return an error, but the maxSz is based on the max length
      // of a path, which is larger than we can actually print.
      // I guess all this tests is that the first one is shown in plaintext while the second
      // one (which is too large) gets prehashed.
      const largeSignPath = [x, HARDENED_OFFSET + 60, x, x, x] as SigningPath;
      await runEthMsg(
        buildEthMsgReq(maxValid, protocol, largeSignPath),
        client,
      );
      await runEthMsg(
        buildEthMsgReq(minInvalid, protocol, largeSignPath),
        client,
      );
      // Using a zero length payload should auto-reject
      await expect(
        client.sign(buildEthMsgReq(zeroInvalid, protocol)),
      ).rejects.toThrow(/Invalid Request/);
    });

    describe(`Test ${numRandom} random payloads`, () => {
      for (let i = 0; i < numRandom; i++) {
        it(`Payload: ${i}`, async () => {
          await runEthMsg(
            buildEthMsgReq(
              buildRandomMsg('signPersonal', client),
              'signPersonal',
            ),
            client,
          );
        });
      }
    });
  });

  describe('Test ETH EIP712', function () {
    it('Should test a message that needs to be prehashed', async () => {
      const msg = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
          ],
          dYdX: [
            { type: 'string', name: 'action' },
            { type: 'string', name: 'onlySignOn' },
          ],
        },
        domain: {
          name: 'dYdX',
          version: '1.0',
          chainId: '1',
        },
        primaryType: 'dYdX',
        message: {
          action: 'dYdX STARK Key',
          onlySignOn: randomBytes(4000).toString('hex'),
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test an example from Blur NFT w/ 0 fees', async () => {
      const msg = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'host', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Fee: [
            { name: 'rate', type: 'uint256' },
            { name: 'recipient', type: 'address' },
          ],
          Message: [
            { name: 'trader', type: 'address' },
            { name: 'side', type: 'uint256' },
            { name: 'matchingPolicy', type: 'address' },
            { name: 'collection', type: 'address' },
            { name: 'tokenId', type: 'uint256' },
            { name: 'amount', type: 'uint256' },
            { name: 'paymentToken', type: 'address' },
            { name: 'price', type: 'uint256' },
            { name: 'listingTime', type: 'uint256' },
            { name: 'expirationTime', type: 'uint256' },
            { name: 'salt', type: 'uint256' },
            { name: 'extraParams', type: 'bytes' },
            { name: 'nonce', type: 'uint256' },
            { name: 'fees', type: 'Fee[]' },
          ],
        },
        domain: {
          name: 'Blur',
          verifyingContract: '0x0',
          version: '1',
          chainId: '',
          host: '',
        },
        primaryType: 'Message',
        message: {
          trader: '0xfc92dff6d9519c79782e0d345915c441cf5ac41f',
          side: '1',
          matchingPolicy: '0x00000000006411739da1c40b106f8511de5d1fac',
          collection: '0x7a15b36cb834aea88553de69077d3777460d73ac',
          tokenId:
            '5280336779268220421569573059971679349075200194886069432279714075018412552192',
          amount: '1',
          paymentToken: '0x0000000000000000000000000000000000000000',
          price: '990000000000000000',
          listingTime: '1666370346',
          expirationTime: '1666975146',
          salt: '64535264870076277194623607183653108264',
          extraParams: '0x',
          nonce: '0',
          fees: [
            // { rate: 1, recipient: '0x00000000006411739da1c40b106f8511de5d1fac'}
          ],
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test simple dydx example', async () => {
      const msg = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
          ],
          dYdX: [
            { type: 'string', name: 'action' },
            { type: 'string', name: 'onlySignOn' },
          ],
        },
        domain: {
          name: 'dYdX',
          version: '1.0',
          chainId: '1',
        },
        primaryType: 'dYdX',
        message: {
          action: 'dYdX STARK Key',
          onlySignOn: 'https://trade.dydx.exchange',
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test a Loopring message with non-standard numerical type', async () => {
      const msg = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          AccountUpdate: [
            { name: 'owner', type: 'address' },
            { name: 'accountID', type: 'uint32' },
            { name: 'feeTokenID', type: 'uint16' },
            { name: 'maxFee', type: 'uint96' },
            { name: 'publicKey', type: 'uint256' },
            { name: 'validUntil', type: 'uint32' },
            { name: 'nonce', type: 'uint32' },
          ],
        },
        primaryType: 'AccountUpdate',
        domain: {
          name: 'Loopring Protocol',
          version: '3.6.0',
          chainId: 1,
          verifyingContract: '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4',
        },
        message: {
          owner: '0x8c3b776bdac9a7a4facc3cc20cdb40832bff9005',
          accountID: 32494,
          feeTokenID: 0,
          maxFee: 100,
          publicKey:
            '11413934541425201845815969801249874136651857829494005371571206042985258823663',
          validUntil: 1631655383,
          nonce: 0,
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test Vertex message', async () => {
      const msg = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Order: [
            { name: 'sender', type: 'bytes32' },
            { name: 'priceX18', type: 'int128' },
            { name: 'amount', type: 'int128' },
            { name: 'expiration', type: 'uint64' },
            { name: 'nonce', type: 'uint64' },
          ],
        },
        primaryType: 'Order',
        domain: {
          name: 'Vertex',
          version: '0.0.1',
          chainId: '42161',
          verifyingContract: '0xf03f457a30e598d5020164a339727ef40f2b8fbc',
        },
        message: {
          sender:
            '0x841fe4876763357975d60da128d8a54bb045d76a64656661756c740000000000',
          priceX18: '28898000000000000000000',
          amount: '-10000000000000000',
          expiration: '4611687701117784255',
          nonce: '1764428860167815857',
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test a large 1inch transaction', async () => {
      const msg = {
        domain: {
          chainId: 137,
          name: '1inch Limit Order Protocol',
          verifyingContract: '0xb707d89d29c189421163515c59e42147371d6857',
          version: '1',
        },
        message: {
          getMakerAmount:
            '0xf4a215c30000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000018fae27693b40000',
          getTakerAmount:
            '0x296637bf0000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000018fae27693b40000',
          interaction: '0x',
          makerAsset: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
          makerAssetData:
            '0x23b872dd0000000000000000000000003e3e2ccdd7bae6bbd4a64e8d16ca8842061335eb00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a7640000',
          permit: '0x',
          predicate:
            '0x961d5b1e000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000b707d89d29c189421163515c59e42147371d6857000000000000000000000000b707d89d29c189421163515c59e42147371d68570000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000044cf6fc6e30000000000000000000000003e3e2ccdd7bae6bbd4a64e8d16ca8842061335eb000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002463592c2b00000000000000000000000000000000000000000000000000000000613e28e500000000000000000000000000000000000000000000000000000000',
          salt: '885135864076',
          takerAsset: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
          takerAssetData:
            '0x23b872dd00000000000000000000000000000000000000000000000000000000000000000000000000000000000000003e3e2ccdd7bae6bbd4a64e8d16ca8842061335eb00000000000000000000000000000000000000000000000018fae27693b40000',
        },
        primaryType: 'Order',
        types: {
          EIP712Domain: [
            {
              name: 'name',
              type: 'string',
            },
            {
              name: 'version',
              type: 'string',
            },
            {
              name: 'chainId',
              type: 'uint256',
            },
            {
              name: 'verifyingContract',
              type: 'address',
            },
          ],
          Order: [
            {
              name: 'salt',
              type: 'uint256',
            },
            {
              name: 'makerAsset',
              type: 'address',
            },
            {
              name: 'takerAsset',
              type: 'address',
            },
            {
              name: 'makerAssetData',
              type: 'bytes',
            },
            {
              name: 'takerAssetData',
              type: 'bytes',
            },
            {
              name: 'getMakerAmount',
              type: 'bytes',
            },
            {
              name: 'getTakerAmount',
              type: 'bytes',
            },
            {
              name: 'predicate',
              type: 'bytes',
            },
            {
              name: 'permit',
              type: 'bytes',
            },
            {
              name: 'interaction',
              type: 'bytes',
            },
          ],
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test an example with 0 values', async () => {
      const msg = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'host', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Test: [
            { name: 'owner', type: 'string' },
            { name: 'testArray', type: 'uint256[]' },
          ],
        },
        domain: {
          name: 'Opensea on Matic',
          verifyingContract: '0x0',
          version: '1',
          chainId: '',
          host: '',
        },
        primaryType: 'Test',
        message: {
          owner: '0x56626bd0d646ce9da4a12403b2c1ba00fb9e1c43',
          testArray: [],
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test canonical EIP712 example', async () => {
      const msg = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Person: [
            { name: 'name', type: 'string' },
            { name: 'wallet', type: 'address' },
          ],
          Mail: [
            { name: 'from', type: 'Person' },
            { name: 'to', type: 'Person' },
            { name: 'contents', type: 'string' },
          ],
        },
        primaryType: 'Mail',
        domain: {
          name: 'Ether Mail',
          version: '1',
          chainId: 12,
          verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
        },
        message: {
          from: {
            name: 'Cow',
            wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
          },
          to: {
            name: 'Bob',
            wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
          },
          contents: 'foobar',
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test canonical EIP712 example with 2nd level nesting', async () => {
      const msg = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Wallet: [
            { name: 'address', type: 'address' },
            { name: 'balance', type: 'uint256' },
          ],
          Person: [
            { name: 'name', type: 'string' },
            { name: 'wallet', type: 'Wallet' },
          ],
          Mail: [
            { name: 'from', type: 'Person' },
            { name: 'to', type: 'Person' },
            { name: 'contents', type: 'string' },
          ],
        },
        primaryType: 'Mail',
        domain: {
          name: 'Ether Mail',
          version: '1',
          chainId: 12,
          verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
        },
        message: {
          from: {
            name: 'Cow',
            wallet: {
              address: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
              balance: '0x12345678',
            },
          },
          to: {
            name: 'Bob',
            wallet: {
              address: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
              balance: '0xabcdef12',
            },
          },
          contents: 'foobar',
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test canonical EIP712 example with 3rd level nesting', async () => {
      const msg = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Wallet: [
            { name: 'address', type: 'address' },
            { name: 'balance', type: 'Balance' },
          ],
          Person: [
            { name: 'name', type: 'string' },
            { name: 'wallet', type: 'Wallet' },
          ],
          Mail: [
            { name: 'from', type: 'Person' },
            { name: 'to', type: 'Person' },
            { name: 'contents', type: 'string' },
          ],
          Balance: [
            { name: 'value', type: 'uint256' },
            { name: 'currency', type: 'string' },
          ],
        },
        primaryType: 'Mail',
        domain: {
          name: 'Ether Mail',
          version: '1',
          chainId: 12,
          verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
        },
        message: {
          from: {
            name: 'Cow',
            wallet: {
              address: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
              balance: {
                value: '0x12345678',
                currency: 'ETH',
              },
            },
          },
          to: {
            name: 'Bob',
            wallet: {
              address: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
              balance: {
                value: '0xabcdef12',
                currency: 'UNI',
              },
            },
          },
          contents: 'foobar',
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test canonical EIP712 example with 3rd level nesting and params in a different order', async () => {
      const msg = {
        types: {
          Balance: [
            { name: 'value', type: 'uint256' },
            { name: 'currency', type: 'string' },
          ],
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Person: [
            { name: 'name', type: 'string' },
            { name: 'wallet', type: 'Wallet' },
          ],
          Wallet: [
            { name: 'address', type: 'address' },
            { name: 'balance', type: 'Balance' },
          ],
          Mail: [
            { name: 'from', type: 'Person' },
            { name: 'to', type: 'Person' },
            { name: 'contents', type: 'string' },
          ],
        },
        primaryType: 'Mail',
        domain: {
          name: 'Ether Mail',
          version: '1',
          chainId: 12,
          verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
        },
        message: {
          contents: 'foobar',
          from: {
            name: 'Cow',
            wallet: {
              address: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
              balance: {
                value: '0x12345678',
                currency: 'ETH',
              },
            },
          },
          to: {
            name: 'Bob',
            wallet: {
              address: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
              balance: {
                value: '0xabcdef12',
                currency: 'UNI',
              },
            },
          },
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test a payload with an array type', async () => {
      const msg = {
        types: {
          EIP712Domain: [{ name: 'name', type: 'string' }],
          UserVotePayload: [
            {
              name: 'allocations',
              type: 'UserVoteAllocationItem[]',
            },
          ],
          UserVoteAllocationItem: [
            {
              name: 'reactorKey',
              type: 'bytes32',
            },
            {
              name: 'amount',
              type: 'uint256',
            },
          ],
        },
        primaryType: 'UserVotePayload',
        domain: {
          name: 'Tokemak Voting',
          version: '1',
          chainId: 1,
          verifyingContract: '0x4495982ea5ed9c1b7cec37434cbf930b9472e823',
        },
        message: {
          allocations: [
            {
              reactorKey:
                '0x6f686d2d64656661756c74000000000000000000000000000000000000000000',
              amount: '1',
            },
            {
              reactorKey:
                '0x6f686d2d64656661756c74000000000000000000000000000000000000000000',
              amount: '2',
            },
          ],
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test multiple array types', async () => {
      const msg = {
        types: {
          EIP712Domain: [{ name: 'name', type: 'string' }],
          UserVotePayload: [
            {
              name: 'integer',
              type: 'uint256',
            },
            {
              name: 'allocations',
              type: 'UserVoteAllocationItem[]',
            },
            {
              name: 'dummy',
              type: 'uint256',
            },
            {
              name: 'integerArray',
              type: 'uint256[]',
            },
          ],
          UserVoteAllocationItem: [
            {
              name: 'reactorKey',
              type: 'bytes32',
            },
            {
              name: 'amount',
              type: 'uint256',
            },
          ],
        },
        primaryType: 'UserVotePayload',
        domain: {
          name: 'Tokemak Voting',
        },
        message: {
          integer: 56,
          allocations: [
            {
              reactorKey:
                '0x6f686d2d64656661756c74000000000000000000000000000000000000000000',
              amount: '1',
            },
            {
              reactorKey:
                '0x6f686d2d64656661756c74000000000000000000000000000000000000000000',
              amount: '2',
            },
          ],
          dummy: 52,
          integerArray: [1, 2, 3],
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test a nested array', async () => {
      const msg = {
        types: {
          EIP712Domain: [{ name: 'name', type: 'string' }],
          UserVotePayload: [
            {
              name: 'allocations',
              type: 'UserVoteAllocationItem[]',
            },
          ],
          UserVoteAllocationItem: [
            {
              name: 'reactorKey',
              type: 'bytes32',
            },
            {
              name: 'amount',
              type: 'uint256[]',
            },
          ],
        },
        primaryType: 'UserVotePayload',
        domain: {
          name: 'Tokemak Voting',
        },
        message: {
          allocations: [
            {
              reactorKey:
                '0x6f686d2d64656661756c74000000000000000000000000000000000000000000',
              amount: ['1', '2'],
            },
            {
              reactorKey:
                '0x6f686d2d64656661756c74000000000000000000000000000000000000000000',
              amount: ['2', '3'],
            },
          ],
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test a nested array of custom type', async () => {
      const msg = {
        types: {
          EIP712Domain: [{ name: 'name', type: 'string' }],
          DummyThing: [
            {
              name: 'foo',
              type: 'bytes',
            },
          ],
          UserVotePayload: [
            {
              name: 'test',
              type: 'string',
            },
            {
              name: 'athing',
              type: 'uint32',
            },
            {
              name: 'allocations',
              type: 'UserVoteAllocationItem[]',
            },
          ],
          UserVoteAllocationItem: [
            {
              name: 'reactorKey',
              type: 'bytes32',
            },
            {
              name: 'dummy',
              type: 'DummyThing[]',
            },
          ],
        },
        primaryType: 'UserVotePayload',
        domain: {
          name: 'Tokemak Voting',
        },
        message: {
          athing: 5,
          test: 'hello',
          allocations: [
            {
              reactorKey:
                '0x6f686d2d64656661756c74000000000000000000000000000000000000000000',
              dummy: [
                {
                  foo: '0xabcd',
                },
                {
                  foo: '0x123456',
                },
              ],
            },
            {
              reactorKey:
                '0x6f686d2d64656661756c74000000000000000000000000000000000000000000',
              dummy: [
                {
                  foo: '0xdeadbeef',
                },
                {
                  foo: '0x',
                },
              ],
            },
          ],
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test a bunch of EIP712 data types', async () => {
      const msg = {
        types: {
          EIP712Domain: [
            {
              name: 'name',
              type: 'string',
            },
            {
              name: 'version',
              type: 'string',
            },
            {
              name: 'chainId',
              type: 'uint256',
            },
            {
              name: 'verifyingContract',
              type: 'address',
            },
          ],
          PrimaryStuff: [
            { name: 'UINT8', type: 'uint8' },
            { name: 'UINT16', type: 'uint16' },
            { name: 'UINT32', type: 'uint32' },
            { name: 'UINT64', type: 'uint64' },
            { name: 'UINT256', type: 'uint256' },
            { name: 'BYTES1', type: 'bytes1' },
            { name: 'BYTES5', type: 'bytes5' },
            { name: 'BYTES7', type: 'bytes7' },
            { name: 'BYTES12', type: 'bytes12' },
            { name: 'BYTES16', type: 'bytes16' },
            { name: 'BYTES20', type: 'bytes20' },
            { name: 'BYTES21', type: 'bytes21' },
            { name: 'BYTES31', type: 'bytes31' },
            { name: 'BYTES32', type: 'bytes32' },
            { name: 'BYTES', type: 'bytes' },
            { name: 'STRING', type: 'string' },
            { name: 'BOOL', type: 'bool' },
            { name: 'ADDRESS', type: 'address' },
          ],
        },
        primaryType: 'PrimaryStuff',
        domain: {
          name: 'Muh Domainz',
          version: '1',
          chainId: 270,
          verifyingContract: '0xcc9c93cef8c70a7b46e32b3635d1a746ee0ec5b4',
        },
        message: {
          UINT8: '0xab',
          UINT16: '0xb1d7',
          UINT32: '0x80bb335b',
          UINT64: '0x259528d5bc',
          UINT256: '0xad2693f24ba507750d1763ebae3661c07504',
          BYTES1: '0x2f',
          BYTES5: '0x9485269fa5',
          BYTES7: '0xc4e8d65ce8c3cf',
          BYTES12: '0x358eb7b28e8e1643e7c4737f',
          BYTES16: '0x7ace034ab088fdd434f1e817f32171a0',
          BYTES20: '0x4ab51f2d5bfdc0f1b96f83358d5f356c98583573',
          BYTES21: '0x6ecdc19b30c7fa712ba334458d77377b6a586bbab5',
          BYTES31:
            '0x06c21824a98643f96643b3220962f441210b007f4c19dfdf0dea53d097fc28',
          BYTES32:
            '0x59cfcbf35256451756b02fa644d3d0748bd98f5904febf3433e6df19b4df7452',
          BYTES:
            '0x0354b2c449772905b2598a93f5da69962f0444e0a6e2429e8f844f1011446f6fe81815846fb6ebe2d213968d1f8532749735f5702f565db0429b2fe596d295d9c06241389fe97fb2f3b91e1e0f2d978fb26e366737451f1193097bd0a2332e0bfc0cdb631005',
          STRING: 'I am a string hello there human',
          BOOL: true,
          ADDRESS: '0x078a8d6eba928e7ea787ed48f71c5936aed4625d',
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test a payload with a nested type in multiple nesting levels', async () => {
      const msg = {
        types: {
          EIP712Domain: [
            {
              name: 'name',
              type: 'string',
            },
          ],
          PrimaryType: [
            {
              name: 'one',
              type: 'Type1',
            },
            {
              name: 'zero',
              type: 'Type0',
            },
          ],
          Type1: [
            {
              name: '1s',
              type: 'string',
            },
          ],
          Type0: [
            {
              name: 'one',
              type: 'Type1',
            },
          ],
        },
        primaryType: 'PrimaryType',
        domain: {
          name: 'Domain',
        },
        message: {
          one: {
            '1s': 'nestedOne',
          },
          zero: {
            one: {
              '1s': 'nestedTwo',
            },
          },
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test a payload that requires use of extraData frames', async () => {
      const msg = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Wallet: [
            { name: 'address', type: 'address' },
            { name: 'balance', type: 'Balance' },
          ],
          Person: [
            { name: 'name', type: 'string' },
            { name: 'wallet', type: 'Wallet' },
          ],
          Mail: [
            { name: 'from', type: 'Person' },
            { name: 'to', type: 'Person' },
            { name: 'contents', type: 'string' },
          ],
          Balance: [
            { name: 'value', type: 'uint256' },
            { name: 'currency', type: 'string' },
          ],
        },
        primaryType: 'Mail',
        domain: {
          name: 'Ether Mail',
          version: '1',
          chainId: 12,
          verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
        },
        message: {
          from: {
            name: 'Cow',
            wallet: {
              address: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
              balance: {
                value: '0x12345678',
                currency: 'ETH',
              },
            },
          },
          to: {
            name: 'Bob',
            wallet: {
              address: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
              balance: {
                value: '0xabcdef12',
                currency: 'UNI',
              },
            },
          },
          contents:
            'stupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimesstupidlylongstringthatshouldstretchintomultiplepageswhencopiedmanytimes',
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test a message with very large types', async () => {
      const msg = {
        types: {
          EIP712Domain: [
            {
              name: 'name',
              type: 'string',
            },
            {
              name: 'version',
              type: 'string',
            },
            {
              name: 'chainId',
              type: 'uint256',
            },
            {
              name: 'verifyingContract',
              type: 'address',
            },
          ],
          Order: [
            {
              name: 'exchange',
              type: 'address',
            },
            {
              name: 'maker',
              type: 'address',
            },
            {
              name: 'taker',
              type: 'address',
            },
            {
              name: 'makerRelayerFee',
              type: 'uint256',
            },
            {
              name: 'takerRelayerFee',
              type: 'uint256',
            },
            {
              name: 'makerProtocolFee',
              type: 'uint256',
            },
            {
              name: 'takerProtocolFee',
              type: 'uint256',
            },
            {
              name: 'feeRecipient',
              type: 'address',
            },
            {
              name: 'feeMethod',
              type: 'uint8',
            },
            {
              name: 'side',
              type: 'uint8',
            },
            {
              name: 'saleKind',
              type: 'uint8',
            },
            {
              name: 'target',
              type: 'address',
            },
            {
              name: 'howToCall',
              type: 'uint8',
            },
            {
              name: 'calldata',
              type: 'bytes',
            },
            {
              name: 'replacementPattern',
              type: 'bytes',
            },
            {
              name: 'staticTarget',
              type: 'address',
            },
            {
              name: 'staticExtradata',
              type: 'bytes',
            },
            {
              name: 'paymentToken',
              type: 'address',
            },
            {
              name: 'basePrice',
              type: 'uint256',
            },
            {
              name: 'extra',
              type: 'uint256',
            },
            {
              name: 'listingTime',
              type: 'uint256',
            },
            {
              name: 'expirationTime',
              type: 'uint256',
            },
            {
              name: 'salt',
              type: 'uint256',
            },
            {
              name: 'nonce',
              type: 'uint256',
            },
          ],
        },
        domain: {
          name: 'Wyvern Exchange Contract',
          version: '2.3',
          chainId: 1,
          verifyingContract: '0x7f268357a8c2552623316e2562d90e642bb538e5',
        },
        primaryType: 'Order',
        message: {
          maker: '0x44fa5d521a02db7ce5a88842a6842496f84009bc',
          exchange: '0x7f268357a8c2552623316e2562d90e642bb538e5',
          taker: '0x0000000000000000000000000000000000000000',
          makerRelayerFee: '750',
          takerRelayerFee: '0',
          makerProtocolFee: '0',
          takerProtocolFee: '0',
          feeRecipient: '0x5b3256965e7c3cf26e11fcaf296dfc8807c01073',
          feeMethod: 1,
          side: 1,
          saleKind: 0,
          target: '0xbaf2127b49fc93cbca6269fade0f7f31df4c88a7',
          howToCall: 1,
          calldata:
            '0xfb16a59500000000000000000000000044fa5d521a02db7ce5a88842a6842496f84009bc000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001a9f037d4cd7da318ab097a47acd4dea3abc083000000000000000000000000000000000000000000000000000000000000028a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000000',
          replacementPattern:
            '0x000000000000000000000000000000000000000000000000000000000000000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
          staticTarget: '0x0000000000000000000000000000000000000000',
          staticExtradata: '0x',
          paymentToken: '0x0000000000000000000000000000000000000000',
          basePrice: '1000000000000000000',
          extra: '0',
          listingTime: '1645233344',
          expirationTime: '1645838240',
          salt: '35033335384310326785897317545538185126505283328747281434561962939625063440824',
          nonce: 0,
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    it('Should test random edge case #1', async () => {
      // This was a randomly generated payload which caused an edge case.
      // It has been slimmed down but definition structure is preserved.
      const msg = {
        types: {
          EIP712Domain: [
            {
              name: 'name',
              type: 'string',
            },
            {
              name: 'version',
              type: 'string',
            },
            {
              name: 'chainId',
              type: 'uint256',
            },
            {
              name: 'verifyingContract',
              type: 'address',
            },
          ],
          Primary_Click: [
            {
              name: 'utility',
              type: 'Expose',
            },
            {
              name: 'aisle',
              type: 'Cancel',
            },
            {
              name: 'gym',
              type: 'Razor',
            },
            {
              name: 'drift_patch_cable_bi',
              type: 'bytes1',
            },
          ],
          Expose: [
            {
              name: 'favorite',
              type: 'bytes21',
            },
          ],
          Cancel: [
            {
              name: 'clever',
              type: 'uint200',
            },
          ],
          Razor: [
            {
              name: 'private',
              type: 'bytes2',
            },
          ],
        },
        primaryType: 'Primary_Click',
        domain: {
          name: 'Domain_Avocado_luggage_twel',
          version: '1',
          chainId: '0x324e',
          verifyingContract: '0x69f758a7911448c2f7aa6df15ca27d69ffa1c6b7',
        },
        message: {
          utility: {
            favorite: '0x891b56dc6ab87ab73cf69761183d499283f1925871',
          },
          aisle: {
            clever: '0x0102',
          },
          gym: {
            private: '0xbb42',
          },
          drift_patch_cable_bi: '0xb4',
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });

    describe(`test ${numRandom} random payloads`, () => {
      for (let i = 0; i < numRandom; i++) {
        it(`Payload #: ${i}`, async () => {
          await runEthMsg(
            buildEthMsgReq(buildRandomMsg('eip712', client), 'eip712'),
            client,
          );
        });
      }
    });
  });
});
