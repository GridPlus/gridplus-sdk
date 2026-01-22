import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSessionDirectory } from './session.js';

/**
 * CLI configuration options
 */
export interface CliConfig {
  /** Default output format: 'json' or 'human' */
  outputFormat: 'json' | 'human';
  /** Default network for addresses */
  defaultNetwork: 'mainnet' | 'testnet';
  /** Default base URL for Lattice device */
  defaultBaseUrl: string;
  /** Default app name for pairing */
  defaultAppName: string;
}

const DEFAULT_CONFIG: CliConfig = {
  outputFormat: 'human',
  defaultNetwork: 'mainnet',
  defaultBaseUrl: 'https://signing.gridpl.us',
  defaultAppName: 'GridPlus CLI',
};

/**
 * Gets the config file path
 */
function getConfigFilePath(): string {
  return join(getSessionDirectory(), 'config.json');
}

/**
 * Loads CLI configuration from disk
 */
export function loadConfig(): CliConfig {
  try {
    const configPath = getConfigFilePath();
    if (!existsSync(configPath)) {
      return { ...DEFAULT_CONFIG };
    }
    const data = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(data) as Partial<CliConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Saves CLI configuration to disk
 */
export function saveConfig(config: Partial<CliConfig>): void {
  const configPath = getConfigFilePath();
  const currentConfig = loadConfig();
  const newConfig = { ...currentConfig, ...config };
  writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
}

/**
 * Gets a specific config value
 */
export function getConfigValue<K extends keyof CliConfig>(
  key: K,
): CliConfig[K] {
  const config = loadConfig();
  return config[key];
}

/**
 * Sets a specific config value
 */
export function setConfigValue<K extends keyof CliConfig>(
  key: K,
  value: CliConfig[K],
): void {
  saveConfig({ [key]: value });
}

/**
 * Resets configuration to defaults
 */
export function resetConfig(): void {
  const configPath = getConfigFilePath();
  writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
}

/**
 * Gets the default config
 */
export function getDefaultConfig(): CliConfig {
  return { ...DEFAULT_CONFIG };
}
