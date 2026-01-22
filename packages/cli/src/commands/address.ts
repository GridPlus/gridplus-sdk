import { Command } from 'commander';
import bs58 from 'bs58';
import {
  fetchAddress,
  fetchAddressesByDerivationPath,
  fetchBtcLegacyAddresses,
  fetchBtcSegwitAddresses,
  fetchBtcWrappedSegwitAddresses,
  fetchSolanaAddresses,
  setup,
} from 'gridplus-sdk';
import {
  address as outputAddress,
  error,
  getStoredClient,
  hasSession,
  info,
  output,
  setStoredClient,
  withSpinner,
} from '../lib/index.js';

export type AddressType =
  | 'eth'
  | 'btc-legacy'
  | 'btc-segwit'
  | 'btc-wrapped-segwit'
  | 'solana';

export const addressCommand = new Command('address')
  .description('Get addresses from your Lattice device')
  .argument('[path]', "Derivation path (e.g., \"m/44'/60'/0'/0/0\" or index)")
  .option(
    '-t, --type <type>',
    'Address type: eth|btc-legacy|btc-segwit|btc-wrapped-segwit|solana',
    'eth',
  )
  .option('-n, --count <n>', 'Number of addresses to fetch', '1')
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

      const addressType = options.type as AddressType;
      const count = Number.parseInt(options.count, 10);
      const startIndex = Number.parseInt(options.index, 10);

      let addresses: string[];

      // Strip "m/" prefix if present - SDK doesn't handle it
      const cleanPath = (p: string) =>
        p.startsWith('m/') ? p.slice(2) : p.startsWith('m') ? p.slice(1) : p;

      // If a specific derivation path is provided, use it
      if (path && typeof path === 'string' && !Number.isFinite(Number(path))) {
        info(`Fetching address at path: ${path}`);
        addresses = await withSpinner('Fetching addresses...', async () => {
          return fetchAddressesByDerivationPath(cleanPath(path), {
            n: count,
            startPathIndex: startIndex,
          });
        });
      } else {
        // Use address type to determine which fetch function to use
        const index = path ? Number.parseInt(path, 10) : startIndex;

        switch (addressType) {
          case 'btc-legacy':
            info('Fetching Bitcoin Legacy (P2PKH) addresses...');
            addresses = await withSpinner('Fetching addresses...', async () => {
              return fetchBtcLegacyAddresses({
                n: count,
                startPathIndex: index,
              });
            });
            break;

          case 'btc-segwit':
            info('Fetching Bitcoin Native SegWit (P2WPKH) addresses...');
            addresses = await withSpinner('Fetching addresses...', async () => {
              return fetchBtcSegwitAddresses({
                n: count,
                startPathIndex: index,
              });
            });
            break;

          case 'btc-wrapped-segwit':
            info('Fetching Bitcoin Wrapped SegWit (P2SH-P2WPKH) addresses...');
            addresses = await withSpinner('Fetching addresses...', async () => {
              return fetchBtcWrappedSegwitAddresses({
                n: count,
                startPathIndex: index,
              });
            });
            break;

          case 'solana':
            info('Fetching Solana addresses...');
            addresses = await withSpinner('Fetching addresses...', async () => {
              const results = await fetchSolanaAddresses({
                n: count,
                startPathIndex: index,
              });
              // Convert Buffer responses to base58 Solana addresses
              return results.map((addr: unknown) => {
                if (typeof addr === 'string') return addr;
                if (Buffer.isBuffer(addr)) return bs58.encode(addr);
                if (
                  addr &&
                  typeof addr === 'object' &&
                  'type' in addr &&
                  (addr as { type: string }).type === 'Buffer' &&
                  'data' in addr
                ) {
                  return bs58.encode(
                    Buffer.from((addr as { data: number[] }).data),
                  );
                }
                return String(addr);
              });
            });
            break;
          default:
            info('Fetching Ethereum addresses...');
            addresses = await withSpinner('Fetching addresses...', async () => {
              const results: string[] = [];
              for (let i = 0; i < count; i++) {
                const addr = await fetchAddress(index + i);
                results.push(addr);
              }
              return results;
            });
            break;
        }
      }

      // Output results
      if (options.json) {
        output(
          {
            type: addressType,
            count: addresses.length,
            addresses,
          },
          'json',
        );
      } else {
        if (addresses.length === 1) {
          outputAddress(addresses[0], addressType.toUpperCase());
        } else {
          addresses.forEach((addr, i) => {
            outputAddress(addr, `[${startIndex + i}]`);
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      error(`Failed to fetch addresses: ${message}`);
      process.exit(1);
    }
  });
