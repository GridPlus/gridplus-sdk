import {
  parseEther,
  toHex,
  type Address,
  type Hex,
  serializeTransaction,
} from 'viem';
import { serializeEIP7702Transaction } from '../../ethereum';
import {
  TRANSACTION_TYPE,
  Authorization,
  EIP7702AuthListTransaction,
} from '../../types';
import { keccak256 } from 'js-sha3';

// BigInt safe replacer for JSON.stringify
const bigIntReplacer = (key, value) => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
};

describe('EIP7702 Transaction Debug', () => {
  /**
   * This test reproduces the exact transaction structure from the e2e test
   * to help identify why the serialization is failing with "undefined address"
   */
  test('debug EIP7702 auth list transaction serialization', () => {
    // Create the transaction exactly as it appears in the logs
    const authListTx = {
      type: 5 as const, // Must be exactly 5 as a literal type for auth list transaction
      chainId: 1,
      nonce: 0,
      maxPriorityFeePerGas: toHex(parseEther('0.000000001')), // 1 gwei
      maxFeePerGas: toHex(parseEther('0.00000001')), // 10 gwei
      gasLimit: toHex(BigInt(21000)),
      to: '0x769f783730e49994f724069898f8738bfd406dfd' as Address,
      value: toHex(parseEther('0.1')),
      data: '0x12345678' as Hex,
      accessList: [],
      authorizations: [
        {
          chainId: 1,
          address: '0x769f783730e49994f724069898f8738bfd406dfd' as Address,
          nonce: 0,
          yParity: 1,
          r: '0xcd27f8d16ea21ba806b8a9c3fad886dc77cb3887715b272ebe1448c67d2d5ffe' as Hex,
          s: '0x30516d176c8694d5f841582be93538f0037d1fb3f6e46ddf87c8ee26570065d2' as Hex,
        },
      ],
    };

    // Output the transaction details for debugging
    console.log('Input transaction for serialization:');
    console.log(JSON.stringify(authListTx, bigIntReplacer, 2));

    // Log details about the authorizationList to debug the undefined address issue
    console.log('\nAuthorization details:');
    authListTx.authorizations.forEach((auth, idx) => {
      console.log(`Auth[${idx}] - address:`, auth.address);
      console.log(`Auth[${idx}] - type of address:`, typeof auth.address);
      console.log(`Auth[${idx}] - address is null?`, auth.address === null);
      console.log(
        `Auth[${idx}] - address is undefined?`,
        auth.address === undefined,
      );
      console.log(
        `Auth[${idx}] - complete:`,
        JSON.stringify(auth, bigIntReplacer, 2),
      );
    });

    // Test that we can serialize it without errors
    let serialized;
    let error;

    try {
      serialized = serializeEIP7702Transaction(authListTx);
      console.log('\nSuccessfully serialized transaction:');
      console.log('Serialized result:', serialized);

      // Compute the hash for verification
      const txHash = '0x' + keccak256(Buffer.from(serialized.slice(2), 'hex'));
      console.log('Transaction hash:', txHash);
    } catch (err) {
      error = err;
      console.error('\nSerialization error:', err.message);
      console.error('Error details:', JSON.stringify(err, bigIntReplacer, 2));
    }

    // Assert that no error occurred
    expect(error).toBeUndefined();
    // Assert that serialization produced a result
    expect(serialized).toBeDefined();
  });

  /**
   * This test uses exact hex values provided in the input to test our EIP7702 serialization
   */
  test('serialize EIP7702 transaction with exact hex values', () => {
    // Use the exact transaction with hex values as provided
    const exactHexTx = {
      type: 5 as const,
      chainId: 1,
      nonce: 0,
      maxPriorityFeePerGas: '0x3b9aca00' as Hex,
      maxFeePerGas: '0x2540be400' as Hex,
      gasLimit: '0x5208' as Hex,
      to: '0x769f783730e49994f724069898f8738bfd406dfd' as Address,
      value: '0x16345785d8a0000' as Hex,
      data: '0x12345678' as Hex,
      accessList: [],
      authorizations: [
        {
          chainId: 1,
          address: '0x769f783730e49994f724069898f8738bfd406dfd' as Address,
          nonce: 0,
          yParity: 1,
          r: '0xcd27f8d16ea21ba806b8a9c3fad886dc77cb3887715b272ebe1448c67d2d5ffe' as Hex,
          s: '0x30516d176c8694d5f841582be93538f0037d1fb3f6e46ddf87c8ee26570065d2' as Hex,
        },
      ],
    };

    // Output the transaction details for debugging
    console.log('Exact hex input transaction for serialization:');
    console.log(JSON.stringify(exactHexTx, null, 2));

    // Log details about the authorization to debug any potential issues
    console.log('\nAuthorization details:');
    exactHexTx.authorizations.forEach((auth, idx) => {
      console.log(`Auth[${idx}] - address:`, auth.address);
      console.log(`Auth[${idx}] - complete:`, JSON.stringify(auth, null, 2));
    });

    // Test that we can serialize it without errors
    let serialized;
    let error;

    try {
      serialized = serializeEIP7702Transaction(exactHexTx);
      console.log(
        '\nSuccessfully serialized transaction with exact hex values:',
      );
      console.log('Serialized result:', serialized);

      // Compute the hash for verification
      const txHash = '0x' + keccak256(Buffer.from(serialized.slice(2), 'hex'));
      console.log('Transaction hash:', txHash);
    } catch (err) {
      error = err;
      console.error(
        '\nSerialization error with exact hex values:',
        err.message,
      );
      console.error('Error details:', JSON.stringify(err, null, 2));
    }

    // Assert that no error occurred
    expect(error).toBeUndefined();
    // Assert that serialization produced a result
    expect(serialized).toBeDefined();
  });

  /**
   * This test tests the Viem serializeTransaction function with EIP7702 transaction data
   */
  test('viem serializeTransaction with EIP7702 transaction data', () => {
    // Create the transaction from the user-provided data
    const eip7702Tx = {
      type: 'eip7702' as const,
      chainId: 1,
      nonce: 0,
      maxPriorityFeePerGas: BigInt('1000000000'),
      maxFeePerGas: BigInt('10000000000'),
      gas: BigInt('21000'),
      to: '0x769f783730e49994f724069898f8738bfd406dfd' as `0x${string}`,
      value: BigInt('100000000000000000'),
      data: '0x12345678' as `0x${string}`,
      authorizationList: [
        {
          chainId: 1,
          address:
            '0x769f783730e49994f724069898f8738bfd406dfd' as `0x${string}`,
          nonce: 0,
          yParity: 1,
          r: '0xcd27f8d16ea21ba806b8a9c3fad886dc77cb3887715b272ebe1448c67d2d5ffe' as `0x${string}`,
          s: '0x30516d176c8694d5f841582be93538f0037d1fb3f6e46ddf87c8ee26570065d2' as `0x${string}`,
        },
      ],
    } as const;

    // Output the transaction details for debugging
    console.log('Viem input transaction:');
    console.log(JSON.stringify(eip7702Tx, bigIntReplacer, 2));

    // Test that we can serialize it using Viem's serializeTransaction without errors
    let serialized;
    let error;

    try {
      serialized = serializeTransaction(eip7702Tx);
      console.log('\nSuccessfully serialized transaction with Viem:');
      console.log('Serialized result:', serialized);

      // Compute the hash for verification
      const txHash = '0x' + keccak256(Buffer.from(serialized.slice(2), 'hex'));
      console.log('Transaction hash:', txHash);
    } catch (err) {
      error = err;
      console.error('\nViem serialization error:', err.message);
      console.error('Error details:', JSON.stringify(err, null, 2));
    }

    // Assert that no error occurred
    expect(error).toBeUndefined();
    // Assert that serialization produced a result
    expect(serialized).toBeDefined();
  });
});
