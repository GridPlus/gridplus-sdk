import { isChainPlugin } from '@gridplus/chain-core';
import {
  DEFAULT_CHAIN_PLUGIN_KEYS,
  DEFAULT_CHAIN_PLUGINS,
} from '../../chains/defaultManifest';

describe('default chain manifest', () => {
  test('includes expected built-in lattice plugins', () => {
    expect(DEFAULT_CHAIN_PLUGIN_KEYS).toEqual(
      expect.arrayContaining([
        'btc:lattice',
        'evm:lattice',
        'solana:lattice',
        'cosmos:lattice',
        'xrp:lattice',
      ]),
    );
  });

  test('exports valid chain plugins with unique keys', () => {
    const uniqueKeys = new Set<string>();
    DEFAULT_CHAIN_PLUGINS.forEach((plugin) => {
      expect(isChainPlugin(plugin)).toBe(true);
      uniqueKeys.add(`${plugin.chainId}:${plugin.device}`);
    });

    expect(uniqueKeys.size).toBe(DEFAULT_CHAIN_PLUGINS.length);
  });
});
