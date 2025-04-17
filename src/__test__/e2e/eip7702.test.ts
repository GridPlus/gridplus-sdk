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

// BigInt safe replacer for JSON.stringify
const bigIntReplacer = (key, value) => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
};

// Debug utility function to print detailed object info
const debugLog = (label, obj) => {
  console.log('\n========== DEBUG LOG ==========');
  console.log(`${label}:`);

  if (obj === undefined) {
    console.log('UNDEFINED VALUE');
    return;
  }

  if (obj === null) {
    console.log('NULL VALUE');
    return;
  }

  console.log('Type:', typeof obj);
  console.log('JSON Stringified:', JSON.stringify(obj, bigIntReplacer, 2));

  if (typeof obj === 'object') {
    console.log('Keys:', Object.keys(obj));
    console.log('Values present check:');
    Object.keys(obj).forEach((key) => {
      console.log(
        `  - ${key}: ${obj[key] !== undefined ? 'PRESENT' : 'UNDEFINED'} (${typeof obj[key]})`,
      );
    });
  }
  console.log('===============================\n');
};

describe('EIP-7702', () => {
  test('pair', async () => {
    console.log('⏱️ STARTING PAIRING TEST');
    const isPaired = await setupClient();
    console.log(
      '📱 Pairing status:',
      isPaired ? 'ALREADY PAIRED' : 'NOT PAIRED',
    );
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      console.log('🔑 Attempting to pair with secret (hidden)');
      await pair(secret.toUpperCase());
      console.log('✅ Pairing completed');
    }
  });

  describe('transactions', () => {
    const authorizationData: AuthorizationData = {
      chainId: 1,
      contractAddress: '0x769f783730e49994f724069898f8738bfd406dfd' as Address,
      nonce: 0,
    };

    debugLog('Initial authorization data', authorizationData);

    /**
     * Combined test for EIP-7702 transactions
     *
     * This test performs all EIP-7702 operations in a single test to ensure
     * they execute in the correct order.
     */
    test('EIP-7702 transaction flow', async () => {
      console.log('\n🔍 EIP-7702 TRANSACTION FLOW TEST STARTING');
      console.log('📋 Test sequence:');
      console.log('  1. Sign a single authorization');
      console.log(
        '  2. Create an auth list transaction with the signed authorization',
      );
      console.log('  3. Test universal authorization with chain ID 0');

      try {
        // Step 1: Sign a single authorization
        console.log('\n🔄 STEP 1: Signing a single authorization');
        console.log('📌 Input authorization data:');
        debugLog('Authorization data being signed', authorizationData);

        console.log('🔐 Calling signAuthorization API...');
        const signedAuthorization = await signAuthorization(authorizationData);
        console.log('✅ signAuthorization completed successfully');
        debugLog('Complete signed authorization result', signedAuthorization);

        // Verify signature components exist
        console.log('🔍 Verifying signature components...');
        const fieldsToCheck = [
          'chainId',
          'contractAddress',
          'nonce',
          'yParity',
          'r',
          's',
        ];
        fieldsToCheck.forEach((field) => {
          const exists = signedAuthorization[field] !== undefined;
          console.log(`  - ${field}: ${exists ? 'EXISTS' : 'MISSING'}`);
          expect(signedAuthorization[field]).toBeDefined();
        });

        console.log('✅ All signature fields verified successfully');

        // Verify yParity is either 0x0 or 0x1
        console.log('🔍 Verifying yParity value:', signedAuthorization.yParity);
        expect(['0x0', '0x1']).toContain(signedAuthorization.yParity);
        console.log('✅ yParity value is valid');

        // Step 2: Create an auth list transaction using the signed authorization
        console.log('\n🔄 STEP 2: Creating auth list transaction');
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
              chainId: signedAuthorization.chainId,
              contractAddress: signedAuthorization.contractAddress,
              nonce: signedAuthorization.nonce,
              yParity: signedAuthorization.yParity,
              r: signedAuthorization.r,
              s: signedAuthorization.s,
            },
          ],
        };

        console.log('📌 Auth list transaction constructed');
        debugLog('Auth list transaction (full details)', authListTx);

        // Detailed checks on the auth list transaction
        console.log('🔍 Validating auth list transaction fields:');
        console.log(
          `  - Transaction type: ${authListTx.type} (expected: ${TRANSACTION_TYPE.EIP7702_AUTH_LIST})`,
        );
        console.log(
          `  - Authorizations count: ${authListTx.authorizations.length}`,
        );

        // Check each authorization in the list
        if (authListTx.authorizations && authListTx.authorizations.length > 0) {
          const auth = authListTx.authorizations[0];
          console.log('  - First authorization fields:');

          fieldsToCheck.forEach((field) => {
            const exists = auth[field] !== undefined;
            const matches = auth[field] === signedAuthorization[field];
            console.log(
              `    * ${field}: ${exists ? 'EXISTS' : 'MISSING'} (${matches ? 'MATCHES' : 'DIFFERS'} from signed authorization)`,
            );
          });
        } else {
          console.log('  ⚠️ WARNING: No authorizations in the list!');
        }

        console.log('🔐 Calling sign API with auth list transaction...');
        const result = await sign(authListTx);
        console.log('✅ sign completed successfully');
        debugLog('Sign result for auth list transaction', result);

        // Verify the transaction was properly signed
        console.log('🔍 Verifying sign result has expected properties...');
        expect(result.tx).toBeDefined();
        console.log(`  - result.tx: ${result.tx ? 'EXISTS' : 'MISSING'}`);
        expect(result.txHash).toBeDefined();
        console.log(
          `  - result.txHash: ${result.txHash ? 'EXISTS' : 'MISSING'}`,
        );
        console.log('✅ Sign result verified successfully');

        // Step 3: Test authorization with chain ID 0 (universal authorization)
        console.log(
          '\n🔄 STEP 3: Testing universal authorization (chain ID 0)',
        );

        const universalAuthData: AuthorizationData = {
          chainId: 0, // Universal authorization (valid on all chains)
          contractAddress:
            '0x769f783730e49994f724069898f8738bfd406dfd' as Address,
          nonce: 0,
        };

        debugLog('Universal authorization data', universalAuthData);

        console.log(
          '🔐 Calling signAuthorization API for universal authorization...',
        );
        const universalAuth = await signAuthorization(universalAuthData);
        console.log('✅ Universal authorization completed successfully');
        debugLog('Universal auth result', universalAuth);

        // Verify signature components
        console.log('🔍 Verifying universal auth signature components...');
        fieldsToCheck.forEach((field) => {
          const exists = universalAuth[field] !== undefined;
          console.log(`  - ${field}: ${exists ? 'EXISTS' : 'MISSING'}`);
          expect(universalAuth[field]).toBeDefined();
        });
        console.log('✅ All signature fields verified successfully');

        // Verify the chain ID is 0
        console.log('🔍 Verifying chain ID is 0:', universalAuth.chainId);
        expect(universalAuth.chainId).toBe(0);
        console.log('✅ Chain ID verified as 0');

        console.log(
          '\n🎉 EIP-7702 TRANSACTION FLOW TEST COMPLETED SUCCESSFULLY',
        );
      } catch (error) {
        console.error('\n❌ TEST FAILED WITH ERROR:');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error(
          'Error details:',
          JSON.stringify(error, bigIntReplacer, 2),
        );
        throw error; // Re-throw the error to fail the test
      }
    });
  });
});
