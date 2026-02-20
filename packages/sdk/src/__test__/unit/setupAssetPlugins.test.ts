import type {
  AssetAdapter,
  AssetModule,
  AssetPlugin,
  Signer,
} from '@gridplus/asset-core';
import { setup } from '../../api/setup';
import { getAsset, registerAssetPlugin, unregisterAsset } from '../../assets';
import {
  DEFAULT_ASSET_PLUGIN_KEYS,
  DEFAULT_ASSET_PLUGINS,
} from '../../assets/defaultManifest';

const mockSigner: Signer = {
  getAddress: async () => 'custom',
  getPublicKey: async () => new Uint8Array([1]),
  sign: async () => ({ signature: { bytes: new Uint8Array([2]) } }),
};

const mockAdapter: AssetAdapter = {
  getAddress: async () => 'custom',
  getAddresses: async () => ['custom'],
  getPublicKey: async () => new Uint8Array([1]),
  sign: async () => ({ signature: { bytes: new Uint8Array([2]) } }),
};

const buildPlugin = (
  assetId: string,
  device: string,
): AssetPlugin<any> => {
  const module: AssetModule = {
    id: assetId,
    name: `test-${assetId}`,
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
    assetId,
    device,
    module,
    createSigner: async () => mockSigner,
  };
};

const setupParamsBase = {
  getStoredClient: async () => '',
  setStoredClient: async (_clientData: string | null) => {},
  autoRegisterAssets: false as const,
};

describe('setup assetPlugins', () => {
  afterEach(() => {
    unregisterAsset('unit-test-asset', 'unit-test-device');
    DEFAULT_ASSET_PLUGIN_KEYS.forEach((key) => {
      const [assetId, device] = key.split(':');
      unregisterAsset(assetId, device);
    });
    DEFAULT_ASSET_PLUGINS.forEach((plugin) => {
      registerAssetPlugin(plugin);
    });
  });

  test('registers custom setup plugins before client hydration', async () => {
    const customPlugin = buildPlugin('unit-test-asset', 'unit-test-device');

    await expect(
      setup({
        ...setupParamsBase,
        assetPlugins: [customPlugin],
      }),
    ).rejects.toThrow('Client not initialized');

    expect(getAsset('unit-test-asset', 'unit-test-device')).toBeDefined();
  });

  test('custom plugin can override built-in defaults', async () => {
    const [assetId, device] = DEFAULT_ASSET_PLUGIN_KEYS[0].split(':');
    const duplicatePlugin = buildPlugin(assetId, device);

    await expect(
      setup({
        ...setupParamsBase,
        autoRegisterAssets: true,
        assetPlugins: [duplicatePlugin],
      }),
    ).rejects.toThrow('Client not initialized');

    expect(getAsset(assetId, device)?.createSigner).toBe(duplicatePlugin.createSigner);
  });

  test('rejects duplicate keys inside setup assetPlugins input', async () => {
    const dupA = buildPlugin('unit-test-asset', 'unit-test-device');
    const dupB = buildPlugin('unit-test-asset', 'unit-test-device');

    await expect(
      setup({
        ...setupParamsBase,
        assetPlugins: [dupA, dupB],
      }),
    ).rejects.toThrow(
      'Duplicate asset plugin key in setup().assetPlugins: "unit-test-asset:unit-test-device".',
    );
  });

  test('rejects invalid setup asset plugin entries', async () => {
    await expect(
      setup({
        ...setupParamsBase,
        assetPlugins: [{} as AssetPlugin<any>],
      }),
    ).rejects.toThrow('Invalid asset plugin in setup().assetPlugins');
  });
});
