import {
  createAssetRegistry,
  type AssetPlugin,
  type DeviceId,
} from '@gridplus/asset-core';
import { createDeviceContext, type SdkDeviceContext } from './context';
import { discoverAndRegisterAssets as discoverAssets } from './discovery';

type ConfigureAssetRuntimeOptions = {
  autoRegisterAssets?: boolean;
  defaultDevice?: DeviceId;
  resetCache?: boolean;
};

type DiscoverAndRegisterOptions = {
  force?: boolean;
};

type UseAssetOptions<TAdapterOptions = unknown> = {
  device?: DeviceId;
  defaultDevice?: DeviceId;
  adapterOptions?: TAdapterOptions;
  forceDiscover?: boolean;
};

type CachedAsset = {
  generation: number;
  context: SdkDeviceContext;
  signer: unknown;
  adapters: Map<string, unknown>;
};

const registry = createAssetRegistry<SdkDeviceContext>();

let defaultDevice: DeviceId = 'lattice';
let autoRegisterAssets = true;
let discoveryPromise: Promise<number> | null = null;
let cacheGeneration = 0;
const cache = new Map<string, CachedAsset>();

const toCacheKey = (assetId: string, device: DeviceId) => `${assetId}:${device}`;

// Adapter options become part of cache identity; bigints are normalized for stable keys.
const stringifyAdapterOptions = (options: unknown): string => {
  if (options === undefined) return '__default__';
  try {
    return JSON.stringify(options, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
  } catch {
    return `__opaque__:${String(options)}`;
  }
};

const registerDiscoveredPlugin = (plugin: AssetPlugin<any>): boolean => {
  if (registry.has(plugin.assetId, plugin.device)) return false;
  registry.register(plugin as AssetPlugin<SdkDeviceContext>);
  return true;
};

// Discovery registers built-ins once and returns newly added count.
async function runDiscovery(): Promise<number> {
  return discoverAssets(registerDiscoveredPlugin);
}

export function configureAssetRuntime(options: ConfigureAssetRuntimeOptions = {}): void {
  if (options.defaultDevice) {
    defaultDevice = options.defaultDevice;
  }
  if (typeof options.autoRegisterAssets === 'boolean') {
    autoRegisterAssets = options.autoRegisterAssets;
  }
  if (options.resetCache) {
    invalidateAssetCache();
  }
}

export function invalidateAssetCache(): void {
  cacheGeneration += 1;
  cache.clear();
}

export function getDefaultDevice(): DeviceId {
  return defaultDevice;
}

export function registerAssetPlugin(
  plugin: AssetPlugin<any>,
): void {
  registry.register(plugin as AssetPlugin<SdkDeviceContext>);
}

export function unregisterAsset(assetId: string, device?: DeviceId): boolean {
  cacheGeneration += 1;
  cache.clear();
  return registry.unregister(assetId, device);
}

export function listAssets(): AssetPlugin<SdkDeviceContext>[] {
  return registry.list();
}

export function getAsset(
  assetId: string,
  device: DeviceId,
): AssetPlugin<SdkDeviceContext> | undefined {
  return registry.get(assetId, device);
}

export async function discoverAndRegisterAssets(
  options: DiscoverAndRegisterOptions = {},
): Promise<number> {
  if (!autoRegisterAssets && !options.force) {
    return 0;
  }
  if (!discoveryPromise || options.force) {
    discoveryPromise = runDiscovery();
  }
  return discoveryPromise;
}

export async function useAsset<TAdapter = unknown, TAdapterOptions = unknown>(
  assetId: string,
  options: UseAssetOptions<TAdapterOptions> = {},
): Promise<TAdapter> {
  // Lazy discovery keeps initial setup light and defers work until first asset use.
  await discoverAndRegisterAssets({ force: options.forceDiscover });

  const resolved = registry.resolve(assetId, {
    device: options.device,
    defaultDevice: options.defaultDevice ?? defaultDevice,
  });

  if (!resolved) {
    const availableDevices = registry
      .list()
      .filter((plugin) => plugin.assetId === assetId)
      .map((plugin) => plugin.device);
    const details =
      availableDevices.length > 0
        ? ` Available devices: ${availableDevices.join(', ')}.`
        : '';
    throw new Error(`Asset "${assetId}" is not registered.${details}`);
  }

  const resolvedDevice = resolved.device;
  const assetCacheKey = toCacheKey(assetId, resolvedDevice);
  let cached = cache.get(assetCacheKey);

  // Signer is created once per (asset, device) generation and reused by adapters.
  if (!cached || cached.generation !== cacheGeneration) {
    const context = createDeviceContext();
    const signer = await resolved.createSigner(context);
    cached = {
      generation: cacheGeneration,
      context,
      signer,
      adapters: new Map<string, unknown>(),
    };
    cache.set(assetCacheKey, cached);
  }

  const adapterKey = stringifyAdapterOptions(options.adapterOptions);
  if (cached.adapters.has(adapterKey)) {
    return cached.adapters.get(adapterKey) as TAdapter;
  }

  // Adapters are memoized by adapter options on top of the signer cache.
  const adapter = resolved.createAdapter
    ? await resolved.createAdapter(
        cached.context,
        cached.signer as never,
        options.adapterOptions as never,
      )
    : resolved.module.create(
        cached.signer as never,
        options.adapterOptions as never,
      );

  cached.adapters.set(adapterKey, adapter);
  return adapter as TAdapter;
}
