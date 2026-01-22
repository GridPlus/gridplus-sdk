import { confirm, input, password, select } from '@inquirer/prompts';
import ora, { type Ora } from 'ora';
import { loadConfig } from './config.js';

/**
 * Prompts for device URL/IP
 */
export async function promptDeviceUrl(): Promise<string> {
  const config = loadConfig();
  const deviceUrl = await input({
    message: 'Enter your Lattice device URL or IP:',
    default: config.defaultBaseUrl,
    validate: (value) => {
      if (!value.trim()) {
        return 'Device URL is required';
      }
      return true;
    },
  });
  return deviceUrl.trim();
}

/**
 * Prompts for device ID
 */
export async function promptDeviceId(): Promise<string> {
  const deviceId = await input({
    message: 'Enter your Lattice device ID:',
    validate: (value) => {
      if (!value.trim()) {
        return 'Device ID is required';
      }
      return true;
    },
  });
  return deviceId.trim();
}

/**
 * Prompts for app name
 */
export async function promptAppName(): Promise<string> {
  const config = loadConfig();
  const appName = await input({
    message: 'Enter an app name (shown on device):',
    default: config.defaultAppName,
  });
  return appName.trim() || config.defaultAppName;
}

/**
 * Prompts for password
 */
export async function promptPassword(): Promise<string> {
  const pwd = await password({
    message: 'Enter your Lattice password:',
    validate: (value) => {
      if (!value.trim()) {
        return 'Password is required';
      }
      return true;
    },
  });
  return pwd;
}

/**
 * Prompts for pairing code
 */
export async function promptPairingCode(): Promise<string> {
  const code = await input({
    message: 'Enter the pairing code from your Lattice device:',
    validate: (value) => {
      if (!value.trim()) {
        return 'Pairing code is required';
      }
      return true;
    },
  });
  return code.trim();
}

/**
 * Prompts for confirmation
 */
export async function promptConfirm(
  message: string,
  defaultValue = false,
): Promise<boolean> {
  return confirm({
    message,
    default: defaultValue,
  });
}

/**
 * Address type options for prompts
 */
export type AddressTypeOption =
  | 'eth'
  | 'btc-legacy'
  | 'btc-segwit'
  | 'btc-wrapped-segwit'
  | 'solana';

/**
 * Prompts for address type
 */
export async function promptAddressType(): Promise<AddressTypeOption> {
  const choice = await select({
    message: 'Select address type:',
    choices: [
      { value: 'eth', name: 'Ethereum (ETH)' },
      { value: 'btc-legacy', name: 'Bitcoin Legacy (P2PKH)' },
      { value: 'btc-segwit', name: 'Bitcoin Native SegWit (P2WPKH)' },
      {
        value: 'btc-wrapped-segwit',
        name: 'Bitcoin Wrapped SegWit (P2SH-P2WPKH)',
      },
      { value: 'solana', name: 'Solana (SOL)' },
    ],
  });
  return choice as AddressTypeOption;
}

/**
 * Public key type options for prompts
 */
export type PubkeyTypeOption = 'secp256k1' | 'ed25519' | 'bls12_381_g1';

/**
 * Prompts for public key type
 */
export async function promptPubkeyType(): Promise<PubkeyTypeOption> {
  const choice = await select({
    message: 'Select public key type:',
    choices: [
      { value: 'secp256k1', name: 'secp256k1 (Ethereum, Bitcoin)' },
      { value: 'ed25519', name: 'ed25519 (Solana)' },
      { value: 'bls12_381_g1', name: 'BLS12-381-G1 (ETH2 Validators)' },
    ],
  });
  return choice as PubkeyTypeOption;
}

/**
 * Creates a spinner with a message
 */
export function spinner(message: string): Ora {
  return ora(message).start();
}

/**
 * Runs an async operation with a spinner
 */
export async function withSpinner<T>(
  message: string,
  operation: () => Promise<T>,
): Promise<T> {
  const spin = ora(message).start();
  try {
    const result = await operation();
    spin.succeed();
    return result;
  } catch (err) {
    spin.fail();
    throw err;
  }
}

/**
 * Prompts for derivation path
 */
export async function promptDerivationPath(
  defaultPath: string,
): Promise<string> {
  const path = await input({
    message: 'Enter derivation path:',
    default: defaultPath,
    validate: (value) => {
      if (!value.trim()) {
        return 'Derivation path is required';
      }
      // Basic validation - should start with m/ or just be a path
      if (
        !value.startsWith('m/') &&
        !value.startsWith("44'") &&
        !/^\d/.test(value)
      ) {
        return 'Invalid derivation path format';
      }
      return true;
    },
  });
  return path.trim();
}

/**
 * Prompts for number of addresses
 */
export async function promptAddressCount(defaultCount = 1): Promise<number> {
  const count = await input({
    message: 'How many addresses to fetch?',
    default: String(defaultCount),
    validate: (value) => {
      const num = Number.parseInt(value, 10);
      if (Number.isNaN(num) || num < 1) {
        return 'Must be a positive number';
      }
      if (num > 10) {
        return 'Maximum 10 addresses at a time';
      }
      return true;
    },
  });
  return Number.parseInt(count, 10);
}

/**
 * Prompts for ETH1 withdrawal address
 */
export async function promptWithdrawalAddress(): Promise<string> {
  const addr = await input({
    message: 'Enter ETH1 withdrawal address (0x...):',
    validate: (value) => {
      if (!value.trim()) {
        return 'Withdrawal address is required';
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
        return 'Invalid Ethereum address format';
      }
      return true;
    },
  });
  return addr.trim();
}

/**
 * Prompts for validator index
 */
export async function promptValidatorIndex(): Promise<number> {
  const index = await input({
    message: 'Enter validator index:',
    validate: (value) => {
      const num = Number.parseInt(value, 10);
      if (Number.isNaN(num) || num < 0) {
        return 'Must be a non-negative number';
      }
      return true;
    },
  });
  return Number.parseInt(index, 10);
}
