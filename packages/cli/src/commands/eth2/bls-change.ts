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
  promptValidatorIndex,
  promptWithdrawalAddress,
  setStoredClient,
  success,
  withSpinner,
} from '../../lib/index.js';

// Type assertion helper to work around lattice-eth2-utils expecting npm gridplus-sdk Client
type Eth2Client = Parameters<
  typeof eth2.BLSToExecutionChange.generateObject
>[0];

// Default ETH2 validator derivation path (EIP-2334)
// m/12381/3600/<validator_index>/0/0
const DEFAULT_VALIDATOR_PATH = [12381, 3600, 0, 0, 0];

export const blsChangeCommand = new Command('bls-change')
  .description(
    'Generate a signed BLS-to-execution-change message to update withdrawal credentials',
  )
  .option('-i, --index <n>', 'Validator index')
  .option('-p, --path <path>', 'Custom derivation path for validator key')
  .option('-w, --withdrawal <address>', 'New ETH1 withdrawal address')
  .option('-v, --validator-index <n>', 'On-chain validator index (required)')
  .option('-o, --output <file>', 'Output file for signed message JSON')
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
        const keyIndex = options.index ? Number.parseInt(options.index, 10) : 0;
        validatorPath = [...DEFAULT_VALIDATOR_PATH];
        validatorPath[2] = keyIndex; // Set the validator index in derivation path
      }

      info(`Validator derivation path: m/${validatorPath.join('/')}`);

      // Get the on-chain validator index
      let validatorIndex: number;
      if (options.validatorIndex) {
        validatorIndex = Number.parseInt(options.validatorIndex, 10);
      } else {
        validatorIndex = await promptValidatorIndex();
      }

      info(`On-chain validator index: ${validatorIndex}`);

      // Get new withdrawal address
      const withdrawalAddress =
        options.withdrawal || (await promptWithdrawalAddress());
      info(`New withdrawal address: ${withdrawalAddress}`);

      // Build BLS change options
      const blsChangeOpts = {
        toExecutionAddress: withdrawalAddress,
        validatorIndex,
        network: eth2.Constants.NETWORKS.MAINNET_GENESIS,
      };

      info('Generating BLS-to-execution-change message...');
      info('Please confirm the signing request on your Lattice device.');

      const signedMessage = await withSpinner(
        'Generating signed message...',
        async () => {
          // Cast to work around type incompatibility between workspace and npm gridplus-sdk
          return eth2.BLSToExecutionChange.generateObject(
            client as unknown as Eth2Client,
            validatorPath,
            blsChangeOpts,
          );
        },
      );

      success('BLS-to-execution-change message generated!');

      // Output the signed message
      if (options.output) {
        const outputData = JSON.stringify(signedMessage, null, 2);
        writeFileSync(options.output, outputData);
        success(`Signed message written to: ${options.output}`);
      }

      if (options.json || !options.output) {
        output(signedMessage, options.json ? 'json' : 'human');
      }

      info('');
      info('To submit this message:');
      info('1. Broadcast via a beacon node API endpoint');
      info('   POST /eth/v1/beacon/pool/bls_to_execution_changes');
      info('2. Or use a tool like https://beaconcha.in/tools/broadcast');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error(`Failed to generate BLS change message: ${message}`);
      process.exit(1);
    }
  });
