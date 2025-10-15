/**
 * Large Transaction Streaming Tests
 *
 * Tests SDK support for streaming Keccak-256 hashing for large transactions (~102KB).
 * Firmware v0.18.0+ enables streaming mode to handle transactions up to ~102KB vs the
 * previous ~3KB limit. These tests verify SDK compatibility with the new streaming feature.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { TransactionSerializable } from 'viem';
import { getClient, sign } from '../../../api';
import { randomBytes } from '../../../util';
import { setupClient } from '../../utils/setup';
import { signAndCompareTransaction } from '../../utils/viemComparison';

// Set a long timeout for these tests as they involve large data transfers and user interaction.
vi.setConfig({ testTimeout: 60000 });

describe('[EVM] Large Transaction Streaming', () => {
  beforeAll(async () => {
    await setupClient();
  });

  /**
   * Baseline: Ensures small transactions are unaffected by the new streaming logic.
   */
  it('Small transaction baseline', async () => {
    const tx: TransactionSerializable = {
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 1n,
      data: '0x',
      nonce: 0,
      gas: 21_000n,
      maxFeePerGas: 20_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      chainId: 1,
      type: 'eip1559',
    };

    await signAndCompareTransaction(tx, 'Small transaction baseline');
  });

  /**
   * Edge case: Transaction just over the old limit (~3.1KB) triggers streaming mode.
   * Verifies the firmware correctly transitions from buffering to streaming mode.
   */
  it('Transaction at streaming threshold (~3.1KB)', async () => {
    const dataSize = 3100; // Just over the old 1-frame limit
    const edgeData = `0x${randomBytes(dataSize).toString('hex')}`;

    const tx: TransactionSerializable = {
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 1n,
      data: edgeData,
      nonce: 1,
      gas: 100_000n,
      maxFeePerGas: 20_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      chainId: 1,
      type: 'eip1559',
    };

    await signAndCompareTransaction(tx, 'Streaming trigger edge case');
  });

  /**
   * Maximum size: Transaction using the full ~102KB payload capacity.
   * Verifies SDK can successfully build, send, and get a valid signature for max size.
   */
  it('Maximum size transaction (~102KB)', async () => {
    const client = await getClient();
    if (!client) throw new Error('Client not setup');
    const fwConstants = client.getFwConstants();
    const maxDataSz =
      fwConstants.genericSigning.baseDataSz +
      fwConstants.extraDataMaxFrames * fwConstants.extraDataFrameSz;

    const largeData = `0x${randomBytes(maxDataSz).toString('hex')}`;

    const tx: TransactionSerializable = {
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 1n,
      data: largeData,
      nonce: 2,
      gas: 2_000_000n, // High gas limit for large data
      maxFeePerGas: 20_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      chainId: 1,
      type: 'eip1559',
    };

    await signAndCompareTransaction(tx, 'Max size transaction');
  });

  /**
   * Preemptive rejection: Transaction exceeding the 102KB limit.
   * Ensures SDK validation rejects oversized transactions before sending to device.
   */
  it('Reject transaction exceeding max size (>102KB)', async () => {
    const client = await getClient();
    if (!client) throw new Error('Client not setup');
    const fwConstants = client.getFwConstants();
    const maxDataSz =
      fwConstants.genericSigning.baseDataSz +
      fwConstants.extraDataMaxFrames * fwConstants.extraDataFrameSz;
    const oversizedData = `0x${randomBytes(maxDataSz + 1).toString('hex')}`;

    const tx: TransactionSerializable = {
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 1n,
      data: oversizedData,
      nonce: 3,
      gas: 2_000_000n,
      maxFeePerGas: 20_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      chainId: 1,
      type: 'eip1559',
    };

    await expect(sign(tx)).rejects.toThrow(/Data field too large/);
  });

  /**
   * Timeout recovery: Verifies clean recovery after a timeout during multi-chunk transfer.
   * Device and SDK should cleanly recover to sign subsequent transactions.
   */
  it('Recover after timeout during streaming', async () => {
    const client = await getClient();
    if (!client) throw new Error('Client not setup');
    const originalTimeout = client.timeout;

    try {
      // Set a very short timeout to force a failure.
      client.timeout = 10; // 10ms

      const largeData = `0x${randomBytes(10000).toString('hex')}`; // 10KB, requires multiple chunks
      const txLarge: TransactionSerializable = {
        to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
        value: 1n,
        data: largeData,
        nonce: 4,
        gas: 500_000n,
        maxFeePerGas: 20_000_000_000n,
        maxPriorityFeePerGas: 1_000_000_000n,
        chainId: 1,
        type: 'eip1559',
      };

      // Expect this to fail with a timeout
      await expect(sign(txLarge)).rejects.toThrow(/Timeout/);

      // Reset timeout to its original value
      client.timeout = originalTimeout;

      // Allow a moment for any state to clear
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Now, try a small transaction and expect it to succeed
      const txSmall: TransactionSerializable = {
        to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
        value: 1n,
        data: '0x',
        nonce: 5, // Use a new nonce to avoid replacement errors
        gas: 21_000n,
        maxFeePerGas: 20_000_000_000n,
        maxPriorityFeePerGas: 1_000_000_000n,
        chainId: 1,
        type: 'eip1559',
      };

      // This should succeed, proving the device recovered cleanly.
      await signAndCompareTransaction(txSmall, 'Timeout recovery transaction');
    } finally {
      // Ensure timeout is always reset, even if the test fails
      client.timeout = originalTimeout;
    }
  });
});
