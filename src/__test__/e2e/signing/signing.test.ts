/**
 * Test generic signing. We will validate signatures using unformatted message types
 * (i.e. `encodingType=null`) and then we will validate signatures using firmware
 * decoders. As new decoders are added, we will add more test files in this directory.
 *
 * We will keep some stuff in state so that it can be easily reused by the
 * individual test files. This is accessible via `test`.
 *
 * You must have `FEATURE_TEST_RUNNER=0` enabled in firmware to run these tests.
 */
import { initializeClient } from '../../utils/initializeClient';
import { runDeterminismTests } from './determinism.test';
import { runEvmTests } from './evm.test';
import { runSolanaTests } from './solana.test';
import { runUnformattedTests } from './unformatted.test';

const client = initializeClient();

describe('Test General Signing', () => {
  it('Should verify firmware version.', async () => {
    const fwConstants = client.getFwConstants();
    if (!fwConstants.genericSigning) {
      throw new Error('Firmware must be updated to run this ');
    }
    const fwVersion = client.getFwVersion();
    if (fwVersion.major === 0 && fwVersion.minor < 15) {
      throw new Error('Please update Lattice firmware.');
    }
  });

  runDeterminismTests({ client })
  runUnformattedTests({ client })
  runSolanaTests({ client });
  runEvmTests({ client });
});
