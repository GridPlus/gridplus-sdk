import { Command } from 'commander';
import { pair, setup } from 'gridplus-sdk';
import {
  SIMULATOR_DEFAULTS,
  error,
  getStoredClient,
  hasSession,
  info,
  loadSession,
  promptPairingCode,
  setStoredClient,
  success,
  withSpinner,
} from '../lib/index.js';

export const pairCommand = new Command('pair')
  .description('Pair with a Lattice device using a pairing code')
  .argument('[code]', 'Pairing code from device (or will prompt)')
  .option(
    '-s, --simulator',
    'Use simulator pairing secret (auto-pair with simulator)',
  )
  .action(async (code, options) => {
    try {
      // Check if we have a saved session
      if (!hasSession()) {
        error('No device configured. Run "gp setup" first.');
        process.exit(1);
      }

      const session = loadSession();
      if (!session) {
        error('Failed to load session data.');
        process.exit(1);
      }

      const isSimulator =
        options.simulator === true || session.isSimulator === true;

      // Get pairing code (use simulator default if --simulator flag or session is simulator)
      const pairingCode = isSimulator
        ? SIMULATOR_DEFAULTS.pairingSecret
        : code || (await promptPairingCode());

      if (isSimulator) {
        info('Initiating pairing with lattice-simulator...');
      } else {
        info('Initiating pairing with your Lattice device...');
        info('Please confirm the pairing request on your device screen.');
      }

      // Initialize the SDK with stored credentials
      await withSpinner('Setting up connection...', async () => {
        return setup({
          getStoredClient,
          setStoredClient,
        });
      });

      // Perform pairing
      const isPaired = await withSpinner('Pairing with device...', async () => {
        return pair(pairingCode);
      });

      if (isPaired) {
        success('Pairing successful!');
        if (isSimulator) {
          info('Your CLI is now paired with the simulator.');
        } else {
          info('Your CLI is now paired with your Lattice device.');
        }
        info('You can now use commands like "gp address" and "gp sign".');
      } else {
        error('Pairing failed. Please try again.');
        process.exit(1);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error(`Pairing failed: ${message}`);
      process.exit(1);
    }
  });
