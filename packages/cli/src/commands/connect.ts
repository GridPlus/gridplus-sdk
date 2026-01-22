import { Command } from 'commander';
import { connect, setup } from 'gridplus-sdk';
import {
  error,
  getStoredClient,
  hasSession,
  info,
  loadSession,
  output,
  setStoredClient,
  success,
  withSpinner,
} from '../lib/index.js';

export const connectCommand = new Command('connect')
  .description('Connect to a previously configured Lattice device')
  .option('-j, --json', 'Output in JSON format')
  .action(async (options) => {
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

      info(`Connecting to device: ${session.deviceId}`);

      // Initialize the SDK with stored credentials
      const isPaired = await withSpinner('Connecting...', async () => {
        // First setup the SDK state handlers
        await setup({
          getStoredClient,
          setStoredClient,
        });

        // Then connect to the device
        return connect(session.deviceId);
      });

      if (isPaired) {
        success('Connected and paired!');
        if (options.json) {
          output(
            {
              status: 'connected',
              paired: true,
              deviceId: session.deviceId,
              baseUrl: session.baseUrl,
              appName: session.name,
            },
            'json',
          );
        } else {
          output({
            deviceId: session.deviceId,
            baseUrl: session.baseUrl,
            appName: session.name,
            status: 'paired',
          });
        }
      } else {
        success('Connected but not paired.');
        info('Run "gp pair" to pair with the device.');
        if (options.json) {
          output(
            {
              status: 'connected',
              paired: false,
              deviceId: session.deviceId,
            },
            'json',
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error(`Connection failed: ${message}`);
      process.exit(1);
    }
  });
