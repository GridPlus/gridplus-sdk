/* eslint-disable quotes */
import { question } from 'readline-sync';
import { getClient, pair } from '../../api';
import { sign } from '../../api/index';
import { setupClient } from '../utils/setup';

describe('bug', () => {
  test('pair', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }
  });

  test('payload', async () => {
    const client = getClient();
    await client.sign({
      currency: 'ETH_MSG',
      data: {
        signerPath: [2147483692, 2147483708, 2147483648, 0, 0],
        protocol: 'eip712',
        payload: {
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
            Group: [
              {
                name: 'name',
                type: 'string',
              },
              {
                name: 'members',
                type: 'Person[]',
              },
            ],
            Mail: [
              {
                name: 'from',
                type: 'Person',
              },
              {
                name: 'to',
                type: 'Person[]',
              },
              {
                name: 'contents',
                type: 'string',
              },
              {
                name: 'attachment',
                type: 'bytes',
              },
            ],
            Person: [
              {
                name: 'name',
                type: 'string',
              },
              {
                name: 'wallets',
                type: 'address[]',
              },
            ],
          },
          primaryType: 'Mail',
          domain: {
            chainId: '0xaa36a7',
            name: 'Ether Mail',
            verifyingContract: '0xcccccccccccccccccccccccccccccccccccccccc',
            version: '1',
          },
          message: {
            contents: 'Hello, Bob!',
            from: {
              name: 'Cow',
              wallets: [
                '0xcd2a3d9f938e13cd947ec05abc7fe734df8dd826',
                '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
              ],
            },
            to: [
              {
                name: 'Bob',
                wallets: [
                  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                  '0xb0bdabea57b0bdabea57b0bdabea57b0bdabea57',
                  '0xb0b0b0b0b0b0b000000000000000000000000000',
                ],
              },
            ],
            attachment: '0x',
          },
        },
      },
    });
  });
});
