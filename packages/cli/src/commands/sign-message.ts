import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { setup, signMessage } from 'gridplus-sdk';
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

export const signMessageCommand = new Command('sign-message')
  .description('Sign a message (personal sign or EIP-712 typed data)')
  .argument(
    '<message>',
    'Message to sign (string, hex, or path to JSON file for EIP-712)',
  )
  .option('--typed', 'Sign EIP-712 typed data (expects JSON)')
  .option('--file', 'Read message from file')
  .option('-j, --json', 'Output signature in JSON format')
  .action(async (message, options) => {
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

      let payload: string | Record<string, unknown>;

      // Read from file if specified
      if (options.file) {
        try {
          const fileContent = readFileSync(message, 'utf-8');
          if (options.typed) {
            payload = JSON.parse(fileContent);
          } else {
            payload = fileContent;
          }
        } catch {
          error(`Failed to read file: ${message}`);
          process.exit(1);
        }
      } else if (options.typed) {
        // Parse EIP-712 typed data
        try {
          payload = JSON.parse(message);
        } catch {
          error(
            'Invalid EIP-712 JSON. Expected format: { types, domain, primaryType, message }',
          );
          process.exit(1);
        }

        // Validate EIP-712 structure
        if (
          typeof payload !== 'object' ||
          !payload ||
          !('types' in payload) ||
          !('domain' in payload) ||
          !('primaryType' in payload) ||
          !('message' in payload)
        ) {
          error(
            'Invalid EIP-712 structure. Required: types, domain, primaryType, message',
          );
          process.exit(1);
        }

        info('Signing EIP-712 typed data...');
      } else {
        payload = message;
        info('Signing personal message...');
      }

      info('Please confirm the message on your Lattice device.');

      const signatureData = await withSpinner(
        'Waiting for signature...',
        async () => {
          return signMessage(payload as Parameters<typeof signMessage>[0]);
        },
      );

      success('Message signed!');

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

        output(result, 'json');
      } else {
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

          // Also output concatenated signature
          if (signatureData.sig.v !== undefined) {
            // Convert v to a number for calculation
            let vNum: number;
            if (typeof signatureData.sig.v === 'number') {
              vNum = signatureData.sig.v;
            } else if (typeof signatureData.sig.v === 'bigint') {
              vNum = Number(signatureData.sig.v);
            } else if (Buffer.isBuffer(signatureData.sig.v)) {
              vNum = signatureData.sig.v.readUInt8(0);
            } else {
              vNum = Number.parseInt(String(signatureData.sig.v), 10);
            }

            const vHex =
              vNum < 27
                ? vNum.toString(16).padStart(2, '0')
                : (vNum - 27).toString(16).padStart(2, '0');

            const rHex = String(r).slice(2);
            const sHex = String(s).slice(2);
            hex(`0x${rHex}${sHex}${vHex}`, 'Signature');
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error(`Message signing failed: ${message}`);
      process.exit(1);
    }
  });
