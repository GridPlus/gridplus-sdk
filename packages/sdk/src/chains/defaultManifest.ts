import type { ChainPlugin } from '@gridplus/chain-core';
import { latticePlugin as btcLatticePlugin } from '@gridplus/btc';
import { latticePlugin as cosmosLatticePlugin } from '@gridplus/cosmos';
import { latticePlugin as evmLatticePlugin } from '@gridplus/evm';
import { latticePlugin as solanaLatticePlugin } from '@gridplus/solana';
import { latticePlugin as xrpLatticePlugin } from '@gridplus/xrp';

// Single source of built-in chain plugins shipped by the SDK.
export const DEFAULT_CHAIN_PLUGINS: ChainPlugin<any>[] = [
  btcLatticePlugin,
  cosmosLatticePlugin,
  evmLatticePlugin,
  solanaLatticePlugin,
  xrpLatticePlugin,
];

// Canonical keys used by tests and setup-time override logic.
export const DEFAULT_CHAIN_PLUGIN_KEYS = [
  'btc:lattice',
  'cosmos:lattice',
  'evm:lattice',
  'solana:lattice',
  'xrp:lattice',
] as const;
