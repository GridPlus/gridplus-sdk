import { Command } from 'commander';
import { Constants, fetchAddressesByDerivationPath, setup } from 'gridplus-sdk';
import {
  error,
  getStoredClient,
  hasSession,
  hex,
  info,
  output,
  setStoredClient,
  withSpinner,
} from '../lib/index.js';

export type PubkeyType = 'secp256k1' | 'ed25519' | 'bls12_381_g1';

// Map pubkey types to SDK flags
const PUBKEY_FLAGS: Record<PubkeyType, number> = {
  secp256k1: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
  ed25519: Constants.GET_ADDR_FLAGS.ED25519_PUB,
  bls12_381_g1: Constants.GET_ADDR_FLAGS.BLS12_381_G1_PUB,
};

// Default derivation paths for different key types
const DEFAULT_PATHS: Record<PubkeyType, string> = {
  secp256k1: "m/44'/60'/0'/0/0",
  ed25519: "m/44'/501'/0'/0'",
  bls12_381_g1: 'm/12381/3600/0/0/0',
};

export const pubkeyCommand = new Command('pubkey')
  .description('Get public keys from your Lattice device')
  .argument('[path]', 'Derivation path')
  .option(
    '-t, --type <type>',
    'Key type: secp256k1|ed25519|bls12_381_g1',
    'secp256k1',
  )
  .option('-n, --count <n>', 'Number of keys to fetch', '1')
  .option('-i, --index <n>', 'Starting index', '0')
  .option('-j, --json', 'Output in JSON format')
  .action(async (path, options) => {
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

      const keyType = options.type as PubkeyType;
      const count = Number.parseInt(options.count, 10);
      const startIndex = Number.parseInt(options.index, 10);

      // Validate key type
      if (!PUBKEY_FLAGS[keyType]) {
        error(
          `Invalid key type: ${keyType}. Use secp256k1, ed25519, or bls12_381_g1.`,
        );
        process.exit(1);
      }

      // Use provided path or default for key type
      const derivationPath = path || DEFAULT_PATHS[keyType];
      const flag = PUBKEY_FLAGS[keyType];

      // Strip "m/" prefix if present - SDK doesn't handle it
      const cleanPath = (p: string) =>
        p.startsWith('m/') ? p.slice(2) : p.startsWith('m') ? p.slice(1) : p;

      info(`Fetching ${keyType} public key(s) at path: ${derivationPath}`);

      // Convert Buffer to hex string
      const toHex = (val: unknown): string => {
        if (typeof val === 'string') return val;
        if (Buffer.isBuffer(val)) return `0x${val.toString('hex')}`;
        if (
          val &&
          typeof val === 'object' &&
          'type' in val &&
          (val as { type: string }).type === 'Buffer' &&
          'data' in val
        ) {
          return `0x${Buffer.from((val as { data: number[] }).data).toString('hex')}`;
        }
        return String(val);
      };

      const pubkeys = await withSpinner('Fetching public keys...', async () => {
        let results: unknown[];

        // For multiple keys, we need to handle the path with an index
        if (count > 1) {
          // Replace the last component with a wildcard if fetching multiple
          const pathParts = cleanPath(derivationPath).split('/');
          const lastPart = pathParts[pathParts.length - 1];
          if (!lastPart?.toLowerCase().includes('x')) {
            pathParts[pathParts.length - 1] = 'x';
          }
          const wildcardPath = pathParts.join('/');
          results = await fetchAddressesByDerivationPath(wildcardPath, {
            n: count,
            startPathIndex: startIndex,
            flag,
          });
        } else {
          // Single key
          results = await fetchAddressesByDerivationPath(cleanPath(derivationPath), {
            n: 1,
            flag,
          });
        }

        // Convert Buffer responses to hex strings
        return results.map(toHex);
      });

      // Output results
      if (options.json) {
        output(
          {
            type: keyType,
            path: derivationPath,
            count: pubkeys.length,
            publicKeys: pubkeys,
          },
          'json',
        );
      } else {
        if (pubkeys.length === 1) {
          hex(pubkeys[0], `${keyType.toUpperCase()} Public Key`);
        } else {
          pubkeys.forEach((pk, i) => {
            hex(pk, `[${startIndex + i}]`);
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error(`Failed to fetch public keys: ${message}`);
      process.exit(1);
    }
  });
