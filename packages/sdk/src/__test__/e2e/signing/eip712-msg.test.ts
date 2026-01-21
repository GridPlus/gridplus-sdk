import { setupClient } from '../../utils/setup';
/**
 * EIP-712 Typed Data Message Signing Test Suite
 *
 * Tests EIP-712 message signing compatibility between Lattice and viem.
 * Replaces the forge-based contract test with a pure signature comparison approach.
 */
import { signAndCompareEIP712Message } from '../../utils/viemComparison';
import { EIP712_MESSAGE_VECTORS } from './eip712-vectors';

describe('EIP-712 Message Signing - Viem Compatibility', () => {
  beforeAll(async () => {
    await setupClient();
  });

  EIP712_MESSAGE_VECTORS.forEach((vector, index) => {
    it(`${vector.name} (${index + 1}/${EIP712_MESSAGE_VECTORS.length})`, async () => {
      await signAndCompareEIP712Message(vector.message, vector.name);
    });
  });
});
