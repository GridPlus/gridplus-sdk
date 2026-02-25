import type {
  ChainAdapter,
  ChainModule,
  ChainPlugin,
  PluginPrimitives,
  Signer,
} from '@gridplus/chain-core';
import { setup } from '../../api/setup';
import { getChain, registerChainPlugin, unregisterChain } from '../../chains';
import {
  DEFAULT_CHAIN_PLUGIN_KEYS,
  DEFAULT_CHAIN_PLUGINS,
} from '../../chains/defaultManifest';
import {
  getPrimitiveRegistry,
  resetPrimitiveRegistry,
} from '../../chains/primitives';

const mockSigner: Signer = {
  getAddress: async () => 'custom',
  getPublicKey: async () => new Uint8Array([1]),
  sign: async () => ({ signature: { bytes: new Uint8Array([2]) } }),
};

const mockAdapter: ChainAdapter = {
  getAddress: async () => 'custom',
  getAddresses: async () => ['custom'],
  getPublicKey: async () => new Uint8Array([1]),
  sign: async () => ({ signature: { bytes: new Uint8Array([2]) } }),
};

const buildPlugin = (
  chainId: string,
  device: string,
  primitives?: PluginPrimitives,
): ChainPlugin<any> => {
  const module: ChainModule = {
    id: chainId,
    name: `test-${chainId}`,
    coinType: 1,
    curve: 'secp256k1',
    defaultPath: [44, 0, 0, 0, 0],
    supports: {
      signTransaction: true,
      signMessage: true,
      signTypedData: false,
      signArbitrary: false,
      getPublicKey: true,
    },
    create: () => mockAdapter,
    utils: {},
  };

  return {
    chainId,
    device,
    module,
    createSigner: async () => mockSigner,
    primitives,
  };
};

const setupParamsBase = {
  getStoredClient: async () => '',
  setStoredClient: async (_clientData: string | null) => {},
  autoRegisterChains: false as const,
};

describe('setup chainPlugins', () => {
  afterEach(() => {
    resetPrimitiveRegistry();
    unregisterChain('unit-test-chain', 'unit-test-device');
    DEFAULT_CHAIN_PLUGIN_KEYS.forEach((key) => {
      const [chainId, device] = key.split(':');
      unregisterChain(chainId, device);
    });
    DEFAULT_CHAIN_PLUGINS.forEach((plugin) => {
      registerChainPlugin(plugin);
    });
  });

  test('registers custom setup plugins before client hydration', async () => {
    const customPlugin = buildPlugin('unit-test-chain', 'unit-test-device');

    await expect(
      setup({
        ...setupParamsBase,
        chainPlugins: [customPlugin],
      }),
    ).rejects.toThrow('Client not initialized');

    expect(getChain('unit-test-chain', 'unit-test-device')).toBeDefined();
  });

  test('custom plugin can override built-in defaults', async () => {
    const [chainId, device] = DEFAULT_CHAIN_PLUGIN_KEYS[0].split(':');
    const duplicatePlugin = buildPlugin(chainId, device);

    await expect(
      setup({
        ...setupParamsBase,
        autoRegisterChains: true,
        chainPlugins: [duplicatePlugin],
      }),
    ).rejects.toThrow('Client not initialized');

    expect(getChain(chainId, device)?.createSigner).toBe(
      duplicatePlugin.createSigner,
    );
  });

  test('rejects duplicate keys inside setup chainPlugins input', async () => {
    const dupA = buildPlugin('unit-test-chain', 'unit-test-device');
    const dupB = buildPlugin('unit-test-chain', 'unit-test-device');

    await expect(
      setup({
        ...setupParamsBase,
        chainPlugins: [dupA, dupB],
      }),
    ).rejects.toThrow(
      'Duplicate chain plugin key in setup().chainPlugins: "unit-test-chain:unit-test-device".',
    );
  });

  test('rejects invalid setup chain plugin entries', async () => {
    await expect(
      setup({
        ...setupParamsBase,
        chainPlugins: [{} as ChainPlugin<any>],
      }),
    ).rejects.toThrow('Invalid chain plugin in setup().chainPlugins');
  });

  test('registerChainPlugin works without setup and lazily seeds builtins', () => {
    const customPlugin = buildPlugin('unit-test-chain', 'unit-test-device', {
      definitions: [{ kind: 'encoding', name: 'TESTCHAIN', code: 99 }],
      requirements: [
        { kind: 'encoding', name: 'TESTCHAIN', minFirmware: [0, 14, 0] },
      ],
    });

    registerChainPlugin(customPlugin);

    const registry = getPrimitiveRegistry();
    expect(registry.resolve('encoding', 'TESTCHAIN')).toBe(99);
    expect(registry.resolve('encoding', 'EVM')).toBeDefined();
    expect(getChain('unit-test-chain', 'unit-test-device')).toBeDefined();
  });
});
