import type { AssetPlugin } from '@gridplus/asset-core';
import { DEFAULT_ASSET_PLUGINS } from './defaultManifest';

// Single discovery path: only registers SDK-built-in plugins from static manifest.
export async function discoverAndRegisterAssets(
  // `register` returns true only when the plugin is newly inserted.
  register: (plugin: AssetPlugin<any>) => boolean,
): Promise<number> {
  let registered = 0;

  for (const plugin of DEFAULT_ASSET_PLUGINS) {
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
          `[asset-discovery] Failed to register plugin ${plugin.assetId}:${plugin.device}: ${message}`,
        );
      }
    }
  }

  return registered;
}
