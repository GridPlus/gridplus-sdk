import { writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { getClient, parseDerivationPath, setup } from 'gridplus-sdk';
import * as eth2 from 'lattice-eth2-utils';
import {
  error,
  getStoredClient,
  hasSession,
  info,
  output,
  promptConfirm,
  promptWithdrawalAddress,
  setStoredClient,
  success,
  withSpinner,
} from '../../lib/index.js';

// Type assertion helper to work around lattice-eth2-utils expecting npm gridplus-sdk Client
type Eth2Client = Parameters<typeof eth2.DepositData.generateObject>[0];

// Default ETH2 validator derivation path (EIP-2334)
// m/12381/3600/<validator_index>/0/0
const DEFAULT_VALIDATOR_PATH = [12381, 3600, 0, 0, 0];

export const depositDataCommand = new Command('deposit-data')
  .description('Generate ETH2 validator deposit data and optional keystores')
  .option('-i, --index <n>', 'Validator index (default: 0)', '0')
  .option('-p, --path <path>', 'Custom derivation path for validator key')
  .option('-w, --withdrawal <address>', 'ETH1 withdrawal address')
  .option(
    '--withdrawal-path <path>',
    'Derivation path for withdrawal credentials',
  )
  .option('-o, --output <file>', 'Output file for deposit data JSON')
  .option('--keystore', 'Also export encrypted keystore')
  .option('--keystore-output <file>', 'Output file for keystore')
  .option(
    '-n, --network <network>',
    'Network: mainnet|goerli|holesky',
    'mainnet',
  )
  .option('-j, --json', 'Output in JSON format')
  .action(async (options) => {
    try {
      // Check if we have a saved session
      if (!hasSession()) {
        error('No device configured. Run "gp setup" first.');
        process.exit(1);
      }

      // Initialize the SDK
      await withSpinner('Connecting to device...', async () => {
        return setup({
          getStoredClient,
          setStoredClient,
        });
      });

      // Get the SDK client instance
      const client = await getClient();

      // Determine the derivation path
      let validatorPath: number[];
      if (options.path) {
        validatorPath = parseDerivationPath(options.path);
      } else {
        const validatorIndex = Number.parseInt(options.index, 10);
        validatorPath = [...DEFAULT_VALIDATOR_PATH];
        validatorPath[2] = validatorIndex; // Set the validator index
      }

      info(`Validator derivation path: m/${validatorPath.join('/')}`);

      // Get withdrawal address
      let withdrawalCredentials: string | undefined;
      if (options.withdrawal) {
        withdrawalCredentials = options.withdrawal;
      } else if (!options.withdrawalPath) {
        const useAddress = await promptConfirm(
          'Use an ETH1 address for withdrawal credentials?',
          true,
        );
        if (useAddress) {
          withdrawalCredentials = await promptWithdrawalAddress();
        }
      }

      // Build deposit data options
      const depositOpts: {
        withdrawalCredentials?: string;
        withdrawalPath?: number[];
        network?: {
          networkName: string;
          forkVersion: Buffer;
          validatorsRoot: Buffer;
        };
      } = {};

      if (withdrawalCredentials) {
        depositOpts.withdrawalCredentials = withdrawalCredentials;
        info(`Using withdrawal address: ${withdrawalCredentials}`);
      } else if (options.withdrawalPath) {
        depositOpts.withdrawalPath = parseDerivationPath(
          options.withdrawalPath,
        );
        info(`Using withdrawal path: ${options.withdrawalPath}`);
      }

      // Set network configuration
      depositOpts.network = eth2.Constants.NETWORKS.MAINNET_GENESIS;

      info('Generating deposit data...');
      info('Please confirm the signing request on your Lattice device.');

      const depositData = await withSpinner(
        'Generating deposit data...',
        async () => {
          // Cast to work around type incompatibility between workspace and npm gridplus-sdk
          return eth2.DepositData.generateObject(
            client as unknown as Eth2Client,
            validatorPath,
            depositOpts,
          );
        },
      );

      success('Deposit data generated!');

      // Output deposit data
      if (options.output) {
        const outputData = JSON.stringify([depositData], null, 2);
        writeFileSync(options.output, outputData);
        success(`Deposit data written to: ${options.output}`);
      }

      if (options.json || !options.output) {
        output(depositData, options.json ? 'json' : 'human');
      }

      // Export keystore if requested
      if (options.keystore) {
        info('Exporting encrypted keystore...');
        info('Please confirm the export request on your Lattice device.');

        const keystore = await withSpinner(
          'Exporting keystore...',
          async () => {
            // Cast to work around type incompatibility between workspace and npm gridplus-sdk
            return eth2.DepositData.exportKeystore(
              client as unknown as Eth2Client,
              validatorPath,
            );
          },
        );

        success('Keystore exported!');

        if (options.keystoreOutput) {
          writeFileSync(options.keystoreOutput, keystore);
          success(`Keystore written to: ${options.keystoreOutput}`);
        } else {
          info('Keystore (save this securely):');
          console.log(keystore);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error(`Failed to generate deposit data: ${message}`);
      process.exit(1);
    }
  });
