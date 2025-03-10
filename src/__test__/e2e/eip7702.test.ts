/* eslint-disable quotes */
import { setupClient } from '../utils/setup';
import { pair, sign, signAuthorization } from '../../api/index';
import { question } from 'readline-sync';
import { parseEther, toHex, type Address } from 'viem';
import { TRANSACTION_TYPE } from '../../types';

describe('EIP-7702', () => {
  test('pair', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }
  });

  describe('transactions', () => {
    let signedAuthorization: any;

    test('single authorization', async () => {
      const authorization = {
        chainId: 1,
        contractAddress:
          '0x769f783730e49994f724069898f8738bfd406dfd' as Address,
        nonce: 0,
      };
      signedAuthorization = await signAuthorization(authorization);
      console.log('Auth transaction result:', signedAuthorization);
    });

    test('auth list transaction', async () => {
      const authListTx = {
        type: TRANSACTION_TYPE.EIP7702_AUTH_LIST,
        chainId: 1,
        nonce: 0,
        maxPriorityFeePerGas: toHex(parseEther('0.000000001')), // 1 gwei
        maxFeePerGas: toHex(parseEther('0.00000001')), // 10 gwei
        gasLimit: toHex(BigInt(21000)),
        to: '0x769f783730e49994f724069898f8738bfd406dfd' as Address,
        value: toHex(parseEther('0.1')),
        data: '0x12345678', // Function selector for the authorization
        validUntil: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        authorizedAmount: toHex(parseEther('1.0')),
        accessList: [],
        authorizations: [signedAuthorization],
      };

      const result = await sign(authListTx);
      console.log('Auth list transaction result:', result);
    });
  });
});
