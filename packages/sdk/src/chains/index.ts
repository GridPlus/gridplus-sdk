export {
  configureChainRuntime,
  discoverAndRegisterChains,
  getChain,
  getDefaultDevice,
  invalidateChainCache,
  listChains,
  registerChainPlugin,
  unregisterChain,
  useChain,
} from './registry';
export {
  ensurePrimitivesSeeded,
  preflightPluginPrimitives,
  registerPluginPrimitives,
  validatePluginPrimitiveRequirements,
} from './primitives';

export type {
  ChainKey,
  ChainPlugin,
  ChainRegistry,
  ChainRegistryOptions,
  ChainRegistryResolveOptions,
  DeviceContext,
  DeviceId,
  PluginPrimitives,
  PrimitiveDefinition,
  PrimitiveKind,
  PrimitiveRequirement,
} from '@gridplus/chain-core';

export type { SdkDeviceContext } from './context';
