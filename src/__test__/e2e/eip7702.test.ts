/* eslint-disable quotes */
import { setupClient } from '../utils/setup';
import { pair, sign, signAuthorization } from '../../api/index';
import { question } from 'readline-sync';
import { parseEther, toHex, type Address } from 'viem';
import { TRANSACTION_TYPE, AuthorizationData } from '../../types';
/**
 * Test vectors for EIP-7702
 *
 * According to the EIP-7702 specification:
 * - Transaction type is 0x04 (SET_CODE_TX_TYPE)
 * - MAGIC value is 0x05
 * - Authorization tuples are in the format [chain_id, address, nonce, y_parity, r, s]
 * - EIP-7702 supports both single authorizations and authorization lists
 */

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
    const authorizationData: AuthorizationData = {
      chainId: 1,
      contractAddress: '0x769f783730e49994f724069898f8738bfd406dfd' as Address,
      nonce: 0,
    };

    /**
     * Test Case: Single Authorization
     *
     * From the EIP-7702 spec:
     * "At the start of executing the transaction, after incrementing the sender's nonce,
     * for each [chain_id, address, nonce, y_parity, r, s] tuple do the following:
     * 1. Verify the chain id is either 0 or the chain's current ID.
     * 2. Verify the nonce is less than 2**64 - 1."
     */
    test('single authorization', async () => {
      // Sign the authorization data to get a complete authorization with signature
      signedAuthorization = await signAuthorization(authorizationData);
      console.log('Auth transaction result:', signedAuthorization);

      // Verify signature components exist
      expect(signedAuthorization.yParity).toBeDefined();
      expect(signedAuthorization.r).toBeDefined();
      expect(signedAuthorization.s).toBeDefined();

      // Verify yParity is either 0x0 or 0x1
      expect(['0x0', '0x1']).toContain(signedAuthorization.yParity);
    });

    /**
     * Test Case: Authorization List
     *
     * From the EIP-7702 spec:
     * "The access_list and authorization_list fields follow EIP-2930 format.
     * The transaction is considered invalid if the length of authorization_list is zero."
     */
    test('auth list transaction', async () => {
      // Create a transaction with an authorization list
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
        accessList: [],
        authorizations: [
          {
            // Ensure we include all required fields explicitly
            chainId: authorizationData.chainId,
            contractAddress: authorizationData.contractAddress,
            nonce: authorizationData.nonce,
            yParity: signedAuthorization.yParity,
            r: signedAuthorization.r,
            s: signedAuthorization.s,
          },
        ],
      };

      const result = await sign(authListTx);
      console.log('Auth list transaction result:', result);

      // Verify the transaction was properly signed
      expect(result.tx).toBeDefined();
      expect(result.txHash).toBeDefined();
    });
  });
});
