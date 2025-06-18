/**
 * EVM Transaction Test Vectors
 *
 * This file contains comprehensive, deterministic test vectors for testing EVM transaction
 * signing across all major transaction types: Legacy, EIP-1559, EIP-2930, and EIP-7702.
 *
 * The vectors are organized into categories to enable targeted testing:
 *
 * BASIC TRANSACTION TYPES:
 * - LEGACY_VECTORS: Pre-EIP-1559 transactions with gasPrice
 * - EIP1559_TEST_VECTORS: Modern transactions with maxFeePerGas/maxPriorityFeePerGas
 * - EIP2930_TEST_VECTORS: Transactions with access lists
 * - EIP7702_TEST_VECTORS: Account abstraction transactions with authorization lists
 *
 * EDGE CASES & BOUNDARIES:
 * - EDGE_CASE_TEST_VECTORS: Extreme values, special chain IDs, contract creation
 * - BOUNDARY_CONDITION_VECTORS: Maximum/minimum values for all parameters
 * - PAYLOAD_SIZE_VECTORS: Different data payload sizes (0 bytes to 2000+ bytes)
 *
 * REAL-WORLD SCENARIOS:
 * - DERIVATION_PATH_VECTORS: Different BIP44 derivation path lengths
 * - NETWORK_SPECIFIC_VECTORS: Testnet and mainnet configurations
 * - REAL_WORLD_PATTERN_VECTORS: Common DeFi, NFT, and multi-send patterns
 *
 * UTILITY FUNCTIONS:
 * - ALL_COMPREHENSIVE_VECTORS: All vectors combined
 * - getVectorsByCategory(category): Filter by specific category
 * - getBalancedTestVectors(perType): Get equal numbers from each type
 * - getBoundaryTestVectors(): Get all boundary/edge case vectors
 * - getNetworkTestVectors(): Get network-specific test cases
 *
 * Total Coverage: 56 deterministic test vectors covering all major EVM transaction scenarios
 * that a hardware wallet needs to handle correctly.
 */

import type { TransactionSerializable } from 'viem';

export interface TestVector {
  name: string;
  tx: TransactionSerializable;
  category?: string;
}

// =============================================================================
// LEGACY TRANSACTION VECTORS
// =============================================================================

export const LEGACY_VECTORS: TestVector[] = [
  {
    name: 'Simple ETH transfer - Legacy',
    tx: {
      type: 'legacy',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      gasPrice: BigInt('20000000000'), // 20 gwei
      gas: BigInt('21000'),
      chainId: 1,
    },
    category: 'basic-transfer',
  },
  {
    name: 'Contract interaction - Legacy',
    tx: {
      type: 'legacy',
      to: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as `0x${string}`, // DAI
      value: BigInt(0),
      data: '0xa9059cbb000000000000000000000000742d35cc6b2d9e9a3b7b7b4a7b0b2b7b0b2b7b0b0000000000000000000000000000000000000000000000001bc16d674ec80000' as `0x${string}`,
      nonce: 1,
      gasPrice: BigInt('25000000000'), // 25 gwei
      gas: BigInt('100000'),
      chainId: 1,
    },
    category: 'contract-call',
  },
  {
    name: 'Zero value transaction - Legacy',
    tx: {
      type: 'legacy',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(0),
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 5,
      gasPrice: BigInt('10000000000'), // 10 gwei
      gas: BigInt('21000'),
      chainId: 1,
    },
    category: 'zero-value',
  },
  {
    name: 'High nonce transaction - Legacy',
    tx: {
      type: 'legacy',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('500000000000000000'), // 0.5 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 999,
      gasPrice: BigInt('50000000000'), // 50 gwei
      gas: BigInt('21000'),
      chainId: 1,
    },
    category: 'high-nonce',
  },
  {
    name: 'Polygon Legacy transaction',
    tx: {
      type: 'legacy',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 MATIC
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      gasPrice: BigInt('30000000000'), // 30 gwei
      gas: BigInt('21000'),
      chainId: 137,
    },
    category: 'polygon',
  },
];

// =============================================================================
// EIP-1559 TRANSACTION VECTORS (Fee Market)
// =============================================================================

export const EIP1559_TEST_VECTORS: TestVector[] = [
  {
    name: 'Simple ETH transfer - EIP-1559',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 ETH
      nonce: 0,
      maxFeePerGas: BigInt('30000000000'), // 30 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('21000'),
      chainId: 1,
    },
    category: 'basic-transfer',
  },
  {
    name: 'DAI transfer - EIP-1559',
    tx: {
      type: 'eip1559',
      to: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as `0x${string}`, // DAI
      value: BigInt(0),
      data: '0xa9059cbb000000000000000000000000742d35cc6b2d9e9a3b7b7b4a7b0b2b7b0b2b7b0b0000000000000000000000000000000000000000000000001bc16d674ec80000' as `0x${string}`,
      nonce: 1,
      maxFeePerGas: BigInt('40000000000'), // 40 gwei
      maxPriorityFeePerGas: BigInt('3000000000'), // 3 gwei
      gas: BigInt('100000'),
      chainId: 1,
    },
    category: 'erc20-transfer',
  },
  {
    name: 'Uniswap V2 swap - EIP-1559',
    tx: {
      type: 'eip1559',
      to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' as `0x${string}`, // Uniswap V2 Router
      value: BigInt(0),
      data: '0x38ed17390000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000c7d713b49da000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000742d35cc6b2d9e9a3b7b7b4a7b0b2b7b0b2b7b0b000000000000000000000000000000000000000000000000000000006553f10000000000000000000000000000000000000000000000000000000000000000020000000000000000000000006b175474e89094c44da98b954eedeac495271d0f000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7' as `0x${string}`,
      nonce: 2,
      maxFeePerGas: BigInt('50000000000'), // 50 gwei
      maxPriorityFeePerGas: BigInt('5000000000'), // 5 gwei
      gas: BigInt('200000'),
      chainId: 1,
    },
    category: 'defi-swap',
  },
  {
    name: 'WETH deposit - EIP-1559',
    tx: {
      type: 'eip1559',
      to: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`, // WETH
      value: BigInt('1000000000000000000'), // 1 ETH
      data: '0xd0e30db0' as `0x${string}`, // deposit()
      nonce: 3,
      maxFeePerGas: BigInt('25000000000'), // 25 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('100000'),
      chainId: 1,
    },
    category: 'payable-contract',
  },
  {
    name: 'High priority fee - EIP-1559',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('500000000000000000'), // 0.5 ETH
      nonce: 10,
      maxFeePerGas: BigInt('100000000000'), // 100 gwei
      maxPriorityFeePerGas: BigInt('50000000000'), // 50 gwei
      gas: BigInt('21000'),
      chainId: 1,
    },
    category: 'high-priority',
  },
  {
    name: 'Polygon EIP-1559 transaction',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 MATIC
      nonce: 0,
      maxFeePerGas: BigInt('30000000000'), // 30 gwei
      maxPriorityFeePerGas: BigInt('30000000000'), // 30 gwei (Polygon often has high priority fees)
      gas: BigInt('21000'),
      chainId: 137,
    },
    category: 'polygon',
  },
];

// =============================================================================
// EIP-2930 TRANSACTION VECTORS (Access Lists)
// =============================================================================

export const EIP2930_TEST_VECTORS: TestVector[] = [
  {
    name: 'Simple transfer with access list - EIP-2930',
    tx: {
      type: 'eip2930',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 ETH
      nonce: 0,
      gasPrice: BigInt('20000000000'), // 20 gwei
      gas: BigInt('21000'),
      chainId: 1,
      accessList: [
        {
          address:
            '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
          storageKeys: [
            '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
          ],
        },
      ],
    },
    category: 'simple-access-list',
  },
  {
    name: 'Contract interaction with multiple access entries - EIP-2930',
    tx: {
      type: 'eip2930',
      to: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as `0x${string}`, // DAI
      value: BigInt(0),
      data: '0xa9059cbb000000000000000000000000742d35cc6b2d9e9a3b7b7b4a7b0b2b7b0b2b7b0b0000000000000000000000000000000000000000000000001bc16d674ec80000' as `0x${string}`,
      nonce: 1,
      gasPrice: BigInt('25000000000'), // 25 gwei
      gas: BigInt('100000'),
      chainId: 1,
      accessList: [
        {
          address:
            '0x6B175474E89094C44Da98b954EedeAC495271d0F' as `0x${string}`, // DAI contract
          storageKeys: [
            '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
            '0x0000000000000000000000000000000000000000000000000000000000000002' as `0x${string}`,
          ],
        },
        {
          address:
            '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`, // Recipient
          storageKeys: [
            '0x0000000000000000000000000000000000000000000000000000000000000003' as `0x${string}`,
          ],
        },
      ],
    },
    category: 'multi-access-list',
  },
  {
    name: 'Empty access list - EIP-2930',
    tx: {
      type: 'eip2930',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('500000000000000000'), // 0.5 ETH
      nonce: 5,
      gasPrice: BigInt('15000000000'), // 15 gwei
      gas: BigInt('21000'),
      chainId: 1,
      accessList: [],
    },
    category: 'empty-access-list',
  },
  {
    name: 'Complex DeFi interaction - EIP-2930',
    tx: {
      type: 'eip2930',
      to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' as `0x${string}`, // Uniswap V2 Router
      value: BigInt(0),
      data: '0x38ed17390000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000c7d713b49da000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000742d35cc6b2d9e9a3b7b7b4a7b0b2b7b0b2b7b0b000000000000000000000000000000000000000000000000000000006553f10000000000000000000000000000000000000000000000000000000000000000020000000000000000000000006b175474e89094c44da98b954eedeac495271d0f000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7' as `0x${string}`,
      nonce: 10,
      gasPrice: BigInt('30000000000'), // 30 gwei
      gas: BigInt('200000'),
      chainId: 1,
      accessList: [
        {
          address:
            '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' as `0x${string}`, // Router
          storageKeys: [
            '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
            '0x0000000000000000000000000000000000000000000000000000000000000002' as `0x${string}`,
          ],
        },
        {
          address:
            '0x6B175474E89094C44Da98b954EedeAC495271d0F' as `0x${string}`, // DAI
          storageKeys: [
            '0x0000000000000000000000000000000000000000000000000000000000000003' as `0x${string}`,
            '0x0000000000000000000000000000000000000000000000000000000000000004' as `0x${string}`,
          ],
        },
        {
          address:
            '0xdAC17F958D2ee523a2206206994597C13D831ec7' as `0x${string}`, // USDT
          storageKeys: [
            '0x0000000000000000000000000000000000000000000000000000000000000005' as `0x${string}`,
          ],
        },
      ],
    },
    category: 'defi-complex',
  },
];

// =============================================================================
// EIP-7702 TRANSACTION VECTORS (Account Abstraction)
// =============================================================================

export const EIP7702_TEST_VECTORS: TestVector[] = [
  {
    name: 'Simple authorization - EIP-7702',
    tx: {
      type: 'eip7702',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('30000000000'), // 30 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('100000'),
      chainId: 1,
      accessList: [],
      authorizationList: [
        {
          chainId: 1,
          address:
            '0x1111111111111111111111111111111111111111' as `0x${string}`,
          nonce: 0,
          yParity: 0,
          r: '0x1111111111111111111111111111111111111111111111111111111111111111' as `0x${string}`,
          s: '0x2222222222222222222222222222222222222222222222222222222222222222' as `0x${string}`,
        },
      ],
    },
    category: 'simple-auth',
  },
  {
    name: 'Multiple authorizations - EIP-7702',
    tx: {
      type: 'eip7702',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('500000000000000000'), // 0.5 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 1,
      maxFeePerGas: BigInt('40000000000'), // 40 gwei
      maxPriorityFeePerGas: BigInt('3000000000'), // 3 gwei
      gas: BigInt('150000'),
      chainId: 1,
      accessList: [],
      authorizationList: [
        {
          chainId: 1,
          address:
            '0x1111111111111111111111111111111111111111' as `0x${string}`,
          nonce: 0,
          yParity: 0,
          r: '0x1111111111111111111111111111111111111111111111111111111111111111' as `0x${string}`,
          s: '0x2222222222222222222222222222222222222222222222222222222222222222' as `0x${string}`,
        },
        {
          chainId: 1,
          address:
            '0x3333333333333333333333333333333333333333' as `0x${string}`,
          nonce: 1,
          yParity: 1,
          r: '0x3333333333333333333333333333333333333333333333333333333333333333' as `0x${string}`,
          s: '0x4444444444444444444444444444444444444444444444444444444444444444' as `0x${string}`,
        },
      ],
    },
    category: 'multi-auth',
  },
  {
    name: 'Authorization with access list - EIP-7702',
    tx: {
      type: 'eip7702',
      to: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as `0x${string}`, // DAI
      value: BigInt(0),
      data: '0xa9059cbb000000000000000000000000742d35cc6b2d9e9a3b7b7b4a7b0b2b7b0b2b7b0b0000000000000000000000000000000000000000000000001bc16d674ec80000' as `0x${string}`,
      nonce: 2,
      maxFeePerGas: BigInt('35000000000'), // 35 gwei
      maxPriorityFeePerGas: BigInt('2500000000'), // 2.5 gwei
      gas: BigInt('120000'),
      chainId: 1,
      accessList: [
        {
          address:
            '0x6B175474E89094C44Da98b954EedeAC495271d0F' as `0x${string}`,
          storageKeys: [
            '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
          ],
        },
      ],
      authorizationList: [
        {
          chainId: 1,
          address:
            '0x5555555555555555555555555555555555555555' as `0x${string}`,
          nonce: 0,
          yParity: 0,
          r: '0x5555555555555555555555555555555555555555555555555555555555555555' as `0x${string}`,
          s: '0x6666666666666666666666666666666666666666666666666666666666666666' as `0x${string}`,
        },
      ],
    },
    category: 'auth-with-access-list',
  },
];

// =============================================================================
// EDGE CASES & BOUNDARY CONDITIONS
// =============================================================================

export const EDGE_CASE_TEST_VECTORS: TestVector[] = [
  {
    name: 'Maximum nonce value - Legacy',
    tx: {
      type: 'legacy',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000'), // 0.001 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 2 ** 32 - 1, // Maximum safe 32-bit integer
      gasPrice: BigInt('20000000000'), // 20 gwei
      gas: BigInt('21000'),
      chainId: 1,
    },
    category: 'max-nonce',
  },
  {
    name: 'Maximum gas price - Legacy',
    tx: {
      type: 'legacy',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000'), // 0.001 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      gasPrice: BigInt('1000000000000'), // 1000 gwei (very high)
      gas: BigInt('21000'),
      chainId: 1,
    },
    category: 'max-gas-price',
  },
  {
    name: 'Minimal gas limit - EIP-1559',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000'), // 0.001 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'), // 20 gwei
      maxPriorityFeePerGas: BigInt('1000000000'), // 1 gwei
      gas: BigInt('21000'), // Minimum for ETH transfer
      chainId: 1,
    },
    category: 'min-gas',
  },
  {
    name: 'Large data payload - EIP-1559',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(0),
      data: ('0x' + 'a'.repeat(1000)) as `0x${string}`, // Large data payload
      nonce: 0,
      maxFeePerGas: BigInt('30000000000'), // 30 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('500000'), // High gas for large data
      chainId: 1,
    },
    category: 'large-data',
  },
  {
    name: 'Contract creation - Legacy',
    tx: {
      type: 'legacy',
      to: undefined, // Contract creation
      value: BigInt(0),
      data: '0x608060405234801561001057600080fd5b506040518060400160405280600681526020017f48656c6c6f210000000000000000000000000000000000000000000000000000815250600090805190602001906100609291906100c7565b5034801561006d57600080fd5b5061016c565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106100a657805160ff19168380011785556100d4565b828001600101855582156100d4579182015b828111156100d35782518255916020019190600101906100b8565b5b5090506100e191906100e5565b5090565b61010791905b808211156101035760008160009055506001016100eb565b5090565b90565b610455806101186000396000f3fe' as `0x${string}`,
      nonce: 0,
      gasPrice: BigInt('20000000000'), // 20 gwei
      gas: BigInt('2000000'), // High gas for contract creation
      chainId: 1,
    },
    category: 'contract-creation',
  },
  {
    name: 'Zero gas price - Legacy (pre-EIP-155)',
    tx: {
      type: 'legacy',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000'), // 0.001 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      gasPrice: BigInt(0), // Zero gas price
      gas: BigInt('21000'),
      // No chainId for pre-EIP-155
    },
    category: 'zero-gas-price',
  },
  {
    name: 'Alternative chain IDs - Polygon',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 MATIC
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('30000000000'), // 30 gwei
      maxPriorityFeePerGas: BigInt('30000000000'), // 30 gwei
      gas: BigInt('21000'),
      chainId: 137,
    },
    category: 'alt-chains',
  },
  {
    name: 'Alternative chain IDs - BSC',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 BNB
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('5000000000'), // 5 gwei
      maxPriorityFeePerGas: BigInt('1000000000'), // 1 gwei
      gas: BigInt('21000'),
      chainId: 56,
    },
    category: 'alt-chains',
  },
  {
    name: 'Alternative chain IDs - Avalanche',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 AVAX
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('25000000000'), // 25 gwei
      maxPriorityFeePerGas: BigInt('1500000000'), // 1.5 gwei
      gas: BigInt('21000'),
      chainId: 43114,
    },
    category: 'alt-chains',
  },
  {
    name: 'Large chain ID - Palm Network',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 PALM
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'), // 20 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('21000'),
      chainId: 11297108109,
    },
    category: 'large-chain-id',
  },
  {
    name: 'Unknown chain ID',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'), // 20 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('21000'),
      chainId: 9999,
    },
    category: 'unknown-chain',
  },
  {
    name: 'Minimal value - 1 wei',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(1), // 1 wei
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'), // 20 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('21000'),
      chainId: 1,
    },
    category: 'min-value',
  },
  {
    name: 'Scientific notation value - 1e8 wei',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('100000000000'), // 1e8 wei = 0.1 gwei
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'), // 20 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('21000'),
      chainId: 1,
    },
    category: 'scientific-value',
  },
  {
    name: 'Maximum safe value',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      ), // Max uint256
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'), // 20 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('21000'),
      chainId: 1,
    },
    category: 'max-value',
  },
  {
    name: 'Contract creation - EIP-1559',
    tx: {
      type: 'eip1559',
      to: undefined, // Contract creation
      value: BigInt(0),
      data: ('0x' + '60'.repeat(96)) as `0x${string}`, // Simple contract bytecode
      nonce: 0,
      maxFeePerGas: BigInt('30000000000'), // 30 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('2000000'), // High gas for contract creation
      chainId: 1,
    },
    category: 'contract-creation',
  },
  {
    name: 'Contract creation - EIP-2930',
    tx: {
      type: 'eip2930',
      to: undefined, // Contract creation
      value: BigInt(0),
      data: ('0x' + '60'.repeat(96)) as `0x${string}`, // Simple contract bytecode
      nonce: 0,
      gasPrice: BigInt('25000000000'), // 25 gwei
      gas: BigInt('2000000'), // High gas for contract creation
      chainId: 1,
      accessList: [],
    },
    category: 'contract-creation',
  },
  {
    name: 'EIP-2930 with mixed storage keys',
    tx: {
      type: 'eip2930',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      gasPrice: BigInt('20000000000'), // 20 gwei
      gas: BigInt('100000'),
      chainId: 1,
      accessList: [
        {
          address:
            '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
          storageKeys: [
            '0x7154f8b310ad6ce97ce3b15e3419d9863865dfe2d8635802f7f4a52a206255a6' as `0x${string}`,
          ],
        },
        {
          address:
            '0xe0f8ff08ef0242c461da688b8b85e438db724860' as `0x${string}`,
          storageKeys: [], // Empty storage keys
        },
      ],
    },
    category: 'mixed-access-list',
  },
  {
    name: 'EIP-1559 with access list',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('30000000000'), // 30 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('100000'),
      chainId: 1,
      accessList: [
        {
          address:
            '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
          storageKeys: [
            '0x7154f8b310ad6ce97ce3b15e3419d9863865dfe2d8635802f7f4a52a206255a6' as `0x${string}`,
          ],
        },
        {
          address:
            '0xe0f8ff08ef0242c461da688b8b85e438db724860' as `0x${string}`,
          storageKeys: [], // Empty storage keys
        },
      ],
    },
    category: 'eip1559-with-access-list',
  },
];

// =============================================================================
// COMPREHENSIVE DETERMINISTIC TEST VECTORS
// =============================================================================

/**
 * Test various derivation path lengths to ensure wallet compatibility
 */
export const DERIVATION_PATH_VECTORS: TestVector[] = [
  {
    name: 'Derivation path - Full BIP44 path (5 levels)',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'), // 20 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('21000'),
      chainId: 1,
    },
    category: 'derivation-path-5',
  },
  {
    name: 'Derivation path - 3 levels',
    tx: {
      type: 'legacy',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('500000000000000000'), // 0.5 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 1,
      gasPrice: BigInt('15000000000'), // 15 gwei
      gas: BigInt('21000'),
      chainId: 1,
    },
    category: 'derivation-path-3',
  },
  {
    name: 'Derivation path - 2 levels',
    tx: {
      type: 'eip2930',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('250000000000000000'), // 0.25 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 2,
      gasPrice: BigInt('10000000000'), // 10 gwei
      gas: BigInt('21000'),
      chainId: 1,
      accessList: [],
    },
    category: 'derivation-path-2',
  },
  {
    name: 'Derivation path - 1 level (root)',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('100000000000000000'), // 0.1 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 3,
      maxFeePerGas: BigInt('25000000000'), // 25 gwei
      maxPriorityFeePerGas: BigInt('2500000000'), // 2.5 gwei
      gas: BigInt('21000'),
      chainId: 1,
    },
    category: 'derivation-path-1',
  },
];

/**
 * Test specific network configurations that are commonly used
 */
export const NETWORK_SPECIFIC_VECTORS: TestVector[] = [
  {
    name: 'Rinkeby testnet (historical)',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'), // 20 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('21000'),
      chainId: 4, // Rinkeby
    },
    category: 'rinkeby',
  },
  {
    name: 'Goerli testnet',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'), // 20 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('21000'),
      chainId: 5, // Goerli
    },
    category: 'goerli',
  },
  {
    name: 'Sepolia testnet',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'), // 20 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('21000'),
      chainId: 11155111, // Sepolia
    },
    category: 'sepolia',
  },
];

/**
 * Test payload size boundaries to ensure proper handling of large transactions
 */
export const PAYLOAD_SIZE_VECTORS: TestVector[] = [
  {
    name: 'No data payload',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 ETH
      data: '0x' as `0x${string}`, // Fix undefined data field
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'), // 20 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('21000'),
      chainId: 1,
    },
    category: 'no-data',
  },
  {
    name: 'Small data payload (32 bytes)',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 ETH
      nonce: 0,
      maxFeePerGas: BigInt('30000000000'), // 30 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('50000'),
      chainId: 1,
      data: ('0x' + '00'.repeat(32)) as `0x${string}`,
    },
    category: 'small-data',
  },
  {
    name: 'Medium data payload (256 bytes)',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 ETH
      nonce: 0,
      maxFeePerGas: BigInt('30000000000'), // 30 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('100000'),
      chainId: 1,
      data: ('0x' + 'ab'.repeat(256)) as `0x${string}`,
    },
    category: 'medium-data',
  },
  {
    name: 'Large data payload (1024 bytes)',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 ETH
      nonce: 0,
      maxFeePerGas: BigInt('50000000000'), // 50 gwei
      maxPriorityFeePerGas: BigInt('3000000000'), // 3 gwei
      gas: BigInt('500000'),
      chainId: 1,
      data: ('0x' + 'cd'.repeat(1024)) as `0x${string}`,
    },
    category: 'large-data',
  },
  {
    name: 'Very large data payload (2000 bytes)',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'), // 1 ETH
      nonce: 0,
      maxFeePerGas: BigInt('50000000000'), // 50 gwei
      maxPriorityFeePerGas: BigInt('3000000000'), // 3 gwei
      gas: BigInt('1000000'),
      chainId: 1,
      data: ('0x' + 'ef'.repeat(2000)) as `0x${string}`,
    },
    category: 'very-large-data',
  },
];

/**
 * Comprehensive boundary condition test vectors
 */
export const BOUNDARY_CONDITION_VECTORS: TestVector[] = [
  {
    name: 'Maximum nonce (2^32-1)',
    tx: {
      type: 'legacy',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000'), // 1 ETH
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 2 ** 32 - 1,
      gasPrice: BigInt('20000000000'),
      gas: BigInt('21000'),
      chainId: 1,
    },
    category: 'max-nonce',
  },
  {
    name: 'Maximum safe chain ID',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'),
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'),
      maxPriorityFeePerGas: BigInt('2000000000'),
      gas: BigInt('21000'),
      chainId: Number.MAX_SAFE_INTEGER,
    },
    category: 'max-chain-id',
  },
  {
    name: 'Minimum gas limit (21000)',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(1),
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('1'), // 1 wei
      maxPriorityFeePerGas: BigInt('1'),
      gas: BigInt('21000'), // Minimum for ETH transfer
      chainId: 1,
    },
    category: 'min-gas',
  },
  {
    name: 'Maximum gas limit',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('1000000000000000000'),
      data: '0x' as `0x${string}`, // Add missing data field
      nonce: 0,
      maxFeePerGas: BigInt('100000000000'), // 100 gwei
      maxPriorityFeePerGas: BigInt('5000000000'), // 5 gwei
      gas: BigInt('30000000'), // Block gas limit
      chainId: 1,
    },
    category: 'max-gas',
  },
];

/**
 * Test specific transaction patterns from real-world usage
 */
export const REAL_WORLD_PATTERN_VECTORS: TestVector[] = [
  {
    name: 'DeFi approval transaction',
    tx: {
      type: 'eip1559',
      to: '0xA0b86a33E6417c14f8c9C4E5659dF7a08D2C65c3' as `0x${string}`, // Example DeFi contract
      value: BigInt(0),
      data: '0x095ea7b3000000000000000000000000742d35cc6b2d9e9a3b7b7b4a7b0b2b7b0b2b7b0bffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' as `0x${string}`, // approve(spender, amount)
      nonce: 5,
      maxFeePerGas: BigInt('25000000000'), // 25 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      gas: BigInt('46000'), // Typical for ERC20 approval
      chainId: 1,
    },
    category: 'defi-approval',
  },
  {
    name: 'NFT minting transaction',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('50000000000000000'), // 0.05 ETH mint fee
      data: '0x40c10f19000000000000000000000000742d35cc6b2d9e9a3b7b7b4a7b0b2b7b0b2b7b0b0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`, // mint(to, tokenId)
      nonce: 10,
      maxFeePerGas: BigInt('30000000000'), // 30 gwei
      maxPriorityFeePerGas: BigInt('3000000000'), // 3 gwei
      gas: BigInt('200000'), // Higher gas for NFT mint
      chainId: 1,
    },
    category: 'nft-mint',
  },
  {
    name: 'Multi-send transaction',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(0),
      data: ('0x8d80ff0a' + '00'.repeat(500)) as `0x${string}`, // multiSend with batch data
      nonce: 15,
      maxFeePerGas: BigInt('40000000000'), // 40 gwei
      maxPriorityFeePerGas: BigInt('4000000000'), // 4 gwei
      gas: BigInt('800000'), // High gas for multi-send
      chainId: 1,
    },
    category: 'multi-send',
  },
];

/**
 * All comprehensive test vectors combined for easy access
 */
export const ALL_COMPREHENSIVE_VECTORS: TestVector[] = [
  ...LEGACY_VECTORS,
  ...EIP1559_TEST_VECTORS,
  ...EIP2930_TEST_VECTORS,
  ...EIP7702_TEST_VECTORS,
  ...EDGE_CASE_TEST_VECTORS,
  ...DERIVATION_PATH_VECTORS,
  ...NETWORK_SPECIFIC_VECTORS,
  ...PAYLOAD_SIZE_VECTORS,
  ...BOUNDARY_CONDITION_VECTORS,
  ...REAL_WORLD_PATTERN_VECTORS,
];

/**
 * Get vectors by category for targeted testing
 */
export function getVectorsByCategory(category: string): TestVector[] {
  return ALL_COMPREHENSIVE_VECTORS.filter(
    (vector) => vector.category === category,
  );
}

/**
 * Get a specific number of vectors from each transaction type for balanced testing
 */
export function getBalancedTestVectors(perType: number = 3): TestVector[] {
  const legacyVectors = LEGACY_VECTORS.slice(0, perType);
  const eip1559Vectors = EIP1559_TEST_VECTORS.slice(0, perType);
  const eip2930Vectors = EIP2930_TEST_VECTORS.slice(0, perType);
  const eip7702Vectors = EIP7702_TEST_VECTORS.slice(0, perType);

  return [
    ...legacyVectors,
    ...eip1559Vectors,
    ...eip2930Vectors,
    ...eip7702Vectors,
  ];
}

/**
 * Get vectors for boundary testing specifically
 */
export function getBoundaryTestVectors(): TestVector[] {
  return [
    ...BOUNDARY_CONDITION_VECTORS,
    ...EDGE_CASE_TEST_VECTORS,
    ...PAYLOAD_SIZE_VECTORS,
  ];
}

/**
 * Get vectors for network compatibility testing
 */
export function getNetworkTestVectors(): TestVector[] {
  return [
    ...NETWORK_SPECIFIC_VECTORS,
    // Add some edge cases with different networks
    ...EDGE_CASE_TEST_VECTORS.filter((v) => v.category?.includes('chain')),
  ];
}
