import { Command } from 'commander';
import { setup, sign } from 'gridplus-sdk';
import type { Hex } from 'viem';
import {
  error,
  getStoredClient,
  hasSession,
  hex,
  info,
  output,
  setStoredClient,
  success,
  withSpinner,
} from '../lib/index.js';

export const signCommand = new Command('sign')
  .description('Sign an Ethereum transaction')
  .argument('<tx>', 'Transaction data (hex-encoded RLP or JSON)')
  .option('-j, --json', 'Output signature in JSON format')
  .option('--raw', 'Treat input as raw hex-encoded transaction')
  .action(async (tx, options) => {
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

      let transaction: Hex | Record<string, unknown>;

      // Parse the transaction
      if (options.raw || tx.startsWith('0x')) {
        // Raw hex transaction
        transaction = (tx.startsWith('0x') ? tx : `0x${tx}`) as Hex;
        info('Signing raw transaction...');
      } else {
        // Try to parse as JSON
        try {
          const parsed = JSON.parse(tx);
          transaction = parsed as Record<string, unknown>;
          info('Signing transaction...');
        } catch {
          error(
            'Invalid transaction format. Provide hex-encoded transaction or valid JSON.',
          );
          process.exit(1);
        }
      }

      info('Please confirm the transaction on your Lattice device.');

      const signatureData = await withSpinner(
        'Waiting for signature...',
        async () => {
          // Cast to expected type - the SDK handles the actual type checking
          return sign(transaction as Parameters<typeof sign>[0]);
        },
      );

      success('Transaction signed!');

      // Format the output
      if (options.json) {
        const result: Record<string, unknown> = {
          sig: {},
        };

        if (signatureData.sig) {
          result.sig = {
            r: Buffer.isBuffer(signatureData.sig.r)
              ? `0x${signatureData.sig.r.toString('hex')}`
              : signatureData.sig.r,
            s: Buffer.isBuffer(signatureData.sig.s)
              ? `0x${signatureData.sig.s.toString('hex')}`
              : signatureData.sig.s,
            v: signatureData.sig.v,
          };
        }

        if (signatureData.pubkey) {
          result.pubkey = Buffer.isBuffer(signatureData.pubkey)
            ? `0x${signatureData.pubkey.toString('hex')}`
            : signatureData.pubkey;
        }

        if (signatureData.tx) {
          result.signedTx = Buffer.isBuffer(signatureData.tx)
            ? `0x${signatureData.tx.toString('hex')}`
            : signatureData.tx;
        }

        output(result, 'json');
      } else {
        if (signatureData.tx) {
          const signedTx = Buffer.isBuffer(signatureData.tx)
            ? `0x${signatureData.tx.toString('hex')}`
            : signatureData.tx;
          hex(String(signedTx), 'Signed Transaction');
        }

        if (signatureData.sig) {
          const r = Buffer.isBuffer(signatureData.sig.r)
            ? `0x${signatureData.sig.r.toString('hex')}`
            : signatureData.sig.r;
          const s = Buffer.isBuffer(signatureData.sig.s)
            ? `0x${signatureData.sig.s.toString('hex')}`
            : signatureData.sig.s;

          hex(String(r), 'r');
          hex(String(s), 's');
          info(`v: ${signatureData.sig.v}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error(`Signing failed: ${message}`);
      process.exit(1);
    }
  });
