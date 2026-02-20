import type { AssetPlugin } from '@gridplus/asset-core';
import { latticePlugin as btcLatticePlugin } from '@gridplus/btc';
import { latticePlugin as cosmosLatticePlugin } from '@gridplus/cosmos';
import { latticePlugin as evmLatticePlugin } from '@gridplus/evm';
import { latticePlugin as solanaLatticePlugin } from '@gridplus/solana';

// Single source of built-in asset plugins shipped by the SDK.
export const DEFAULT_ASSET_PLUGINS: AssetPlugin<any>[] = [
  btcLatticePlugin,
  cosmosLatticePlugin,
  evmLatticePlugin,
  solanaLatticePlugin,
];

// Canonical keys used by tests and setup-time override logic.
export const DEFAULT_ASSET_PLUGIN_KEYS = [
  'btc:lattice',
  'cosmos:lattice',
  'evm:lattice',
  'solana:lattice',
] as const;
