import { discoverAndRegisterChains } from '../../chains/discovery';
import { DEFAULT_CHAIN_PLUGINS } from '../../chains/defaultManifest';

const getPluginKey = (chainId: string, device: string) =>
  `${chainId}:${device}`;

describe('chain discovery', () => {
  test('registers built-in plugins and is idempotent with duplicate-aware registry', async () => {
    const registeredKeys = new Set<string>();
    const register = (plugin: (typeof DEFAULT_CHAIN_PLUGINS)[number]) => {
      const key = getPluginKey(plugin.chainId, plugin.device);
      if (registeredKeys.has(key)) return false;
      registeredKeys.add(key);
      return true;
    };

    const firstCount = await discoverAndRegisterChains(register);
    const secondCount = await discoverAndRegisterChains(register);

    expect(firstCount).toBe(DEFAULT_CHAIN_PLUGINS.length);
    expect(secondCount).toBe(0);
  });

  test('warns and continues when a plugin registration throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const firstPluginKey = getPluginKey(
      DEFAULT_CHAIN_PLUGINS[0].chainId,
      DEFAULT_CHAIN_PLUGINS[0].device,
    );

    const count = await discoverAndRegisterChains((plugin) => {
      const key = getPluginKey(plugin.chainId, plugin.device);
      if (key === firstPluginKey) {
        throw new Error('boom');
      }
      return true;
    });

    expect(count).toBe(DEFAULT_CHAIN_PLUGINS.length - 1);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
