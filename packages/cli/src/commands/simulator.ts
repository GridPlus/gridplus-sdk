import { Command } from 'commander';
import { Utils, pair, setup } from 'gridplus-sdk';
import {
  SIMULATOR_DEFAULTS,
  error,
  getStoredClient,
  info,
  saveSession,
  setStoredClient,
  success,
  withSpinner,
} from '../lib/index.js';

/**
 * One-shot setup command for simulator - combines setup + pair
 */
const simulatorSetupCommand = new Command('setup')
  .description('One-shot setup and pair with lattice-simulator')
  .option('-n, --name <name>', 'App name shown on device', 'GridPlus CLI')
  .action(async (options) => {
    try {
      info('Setting up connection to lattice-simulator...');
      info(`  URL: ${SIMULATOR_DEFAULTS.baseUrl}`);
      info(`  Device ID: ${SIMULATOR_DEFAULTS.deviceId}`);

      const deviceId = SIMULATOR_DEFAULTS.deviceId;
      const password = SIMULATOR_DEFAULTS.password;
      const name = options.name;
      const baseUrl = SIMULATOR_DEFAULTS.baseUrl;

      // Generate app secret from credentials
      const appSecret = Utils.generateAppSecret(deviceId, password, name);
      const appSecretHex = appSecret.toString('hex');

      // Save session data first so the SDK callbacks can use it
      saveSession({
        deviceId,
        baseUrl,
        name,
        appSecret: appSecretHex,
        isSimulator: true,
      });

      // Try to connect using the SDK
      const isAlreadyPaired = await withSpinner(
        'Connecting to simulator...',
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

      if (isAlreadyPaired) {
        success('Simulator setup complete! Already paired.');
        info('You can now use other commands to interact with the simulator.');
        return;
      }

      // Perform pairing with simulator default secret
      const isPaired = await withSpinner(
        'Pairing with simulator...',
        async () => {
          return pair(SIMULATOR_DEFAULTS.pairingSecret);
        },
      );

      if (isPaired) {
        success('Simulator setup and pairing complete!');
        info('You can now use commands like "gp address" and "gp sign".');
      } else {
        error('Pairing failed. Is the simulator running?');
        process.exit(1);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error(`Simulator setup failed: ${message}`);
      info('');
      info('Make sure the lattice-simulator is running:');
      info('  docker run -p 3000:3000 gridplus/lattice-simulator');
      process.exit(1);
    }
  });

/**
 * Info command showing simulator configuration
 */
const simulatorInfoCommand = new Command('info')
  .description('Show simulator default configuration')
  .action(() => {
    info('Lattice Simulator Defaults:');
    info(`  URL:            ${SIMULATOR_DEFAULTS.baseUrl}`);
    info(`  Device ID:      ${SIMULATOR_DEFAULTS.deviceId}`);
    info(`  Password:       ${SIMULATOR_DEFAULTS.password}`);
    info(`  Pairing Secret: ${SIMULATOR_DEFAULTS.pairingSecret}`);
    info('');
    info('To start the simulator:');
    info('  docker run -p 3000:3000 gridplus/lattice-simulator');
  });

/**
 * Parent simulator command group
 */
export const simulatorCommand = new Command('simulator')
  .alias('sim')
  .description('Commands for working with lattice-simulator');

simulatorCommand.addCommand(simulatorSetupCommand);
simulatorCommand.addCommand(simulatorInfoCommand);
