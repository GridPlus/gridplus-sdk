import type { ChainPlugin } from '@gridplus/chain-core';
import { DEFAULT_CHAIN_PLUGINS } from './defaultManifest';

// Single discovery path: only registers SDK-built-in plugins from static manifest.
export async function discoverAndRegisterChains(
  // `register` returns true only when the plugin is newly inserted.
  register: (plugin: ChainPlugin<any>) => boolean,
): Promise<number> {
  let registered = 0;

  for (const plugin of DEFAULT_CHAIN_PLUGINS) {
    try {
      const wasRegistered = register(plugin);
      if (wasRegistered) {
        registered += 1;
      }
    } catch (err) {
      if (
        typeof console !== 'undefined' &&
        typeof console.warn === 'function'
      ) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[chain-discovery] Failed to register plugin ${plugin.chainId}:${plugin.device}: ${message}`,
        );
      }
    }
  }

  return registered;
}
