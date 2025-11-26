import { mnemonicToSeedSync } from 'bip39';
/**
 * Common test constants used across the GridPlus SDK test suite
 *
 * These constants are shared across multiple test files to ensure consistency
 * and avoid duplication of test data.
 */

/**
 * Standard test mnemonic used for deterministic testing
 *
 * This mnemonic is used across multiple test files to ensure consistent
 * test behavior and deterministic results.
 */
export const TEST_MNEMONIC =
  'test test test test test test ' +
  'test test test test test junk';

/**
 * Shared seed derived from TEST_MNEMONIC
 *
 * Consumers can reuse this to avoid re-deriving the seed in each test.
 */
export const TEST_SEED = mnemonicToSeedSync(TEST_MNEMONIC);

/**
 * Foundry-compatible test mnemonic
 *
 * This mnemonic matches the standard Foundry test mnemonic for compatibility
 * with Foundry-based testing frameworks.
 */
export const FOUNDRY_TEST_MNEMONIC =
  'test test test test test test test test test test test junk';
