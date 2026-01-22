import { Command } from 'commander';
import { Utils, setup } from 'gridplus-sdk';
import {
  SIMULATOR_DEFAULTS,
  error,
  getStoredClient,
  info,
  promptAppName,
  promptDeviceId,
  promptPassword,
  saveSession,
  setStoredClient,
  success,
  withSpinner,
} from '../lib/index.js';

export const setupCommand = new Command('setup')
  .description(
    'Interactive device setup - configure connection to your Lattice',
  )
  .option('-d, --device-id <id>', 'Device ID (skip prompt)')
  .option('-p, --password <password>', 'Device password (skip prompt)')
  .option('-n, --name <name>', 'App name shown on device')
  .option('--base-url <url>', 'Custom base URL for Lattice relay')
  .option(
    '-s, --simulator',
    'Use simulator defaults (localhost:3000, SD0001, etc.)',
  )
  .action(async (options) => {
    try {
      const isSimulator = options.simulator === true;

      if (isSimulator) {
        info('Setting up connection to lattice-simulator...');
      } else {
        info('Setting up GridPlus Lattice connection...');
      }

      // Get device ID (use simulator default if --simulator flag)
      const deviceId = isSimulator
        ? SIMULATOR_DEFAULTS.deviceId
        : options.deviceId || (await promptDeviceId());

      // Get password (use simulator default if --simulator flag)
      const password = isSimulator
        ? SIMULATOR_DEFAULTS.password
        : options.password || (await promptPassword());

      // Get app name
      const name =
        options.name || (isSimulator ? 'GridPlus CLI' : await promptAppName());

      // Generate app secret from credentials
      const appSecret = Utils.generateAppSecret(deviceId, password, name);
      const appSecretHex = appSecret.toString('hex');

      // Determine base URL (use simulator default if --simulator flag)
      const baseUrl = isSimulator
        ? SIMULATOR_DEFAULTS.baseUrl
        : options.baseUrl || 'https://signing.gridpl.us';

      // Save session data first so the SDK callbacks can use it
      saveSession({
        deviceId,
        baseUrl,
        name,
        appSecret: appSecretHex,
        isSimulator,
      });

      // Try to connect using the SDK
      const isPaired = await withSpinner(
        'Connecting to device...',
        async () => {
          return setup({
            deviceId,
            password,
            name,
            appSecret: appSecretHex,
            baseUrl,
            getStoredClient,
            setStoredClient,
          });
        },
      );

      if (isPaired) {
        success('Device setup complete! Already paired.');
        info('You can now use other commands to interact with your Lattice.');
      } else {
        success('Device connected but not yet paired.');
        if (isSimulator) {
          info('Run "gp pair --simulator" to auto-pair with the simulator.');
        } else {
          info('Run "gp pair" to complete pairing with your device.');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error(`Setup failed: ${message}`);
      process.exit(1);
    }
  });
