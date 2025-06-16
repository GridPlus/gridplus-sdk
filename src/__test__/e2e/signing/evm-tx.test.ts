/**
Test various EVM transaction types using viem-style transactions and the sign API.
Compare signatures against viem wallets for verification.
 */
import { parseEther, parseGwei } from 'viem';
import { randomBytes } from '../../../util';
import {
  signAndCompareTransaction,
  type TestTransaction,
} from '../../utils/viemComparison';
import { setupClient } from '../../utils/setup';

// Helper to generate random hex strings
const randomHex = (bytes: number): `0x${string}` => 
  `0x${randomBytes(bytes).toString('hex')}` as `0x${string}`;

// Helper to generate random bigint within range
const randomBigInt = (maxBytes: number = 8): bigint => {
  const bytes = randomBytes(Math.floor(Math.random() * maxBytes) + 1);
  return BigInt(`0x${bytes.toString('hex')}`);
};

const TEST_VECTORS: Array<{ name: string; tx: TestTransaction }> = [
  {
    name: 'Legacy Transaction',
    tx: {
      type: 'legacy',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(100),
      data: '0x',
      nonce: 0,
      gasPrice: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: 1,
    },
  },
  {
    name: 'EIP-1559 Transaction',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(100),
      data: '0x',
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: 1,
    },
  },
  {
    name: 'EIP-2930 Transaction',
    tx: {
      type: 'eip2930',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(100),
      data: '0x',
      nonce: 0,
      gasPrice: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: 1,
      accessList: [],
    },
  },
  {
    name: 'EIP-7702 Transaction',
    tx: {
      type: 'eip7702',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(100),
      data: '0x',
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: 1,
      authorizationList: [
        {
          chainId: 1,
          address:
            '0x2222222222222222222222222222222222222222' as `0x${string}`,
          nonce: 0,
          yParity: 0,
          r: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
          s: '0x0000000000000000000000000000000000000000000000000000000000000002' as `0x${string}`,
        },
      ],
    },
  },
  {
    name: 'EIP-1559 with Access List',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(100),
      data: '0x',
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(50000),
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
          storageKeys: [],
        },
      ],
    },
  },
  {
    name: 'Contract Deployment',
    tx: {
      type: 'eip1559',
      to: null,
      value: BigInt(0),
      data: '0x608060405234801561001057600080fd5b50' as `0x${string}`, // Simplified bytecode
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(500000),
      chainId: 1,
    },
  },
  {
    name: 'Polygon Transaction',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(100),
      data: '0x',
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: 137,
    },
  },
  {
    name: 'BSC Transaction',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(100),
      data: '0x',
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: 56,
    },
  },
  {
    name: 'Avalanche Transaction',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(100),
      data: '0x',
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: 43114,
    },
  },
  {
    name: 'High Value Transaction (1 ETH)',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: parseEther('1'),
      data: '0x',
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: 1,
    },
  },
  {
    name: 'High Value Transaction (1000 ETH)',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: parseEther('1000'),
      data: '0x',
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: 1,
    },
  },
  {
    name: 'Minimal Value Transaction (1 wei)',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(1),
      data: '0x',
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: 1,
    },
  },
  {
    name: 'Non-EIP155 Legacy Transaction (pre-EIP155)',
    tx: {
      type: 'legacy',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(100),
      data: '0x',
      nonce: 0,
      gasPrice: BigInt(1200000000),
      gas: BigInt(50000),
      // No chainId for pre-EIP155
    },
  },
  {
    name: 'Rinkeby Testnet Transaction',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(100),
      data: '0x',
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: 4, // Rinkeby chainId
    },
  },
  {
    name: 'Unknown Chain Transaction',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(100),
      data: '0x',
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: 9999,
    },
  },
  {
    name: 'Palm Network Transaction',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(100),
      data: '0x',
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: 11297108109,
    },
  },
  {
    name: 'Max Safe ChainID Transaction',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(100),
      data: '0x',
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: Number.MAX_SAFE_INTEGER, // 9007199254740991
    },
  },
  {
    name: '1e-8 ETH Value Transaction',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(10000000000), // 1e-8 ETH
      data: '0x',
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: 1,
    },
  },
  {
    name: '1e-7 ETH Value Transaction',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(100000000000), // 1e-7 ETH
      data: '0x',
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: 1,
    },
  },
  {
    name: 'Max Value Transaction (UINT256_MAX)',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
      data: '0x',
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: 1,
    },
  },
  {
    name: 'Large Data Payload Transaction',
    tx: {
      type: 'eip1559',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(0),
      data: randomHex(1000), // 1KB of data
      nonce: 0,
      maxFeePerGas: BigInt(1200000000),
      maxPriorityFeePerGas: BigInt(1200000000),
      gas: BigInt(1000000),
      chainId: 1,
    },
  },
  {
    name: 'Legacy Contract Deployment',
    tx: {
      type: 'legacy',
      to: null,
      value: BigInt(0),
      data: randomHex(96),
      nonce: 0,
      gasPrice: BigInt(1200000000),
      gas: BigInt(500000),
      chainId: 1,
    },
  },
  {
    name: 'EIP-2930 with Access List',
    tx: {
      type: 'eip2930',
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
      value: BigInt(100),
      data: '0x',
      nonce: 0,
      gasPrice: BigInt(1200000000),
      gas: BigInt(50000),
      chainId: 1,
      accessList: [
        {
          address: '0xe242e54155b1abc71fc118065270cecaaf8b7768' as `0x${string}`,
          storageKeys: [
            '0x7154f8b310ad6ce97ce3b15e3419d9863865dfe2d8635802f7f4a52a206255a6' as `0x${string}`,
          ],
        },
        {
          address: '0xe0f8ff08ef0242c461da688b8b85e438db724860' as `0x${string}`,
          storageKeys: [],
        },
      ],
    },
  },
];

// Generate random transaction test vectors
const generateRandomTransactionVectors = (count: number): Array<{ name: string; tx: TestTransaction }> => {
  const vectors = [];
  for (let i = 0; i < count; i++) {
    const chainId = Math.floor(Math.random() * 10000) + 1;
    const transactionTypes = ['legacy', 'eip1559', 'eip2930'] as const;
    const txType = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
    
    const baseTx = {
      to: randomHex(20),
      value: randomBigInt(32),
      data: randomHex(Math.floor(Math.random() * 500)),
      nonce: Math.floor(Math.random() * 1000),
      gas: BigInt(50000 + Math.floor(Math.random() * 950000)),
      chainId,
    };

    let tx: TestTransaction;
    switch (txType) {
      case 'legacy':
        tx = {
          ...baseTx,
          type: 'legacy',
          gasPrice: randomBigInt(4),
        };
        break;
      case 'eip2930':
        tx = {
          ...baseTx,
          type: 'eip2930',
          gasPrice: randomBigInt(4),
          accessList: [],
        };
        break;
      case 'eip1559':
      default:
        tx = {
          ...baseTx,
          type: 'eip1559',
          maxFeePerGas: randomBigInt(4),
          maxPriorityFeePerGas: randomBigInt(4),
        };
        break;
    }

    vectors.push({
      name: `Random ${txType} Transaction #${i + 1}`,
      tx,
    });
  }
  return vectors;
};

describe('[EVM TX] Signature Comparison Tests', () => {
  beforeAll(async () => {
    await setupClient();
  });

  describe('[EVM] Test transaction vectors with signature comparison', () => {
    TEST_VECTORS.forEach((vector, index) => {
      it(`Should test ${vector.name} ${index + 1} of ${TEST_VECTORS.length}`, async () => {
        await signAndCompareTransaction(vector.tx, vector.name);
      });
    });
  });

  describe('[EVM] Random transaction tests', () => {
    const randomVectors = generateRandomTransactionVectors(5); // Generate 5 random transactions
    randomVectors.forEach((vector) => {
      it(`Should test ${vector.name}`, async () => {
        await signAndCompareTransaction(vector.tx, vector.name);
      });
    });
  });
});
