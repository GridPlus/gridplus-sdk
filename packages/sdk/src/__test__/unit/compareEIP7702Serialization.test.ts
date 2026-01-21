import { Hash } from 'ox';
import { parseEther, serializeTransaction, toHex } from 'viem';
import { serializeEIP7702Transaction } from '../../ethereum';
import type {
  EIP7702AuthListTransactionRequest as EIP7702AuthListTransaction,
  EIP7702AuthTransactionRequest as EIP7702AuthTransaction,
} from '../../types';

describe('EIP7702 Transaction Serialization Comparison', () => {
  /**
   * Simple minimal test case to identify differences
   */
  test('minimal single authorization transaction', async () => {
    // Create a minimal transaction for easier comparison
    const tx: EIP7702AuthTransaction = {
      type: 4,
      chainId: 1,
      nonce: 0,
      maxPriorityFeePerGas: '0x1',
      maxFeePerGas: '0x2',
      gasLimit: '0x3',
      to: '0x1111111111111111111111111111111111111111',
      value: '0x0',
      data: '0x',
      accessList: [],
      authorization: {
        chainId: 1,
        address: '0x2222222222222222222222222222222222222222',
        nonce: 0,
        yParity: 0,
        r: '0x0000000000000000000000000000000000000000000000000000000000000001',
        s: '0x0000000000000000000000000000000000000000000000000000000000000002',
      },
    };

    // Convert to Viem's transaction format
    const viemTx = {
      type: 'eip7702',
      chainId: 1,
      nonce: 0,
      maxPriorityFeePerGas: BigInt('0x1'),
      maxFeePerGas: BigInt('0x2'),
      gas: BigInt('0x3'),
      to: '0x1111111111111111111111111111111111111111',
      value: BigInt('0x0'),
      data: '0x',
      accessList: [],
      authorizationList: [
        {
          chainId: 1,
          address: '0x2222222222222222222222222222222222222222',
          nonce: 0,
          signature: {
            yParity: 0,
            r: '0x0000000000000000000000000000000000000000000000000000000000000001',
            s: '0x0000000000000000000000000000000000000000000000000000000000000002',
          },
        },
      ],
    };

    // Serialize using our implementation
    const ourSerialized = serializeEIP7702Transaction(tx);

    // Serialize using Viem
    const viemSerialized = serializeTransaction(viemTx as any);

    // Output raw serialized data for debugging
    console.log('Our serialized (minimal):', ourSerialized);
    console.log('Viem serialized (minimal):', viemSerialized);

    // Output serialized by byte
    console.log(
      'Our bytes:',
      Buffer.from(ourSerialized.slice(2), 'hex')
        .toString('hex')
        .match(/.{1,2}/g)
        ?.join(' '),
    );
    console.log(
      'Viem bytes:',
      Buffer.from(viemSerialized.slice(2), 'hex')
        .toString('hex')
        .match(/.{1,2}/g)
        ?.join(' '),
    );

    // Compare the serialized transactions
    expect(ourSerialized).toEqual(viemSerialized);
  });

  /**
   * Test case comparing our implementation of EIP-7702 transaction serialization with Viem's implementation
   *
   * This ensures that our serialization matches Viem's expected format,
   * providing compatibility with external libraries and tools.
   */
  test('single authorization transaction serialization matches Viem', async () => {
    // Create a single authorization transaction with deterministic values
    const tx: EIP7702AuthTransaction = {
      type: 4, // Must be exactly 4 for auth transaction
      chainId: 1, // Mainnet
      nonce: 0,
      maxPriorityFeePerGas: toHex(parseEther('0.000000001')), // 1 gwei
      maxFeePerGas: toHex(parseEther('0.00000001')), // 10 gwei
      gasLimit: toHex(BigInt(21000)),
      to: '0x1111111111111111111111111111111111111111', // Simple address for testing
      value: toHex(parseEther('1.0')), // 1 ETH
      data: '0x',
      accessList: [],
      authorization: {
        chainId: 1,
        address: '0x2222222222222222222222222222222222222222',
        nonce: 0,
        yParity: 0, // Known signature values for deterministic test
        r: '0x1111111111111111111111111111111111111111111111111111111111111111',
        s: '0x2222222222222222222222222222222222222222222222222222222222222222',
      },
    };

    // Convert to Viem's transaction format
    const viemTx = {
      type: 'eip7702',
      chainId: 1,
      nonce: 0,
      maxPriorityFeePerGas: BigInt(parseEther('0.000000001')),
      maxFeePerGas: BigInt(parseEther('0.00000001')),
      gas: BigInt(21000),
      to: '0x1111111111111111111111111111111111111111',
      value: BigInt(parseEther('1.0')),
      data: '0x',
      accessList: [],
      authorizationList: [
        {
          chainId: 1,
          address: '0x2222222222222222222222222222222222222222',
          nonce: 0,
          signature: {
            yParity: 0,
            r: '0x1111111111111111111111111111111111111111111111111111111111111111',
            s: '0x2222222222222222222222222222222222222222222222222222222222222222',
          },
        },
      ],
    };

    // Serialize using our implementation
    const ourSerialized = serializeEIP7702Transaction(tx);

    // Serialize using Viem
    const viemSerialized = serializeTransaction(viemTx as any);

    // Compute hashes for comparison
    const ourHash = `0x${Buffer.from(
      Hash.keccak256(Buffer.from(ourSerialized.slice(2), 'hex')),
    ).toString('hex')}`;
    const viemHash = `0x${Buffer.from(
      Hash.keccak256(Buffer.from(viemSerialized.slice(2), 'hex')),
    ).toString('hex')}`;

    // Output for debugging
    console.log('Our serialized:', ourSerialized);
    console.log('Viem serialized:', viemSerialized);
    console.log('Our hash:', ourHash);
    console.log('Viem hash:', viemHash);

    // Compare the serialized transactions
    expect(ourSerialized).toEqual(viemSerialized);
  });

  /**
   * Test case for serializing an EIP-7702 authorization list transaction (type 5)
   * comparing our implementation with Viem's implementation.
   */
  test('authorization list transaction serialization matches Viem', async () => {
    const tx: EIP7702AuthListTransaction = {
      type: 5, // Must be exactly 5 for auth list transaction
      chainId: 1, // Mainnet
      nonce: 0,
      maxPriorityFeePerGas: toHex(parseEther('0.000000001')), // 1 gwei
      maxFeePerGas: toHex(parseEther('0.00000001')), // 10 gwei
      gasLimit: toHex(BigInt(21000)),
      to: '0x1111111111111111111111111111111111111111', // Simple address for testing
      value: toHex(parseEther('1.0')), // 1 ETH
      data: '0x',
      accessList: [],
      authorizationList: [
        {
          chainId: 1,
          address: '0x2222222222222222222222222222222222222222',
          nonce: 0,
          yParity: 0, // Known signature values for deterministic test
          r: '0x1111111111111111111111111111111111111111111111111111111111111111',
          s: '0x2222222222222222222222222222222222222222222222222222222222222222',
        },
        {
          chainId: 1,
          address: '0x3333333333333333333333333333333333333333',
          nonce: 0,
          yParity: 1, // Different signature
          r: '0x3333333333333333333333333333333333333333333333333333333333333333',
          s: '0x4444444444444444444444444444444444444444444444444444444444444444',
        },
      ],
    };

    // Convert to Viem's transaction format
    const viemTx = {
      type: 'eip7702',
      chainId: 1,
      nonce: 0,
      maxPriorityFeePerGas: BigInt(parseEther('0.000000001')),
      maxFeePerGas: BigInt(parseEther('0.00000001')),
      gas: BigInt(21000),
      to: '0x1111111111111111111111111111111111111111',
      value: BigInt(parseEther('1.0')),
      data: '0x',
      accessList: [],
      authorizationList: [
        {
          chainId: 1,
          address: '0x2222222222222222222222222222222222222222',
          nonce: 0,
          signature: {
            yParity: 0,
            r: '0x1111111111111111111111111111111111111111111111111111111111111111',
            s: '0x2222222222222222222222222222222222222222222222222222222222222222',
          },
        },
        {
          chainId: 1,
          address: '0x3333333333333333333333333333333333333333',
          nonce: 0,
          signature: {
            yParity: 1,
            r: '0x3333333333333333333333333333333333333333333333333333333333333333',
            s: '0x4444444444444444444444444444444444444444444444444444444444444444',
          },
        },
      ],
    };

    // Serialize using our implementation
    const ourSerialized = serializeEIP7702Transaction(tx);

    // Serialize using Viem
    const viemSerialized = serializeTransaction(viemTx as any);

    // Compute hashes for comparison
    const ourHash = `0x${Buffer.from(
      Hash.keccak256(Buffer.from(ourSerialized.slice(2), 'hex')),
    ).toString('hex')}`;
    const viemHash = `0x${Buffer.from(
      Hash.keccak256(Buffer.from(viemSerialized.slice(2), 'hex')),
    ).toString('hex')}`;

    // Output for debugging
    console.log('Our serialized (auth list):', ourSerialized);
    console.log('Viem serialized (auth list):', viemSerialized);
    console.log('Our hash (auth list):', ourHash);
    console.log('Viem hash (auth list):', viemHash);

    // Compare the serialized transactions
    expect(ourSerialized).toEqual(viemSerialized);
  });

  /**
   * Test case using realistic transaction values
   */
  test('realistic transaction values match between implementations', async () => {
    // Reference transaction with specific values
    const tx: EIP7702AuthTransaction = {
      type: 4,
      chainId: 1, // Mainnet
      nonce: 42,
      maxPriorityFeePerGas: '0x3b9aca00', // 1 gwei (1,000,000,000 wei)
      maxFeePerGas: '0x77359400', // 2 gwei (2,000,000,000 wei)
      gasLimit: '0x5208', // 21000
      to: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045', // vitalik.eth
      value: '0x2386f26fc10000', // 0.01 ETH (10,000,000,000,000,000 wei)
      data: '0x68656c6c6f', // "hello" in hex
      accessList: [],
      authorization: {
        chainId: 1,
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH contract
        nonce: 0,
        // Standard test signature values
        yParity: 0,
        r: '0x0000000000000000000000000000000000000000000000000000000000000001',
        s: '0x0000000000000000000000000000000000000000000000000000000000000002',
      },
    };

    // Convert to Viem's transaction format
    const viemTx = {
      type: 'eip7702',
      chainId: 1,
      nonce: 42,
      maxPriorityFeePerGas: BigInt('0x3b9aca00'),
      maxFeePerGas: BigInt('0x77359400'),
      gas: BigInt('0x5208'),
      to: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
      value: BigInt('0x2386f26fc10000'),
      data: '0x68656c6c6f',
      accessList: [],
      authorizationList: [
        {
          chainId: 1,
          address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
          nonce: 0,
          signature: {
            yParity: 0,
            r: '0x0000000000000000000000000000000000000000000000000000000000000001',
            s: '0x0000000000000000000000000000000000000000000000000000000000000002',
          },
        },
      ],
    };

    // Serialize using our implementation
    const ourSerialized = serializeEIP7702Transaction(tx);

    // Serialize using Viem
    const viemSerialized = serializeTransaction(viemTx as any);

    // Compute hashes for comparison
    const ourHash = `0x${Buffer.from(
      Hash.keccak256(Buffer.from(ourSerialized.slice(2), 'hex')),
    ).toString('hex')}`;
    const viemHash = `0x${Buffer.from(
      Hash.keccak256(Buffer.from(viemSerialized.slice(2), 'hex')),
    ).toString('hex')}`;

    // Output for debugging
    console.log('Our serialized (realistic):', ourSerialized);
    console.log('Viem serialized (realistic):', viemSerialized);
    console.log('Our hash (realistic):', ourHash);
    console.log('Viem hash (realistic):', viemHash);

    // Compare the serialized transactions
    expect(ourSerialized).toEqual(viemSerialized);
  });

  /**
   * Test case with contract auth (when authorization has nonce)
   */
  test('contract authorization transaction serialization matches Viem', async () => {
    // Create a single authorization transaction with contract auth (with nonce)
    const tx: EIP7702AuthTransaction = {
      type: 4,
      chainId: 1,
      nonce: 0,
      maxPriorityFeePerGas: '0x3b9aca00',
      maxFeePerGas: '0x77359400',
      gasLimit: '0x5208',
      to: '0x1111111111111111111111111111111111111111',
      value: '0x0',
      data: '0x',
      accessList: [],
      authorization: {
        chainId: 1,
        address: '0x2222222222222222222222222222222222222222',
        nonce: 5, // Contract auth has non-zero nonce
        yParity: 0,
        r: '0x1111111111111111111111111111111111111111111111111111111111111111',
        s: '0x2222222222222222222222222222222222222222222222222222222222222222',
      },
    };

    // Convert to Viem's transaction format
    const viemTx = {
      type: 'eip7702',
      chainId: 1,
      nonce: 0,
      maxPriorityFeePerGas: BigInt('0x3b9aca00'),
      maxFeePerGas: BigInt('0x77359400'),
      gas: BigInt('0x5208'),
      to: '0x1111111111111111111111111111111111111111',
      value: BigInt('0x0'),
      data: '0x',
      accessList: [],
      authorizationList: [
        {
          chainId: 1,
          address: '0x2222222222222222222222222222222222222222',
          nonce: 5,
          signature: {
            yParity: 0,
            r: '0x1111111111111111111111111111111111111111111111111111111111111111',
            s: '0x2222222222222222222222222222222222222222222222222222222222222222',
          },
        },
      ],
    };

    // Serialize using our implementation
    const ourSerialized = serializeEIP7702Transaction(tx);

    // Serialize using Viem
    const viemSerialized = serializeTransaction(viemTx as any);

    // Compute hashes for comparison
    const ourHash = `0x${Buffer.from(
      Hash.keccak256(Buffer.from(ourSerialized.slice(2), 'hex')),
    ).toString('hex')}`;
    const viemHash = `0x${Buffer.from(
      Hash.keccak256(Buffer.from(viemSerialized.slice(2), 'hex')),
    ).toString('hex')}`;

    // Output for debugging
    console.log('Our serialized (contract auth):', ourSerialized);
    console.log('Viem serialized (contract auth):', viemSerialized);
    console.log('Our hash (contract auth):', ourHash);
    console.log('Viem hash (contract auth):', viemHash);

    // Compare the serialized transactions
    expect(ourSerialized).toEqual(viemSerialized);
  });
});
