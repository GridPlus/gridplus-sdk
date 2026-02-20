import { isAssetPlugin } from '@gridplus/asset-core';
import {
  DEFAULT_ASSET_PLUGIN_KEYS,
  DEFAULT_ASSET_PLUGINS,
} from '../../assets/defaultManifest';

describe('default asset manifest', () => {
  test('includes expected built-in lattice plugins', () => {
    expect(DEFAULT_ASSET_PLUGIN_KEYS).toEqual(
      expect.arrayContaining([
        'btc:lattice',
        'evm:lattice',
        'solana:lattice',
        'cosmos:lattice',
      ]),
    );
  });

  test('exports valid asset plugins with unique keys', () => {
    const uniqueKeys = new Set<string>();
    DEFAULT_ASSET_PLUGINS.forEach((plugin) => {
      expect(isAssetPlugin(plugin)).toBe(true);
      uniqueKeys.add(`${plugin.assetId}:${plugin.device}`);
    });

    expect(uniqueKeys.size).toBe(DEFAULT_ASSET_PLUGINS.length);
  });
});
