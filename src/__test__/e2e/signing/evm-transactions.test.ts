/**
 * Unified EVM Transaction Test Suite
 * 
 * This single test file contains ALL EVM transaction tests organized by transaction type.
 * Each transaction type has its own describe block with comprehensive test vectors.
 * This replaces all individual EVM test files to avoid duplication and provide unified testing.
 */
import { describe, it, beforeAll } from 'vitest';
import { signAndCompareTransaction } from '../../utils/viemComparison';
import { setupClient } from '../../utils/setup';
import {
  LEGACY_VECTORS,
  EIP1559_TEST_VECTORS,
  EIP2930_TEST_VECTORS,
  EIP7702_TEST_VECTORS,
  EDGE_CASE_TEST_VECTORS,
  generateRandomLegacyTransactionVectors,
  generateRandomEIP1559TransactionVectors,
  generateRandomEIP2930TransactionVectors,
  generateRandomEIP7702TransactionVectors,
  generateRandomMixedTransactionVectors,
} from './vectors';

describe('EVM Transaction Signing - Unified Test Suite', () => {
  beforeAll(async () => {
    await setupClient();
  });

  describe('Legacy Transactions', () => {
    describe('Standard Legacy Vectors', () => {
      LEGACY_VECTORS.forEach((vector, index) => {
        it(`${vector.name} (${index + 1}/${LEGACY_VECTORS.length})`, async () => {
          await signAndCompareTransaction(vector.tx, vector.name);
        });
      });
    });

    describe('Random Legacy Vectors', () => {
      const randomVectors = generateRandomLegacyTransactionVectors(3);
      randomVectors.forEach((vector) => {
        it(vector.name, async () => {
          await signAndCompareTransaction(vector.tx, vector.name);
        });
      });
    });
  });

  describe('EIP-1559 Transactions (Fee Market)', () => {
    describe('Standard EIP-1559 Vectors', () => {
      EIP1559_TEST_VECTORS.forEach((vector, index) => {
        it(`${vector.name} (${index + 1}/${EIP1559_TEST_VECTORS.length})`, async () => {
          await signAndCompareTransaction(vector.tx, vector.name);
        });
      });
    });

    describe('Random EIP-1559 Vectors', () => {
      const randomVectors = generateRandomEIP1559TransactionVectors(5);
      randomVectors.forEach((vector) => {
        it(vector.name, async () => {
          await signAndCompareTransaction(vector.tx, vector.name);
        });
      });
    });
  });

  describe('EIP-2930 Transactions (Access Lists)', () => {
    describe('Standard EIP-2930 Vectors', () => {
      EIP2930_TEST_VECTORS.forEach((vector, index) => {
        it(`${vector.name} (${index + 1}/${EIP2930_TEST_VECTORS.length})`, async () => {
          await signAndCompareTransaction(vector.tx, vector.name);
        });
      });
    });

    describe('Random EIP-2930 Vectors', () => {
      const randomVectors = generateRandomEIP2930TransactionVectors(3);
      randomVectors.forEach((vector) => {
        it(vector.name, async () => {
          await signAndCompareTransaction(vector.tx, vector.name);
        });
      });
    });
  });

  describe('EIP-7702 Transactions (Account Abstraction)', () => {
    describe('Standard EIP-7702 Vectors', () => {
      EIP7702_TEST_VECTORS.forEach((vector, index) => {
        it(`${vector.name} (${index + 1}/${EIP7702_TEST_VECTORS.length})`, async () => {
          await signAndCompareTransaction(vector.tx, vector.name);
        });
      });
    });

    describe('Random EIP-7702 Vectors', () => {
      const randomVectors = generateRandomEIP7702TransactionVectors(3);
      randomVectors.forEach((vector) => {
        it(vector.name, async () => {
          await signAndCompareTransaction(vector.tx, vector.name);
        });
      });
    });
  });

  describe('Edge Cases & Boundary Conditions', () => {
    describe('Standard Edge Case Vectors', () => {
      EDGE_CASE_TEST_VECTORS.forEach((vector, index) => {
        it(`${vector.name} (${index + 1}/${EDGE_CASE_TEST_VECTORS.length})`, async () => {
          await signAndCompareTransaction(vector.tx, vector.name);
        });
      });
    });

    describe('Random Mixed Transaction Vectors', () => {
      const randomVectors = generateRandomMixedTransactionVectors(5);
      randomVectors.forEach((vector) => {
        it(vector.name, async () => {
          await signAndCompareTransaction(vector.tx, vector.name);
        });
      });
    });
  });
});