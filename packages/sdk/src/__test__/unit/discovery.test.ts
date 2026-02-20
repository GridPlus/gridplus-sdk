import { discoverAndRegisterAssets } from '../../assets/discovery';
import { DEFAULT_ASSET_PLUGINS } from '../../assets/defaultManifest';

const getPluginKey = (assetId: string, device: string) => `${assetId}:${device}`;

describe('asset discovery', () => {
  test('registers built-in plugins and is idempotent with duplicate-aware registry', async () => {
    const registeredKeys = new Set<string>();
    const register = (plugin: (typeof DEFAULT_ASSET_PLUGINS)[number]) => {
      const key = getPluginKey(plugin.assetId, plugin.device);
      if (registeredKeys.has(key)) return false;
      registeredKeys.add(key);
      return true;
    };

    const firstCount = await discoverAndRegisterAssets(register);
    const secondCount = await discoverAndRegisterAssets(register);

    expect(firstCount).toBe(DEFAULT_ASSET_PLUGINS.length);
    expect(secondCount).toBe(0);
  });

  test('warns and continues when a plugin registration throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const firstPluginKey = getPluginKey(
      DEFAULT_ASSET_PLUGINS[0].assetId,
      DEFAULT_ASSET_PLUGINS[0].device,
    );

    const count = await discoverAndRegisterAssets((plugin) => {
      const key = getPluginKey(plugin.assetId, plugin.device);
      if (key === firstPluginKey) {
        throw new Error('boom');
      }
      return true;
    });

    expect(count).toBe(DEFAULT_ASSET_PLUGINS.length - 1);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
