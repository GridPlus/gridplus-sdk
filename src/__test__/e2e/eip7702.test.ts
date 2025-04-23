/* eslint-disable quotes */
import { question } from 'readline-sync';
import {
  getAddress,
  Hex,
  parseEther,
  TransactionSerializableEIP7702,
  type Address,
} from 'viem';
import { pair, signEIP7702 } from '../../api/index';
import { setupClient } from '../utils/setup';
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

// Add this utility function to check address validity
const validateEthereumAddress = (
  address: string,
): { valid: boolean; error?: string } => {
  try {
    // 1. Check if address starts with 0x
    if (!address.startsWith('0x')) {
      return { valid: false, error: 'Address must start with 0x' };
    }

    // 2. Check if address has the correct length (20 bytes = 40 hex chars + '0x' prefix = 42 chars)
    if (address.length !== 42) {
      return {
        valid: false,
        error: `Address must be exactly 42 characters long (20 bytes). Got ${address.length} characters`,
      };
    }

    // 3. Check if address is a valid hex string (after 0x prefix)
    const hexPart = address.slice(2);
    if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
      return { valid: false, error: 'Address contains invalid hex characters' };
    }

    // 4. Validate checksum (getAddress will throw if checksum is invalid)
    const checksumAddress = getAddress(address);

    // 5. Check if the address matches its checksum counterpart
    if (address !== checksumAddress) {
      return {
        valid: false,
        error: `Address does not match checksum format. Expected: ${checksumAddress}`,
      };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Invalid address: ${error.message}` };
  }
};

describe('EIP-7702', () => {
  /**
   * Test focusing on EIP-7702 transaction serialization
   */
  test('EIP-7702 transaction serialization', async () => {
    console.log('\n🔍 TESTING EIP-7702 TRANSACTION SERIALIZATION');

    // First ensure we're paired
    console.log('⏱️ Checking pairing status');
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

    // Define the authorization with required fields
    const authorization = {
      chainId: 1,
      address: '0x769F783730E49994F724069898f8738bFd406DfD' as Address,
      nonce: 0,
      yParity: 1,
      r: '0xcd27f8d16ea21ba806b8a9c3fad886dc77cb3887715b272ebe1448c67d2d5ffe' as Hex,
      s: '0x30516d176c8694d5f841582be93538f0037d1fb3f6e46ddf87c8ee26570065d2' as Hex,
    };

    // Create the transaction object with the authorization
    const transaction: TransactionSerializableEIP7702 = {
      type: 'eip7702',
      chainId: 1,
      nonce: 0,
      maxPriorityFeePerGas: BigInt(parseEther('0.000000001')),
      maxFeePerGas: BigInt(parseEther('0.00000001')),
      to: '0x769F783730E49994F724069898f8738bFd406DfD' as Address,
      value: BigInt(parseEther('0.1')),
      data: '0x12345678' as Hex,
      authorizationList: [authorization],
    };

    console.log('📌 Transaction constructed for serialization test');
    debugLog('Transaction details', transaction);

    try {
      // Pre-validation - check all required fields are present and correctly typed
      console.log('\n🔍 PRE-VALIDATION CHECKS:');

      // 1. Validate transaction base fields
      const requiredTxFields = [
        'type',
        'chainId',
        'nonce',
        'maxPriorityFeePerGas',
        'maxFeePerGas',
        'to',
        'value',
        'data',
        'authorizationList',
      ];
      const missingTxFields = requiredTxFields.filter(
        (field) => transaction[field] === undefined,
      );

      if (missingTxFields.length > 0) {
        console.error(
          `❌ Missing required transaction fields: ${missingTxFields.join(', ')}`,
        );
        throw new Error(
          `Transaction missing required fields: ${missingTxFields.join(', ')}`,
        );
      }
      console.log('✅ All transaction fields present');

      // 2. Validate transaction field types
      console.log('🔍 Validating field types:');
      console.log(`  - type: ${transaction.type} (${typeof transaction.type})`);
      console.log(
        `  - chainId: ${transaction.chainId} (${typeof transaction.chainId})`,
      );
      console.log(
        `  - nonce: ${transaction.nonce} (${typeof transaction.nonce})`,
      );
      console.log(
        `  - maxPriorityFeePerGas: ${transaction.maxPriorityFeePerGas} (${typeof transaction.maxPriorityFeePerGas})`,
      );
      console.log(
        `  - maxFeePerGas: ${transaction.maxFeePerGas} (${typeof transaction.maxFeePerGas})`,
      );
      console.log(`  - to: ${transaction.to} (${typeof transaction.to})`);
      console.log(
        `  - value: ${transaction.value} (${typeof transaction.value})`,
      );
      console.log(`  - data: ${transaction.data} (${typeof transaction.data})`);

      // 3. Validate authorizationList
      if (!Array.isArray(transaction.authorizationList)) {
        console.error('❌ authorizationList is not an array');
        throw new Error('authorizationList must be an array');
      }

      if (transaction.authorizationList.length === 0) {
        console.error('❌ authorizationList is empty');
        throw new Error('authorizationList cannot be empty');
      }
      console.log(
        `✅ authorizationList is a valid array with ${transaction.authorizationList.length} item(s)`,
      );

      // 4. Validate each authorization in the list
      const requiredAuthFields = [
        'chainId',
        'address',
        'nonce',
        'yParity',
        'r',
        's',
      ];

      transaction.authorizationList.forEach((auth, index) => {
        console.log(`\n🔍 Validating authorization [${index}]:`);

        // Check for missing fields
        const missingAuthFields = requiredAuthFields.filter(
          (field) => auth[field] === undefined,
        );
        if (missingAuthFields.length > 0) {
          console.error(
            `❌ Authorization [${index}] missing fields: ${missingAuthFields.join(', ')}`,
          );
          throw new Error(
            `Authorization [${index}] missing required fields: ${missingAuthFields.join(', ')}`,
          );
        }

        // Log each field with its type
        requiredAuthFields.forEach((field) => {
          console.log(`  - ${field}: ${auth[field]} (${typeof auth[field]})`);

          // Extra validation for specific fields
          if (field === 'address') {
            // Enhanced address validation
            const addressValidation = validateEthereumAddress(
              auth.address as string,
            );
            if (!addressValidation.valid) {
              console.error(`❌ ${addressValidation.error}`);
              throw new Error(addressValidation.error);
            }
            console.log(
              `  - address: ${auth.address} (✓ valid checksum address)`,
            );
          }

          if (
            (field === 'r' || field === 's') &&
            !auth[field].startsWith('0x')
          ) {
            console.error(`❌ Invalid ${field} format: ${auth[field]}`);
            throw new Error(`Invalid ${field} format: ${auth[field]}`);
          }
        });
      });

      console.log('\n✅ All pre-validation checks passed');

      // Sign the transaction
      console.log('\n🔐 Calling signEIP7702 API...');
      const result = await signEIP7702(transaction);
      debugLog('Sign result', result);

      // Verify the transaction was properly signed
      expect(result.sig.r).toBeDefined();
      expect(result.sig.s).toBeDefined();

      // Verify r and s are valid buffers with correct length (32 bytes for ECDSA signatures)
      expect(Buffer.isBuffer(result.sig.r)).toBe(true);
      expect(Buffer.isBuffer(result.sig.s)).toBe(true);
      expect(result.sig.r.length).toBe(32); // ECDSA signatures have 32-byte r values
      expect(result.sig.s.length).toBe(32); // ECDSA signatures have 32-byte s values

      console.log('✅ Transaction successfully serialized and signed');
      console.log(`Transaction hash: ${result.txHash}`);
    } catch (error) {
      console.error('\n❌ SERIALIZATION TEST FAILED:');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Error details:', JSON.stringify(error, bigIntReplacer, 2));
      throw error;
    }
  });
});
