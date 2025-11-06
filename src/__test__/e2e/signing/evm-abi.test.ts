/**
 * Test ABI decoding of various EVM smart contract function calls.
 * These transactions use contract addresses so the device can fetch ABI data dynamically.
 */

import { sign } from '../../../api';
import { setupClient } from '../../utils/setup';
import { ABI_TEST_VECTORS } from '../../vectors/abi-vectors';

describe('[EVM ABI] ABI Decoding Tests', () => {
  beforeAll(async () => {
    await setupClient();
  });

  describe('ABI Patterns with Complex Structures', () => {
    ABI_TEST_VECTORS.forEach((testCase, index) => {
      it(`Should test ${testCase.name} (${index + 1}/${ABI_TEST_VECTORS.length})`, async () => {
        const result = await sign(testCase.tx);
        expect(result).toBeDefined();
        expect(result.sig).toBeDefined();
        expect(result.sig.r).toBeDefined();
        expect(result.sig.s).toBeDefined();
        expect(result.sig.v).toBeDefined();
      });
    });
  });
});
