/**
 * Unified EVM Transaction Test Suite
 *
 * This single test file contains ALL EVM transaction tests organized by transaction type.
 * Each transaction type has its own describe block with comprehensive test vectors.
 * This replaces all individual EVM test files to avoid duplication and provide unified testing.
 */

import { setupClient } from "../../utils/clientStorage";
import { signAndCompareTransaction } from "../../utils/viemComparison";
import {
	EDGE_CASE_TEST_VECTORS,
	EIP1559_TEST_VECTORS,
	EIP2930_TEST_VECTORS,
	EIP7702_TEST_VECTORS,
	LEGACY_VECTORS,
} from "./vectors";

describe("EVM Transaction Signing - Unified Test Suite", () => {
	beforeAll(async () => {
		await setupClient();
	});

	describe("Legacy Transactions", () => {
		LEGACY_VECTORS.forEach((vector, index) => {
			it(`${vector.name} (${index + 1}/${LEGACY_VECTORS.length})`, async () => {
				await signAndCompareTransaction(vector.tx, vector.name);
			});
		});
	});

	describe("EIP-1559 Transactions (Fee Market)", () => {
		EIP1559_TEST_VECTORS.forEach((vector, index) => {
			it(`${vector.name} (${index + 1}/${EIP1559_TEST_VECTORS.length})`, async () => {
				await signAndCompareTransaction(vector.tx, vector.name);
			});
		});
	});

	describe("EIP-2930 Transactions (Access Lists)", () => {
		EIP2930_TEST_VECTORS.forEach((vector, index) => {
			it(`${vector.name} (${index + 1}/${EIP2930_TEST_VECTORS.length})`, async () => {
				await signAndCompareTransaction(vector.tx, vector.name);
			});
		});
	});

	describe("EIP-7702 Transactions (Account Abstraction)", () => {
		EIP7702_TEST_VECTORS.forEach((vector, index) => {
			it(`${vector.name} (${index + 1}/${EIP7702_TEST_VECTORS.length})`, async () => {
				await signAndCompareTransaction(vector.tx, vector.name);
			});
		});
	});

	describe("Edge Cases & Boundary Conditions", () => {
		EDGE_CASE_TEST_VECTORS.forEach((vector, index) => {
			it(`${vector.name} (${index + 1}/${EDGE_CASE_TEST_VECTORS.length})`, async () => {
				await signAndCompareTransaction(vector.tx, vector.name);
			});
		});
	});
});
