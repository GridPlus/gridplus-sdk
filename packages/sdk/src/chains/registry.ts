import {
  createChainRegistry,
  getFirmwareVersion,
  type ChainPlugin,
  type DeviceId,
} from '@gridplus/chain-core';
import { createDeviceContext, type SdkDeviceContext } from './context';
import { discoverAndRegisterChains as discoverChains } from './discovery';
import {
  ensurePrimitivesSeeded,
  preflightPluginPrimitives,
  registerPluginPrimitives,
  unregisterPluginPrimitives,
  validatePluginPrimitiveRequirements,
} from './primitives';

type ConfigureChainRuntimeOptions = {
  autoRegisterChains?: boolean;
  defaultDevice?: DeviceId;
  resetCache?: boolean;
};

type DiscoverAndRegisterOptions = {
  force?: boolean;
};

type UseChainOptions<TAdapterOptions = unknown> = {
  device?: DeviceId;
  defaultDevice?: DeviceId;
  adapterOptions?: TAdapterOptions;
  forceDiscover?: boolean;
};

type CachedChain = {
  generation: number;
  context: SdkDeviceContext;
  signer: unknown;
  adapters: Map<string, unknown>;
};

const registry = createChainRegistry<SdkDeviceContext>();

let defaultDevice: DeviceId = 'lattice';
let autoRegisterChains = true;
let discoveryPromise: Promise<number> | null = null;
let cacheGeneration = 0;
const cache = new Map<string, CachedChain>();

const toChainCacheKey = (chainId: string, device: DeviceId) =>
  `${chainId}:${device}`;

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

const registerDiscoveredPlugin = (plugin: ChainPlugin<any>): boolean => {
  if (registry.has(plugin.chainId, plugin.device)) return false;
  registerChainPlugin(plugin);
  return true;
};

// Discovery registers built-ins once and returns newly added count.
async function runDiscovery(): Promise<number> {
  return discoverChains(registerDiscoveredPlugin);
}

export function configureChainRuntime(
  options: ConfigureChainRuntimeOptions = {},
): void {
  if (options.defaultDevice) {
    defaultDevice = options.defaultDevice;
  }
  if (typeof options.autoRegisterChains === 'boolean') {
    autoRegisterChains = options.autoRegisterChains;
  }
  if (options.resetCache) {
    invalidateChainCache();
  }
}

export function invalidateChainCache(): void {
  cacheGeneration += 1;
  cache.clear();
}

export function getDefaultDevice(): DeviceId {
  return defaultDevice;
}

export function registerChainPlugin(plugin: ChainPlugin<any>): void {
  ensurePrimitivesSeeded();
  preflightPluginPrimitives(plugin);

  let chainRegistered = false;
  try {
    registry.register(plugin as ChainPlugin<SdkDeviceContext>);
    chainRegistered = true;
    registerPluginPrimitives(plugin);
  } catch (err) {
    if (chainRegistered) {
      registry.unregister(plugin.chainId, plugin.device);
      unregisterPluginPrimitives(plugin.chainId, plugin.device);
    }
    throw err;
  }
}

export function unregisterChain(chainId: string, device?: DeviceId): boolean {
  cacheGeneration += 1;
  cache.clear();
  const unregistered = registry.unregister(chainId, device);
  if (unregistered) {
    unregisterPluginPrimitives(chainId, device);
  }
  return unregistered;
}

export function listChains(): ChainPlugin<SdkDeviceContext>[] {
  return registry.list();
}

export function getChain(
  chainId: string,
  device: DeviceId,
): ChainPlugin<SdkDeviceContext> | undefined {
  return registry.get(chainId, device);
}

export async function discoverAndRegisterChains(
  options: DiscoverAndRegisterOptions = {},
): Promise<number> {
  if (!autoRegisterChains && !options.force) {
    return 0;
  }
  if (!discoveryPromise || options.force) {
    discoveryPromise = runDiscovery();
  }
  return discoveryPromise;
}

export async function useChain<TAdapter = unknown, TAdapterOptions = unknown>(
  chainId: string,
  options: UseChainOptions<TAdapterOptions> = {},
): Promise<TAdapter> {
  // Lazy discovery keeps initial setup light and defers work until first chain use.
  await discoverAndRegisterChains({ force: options.forceDiscover });

  const resolved = registry.resolve(chainId, {
    device: options.device,
    defaultDevice: options.defaultDevice ?? defaultDevice,
  });

  if (!resolved) {
    const availableDevices = registry
      .list()
      .filter((plugin) => plugin.chainId === chainId)
      .map((plugin) => plugin.device);
    const details =
      availableDevices.length > 0
        ? ` Available devices: ${availableDevices.join(', ')}.`
        : '';
    throw new Error(`Chain "${chainId}" is not registered.${details}`);
  }

  const resolvedDevice = resolved.device;
  const chainCacheKey = toChainCacheKey(chainId, resolvedDevice);
  let cached = cache.get(chainCacheKey);

  // Signer is created once per (chain, device) generation and reused by adapters.
  if (!cached || cached.generation !== cacheGeneration) {
    const context = createDeviceContext();
    if (resolved.primitives?.requirements?.length) {
      const client = await context.getClient();
      const fwVersion = getFirmwareVersion(client);
      validatePluginPrimitiveRequirements(
        resolved as ChainPlugin<any>,
        fwVersion,
      );
    }
    const signer = await resolved.createSigner(context);
    cached = {
      generation: cacheGeneration,
      context,
      signer,
      adapters: new Map<string, unknown>(),
    };
    cache.set(chainCacheKey, cached);
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
