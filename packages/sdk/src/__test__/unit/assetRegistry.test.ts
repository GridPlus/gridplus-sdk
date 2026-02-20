import type {
  AssetAdapter,
  AssetModule,
  AssetPlugin,
  Signer,
} from '@gridplus/asset-core';
import { createAssetRegistry } from '@gridplus/asset-core';

const mockSigner: Signer = {
  getAddress: async () => '0xmock',
  getPublicKey: async () => new Uint8Array([1, 2, 3]),
  sign: async () => ({ signature: { bytes: new Uint8Array([4, 5, 6]) } }),
};

const mockAdapter: AssetAdapter = {
  getAddress: async () => '0xmock',
  getAddresses: async () => ['0xmock'],
  getPublicKey: async () => new Uint8Array([1, 2, 3]),
  sign: async () => ({ signature: { bytes: new Uint8Array([4, 5, 6]) } }),
};

const mockModule: AssetModule = {
  id: 'mock',
  name: 'Mock',
  coinType: 1,
  curve: 'secp256k1',
  defaultPath: [1, 2, 3],
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

const createPlugin = (device: 'lattice' | 'lattice2'): AssetPlugin => ({
  assetId: 'mock',
  device,
  module: mockModule,
  createSigner: async () => mockSigner,
});

describe('asset-core registry', () => {
  test('register/get/list/unregister flow', () => {
    const registry = createAssetRegistry();
    registry.register(createPlugin('lattice'));

    expect(registry.has('mock')).toBe(true);
    expect(registry.has('mock', 'lattice')).toBe(true);
    expect(registry.get('mock', 'lattice')).toBeDefined();
    expect(registry.list()).toHaveLength(1);

    expect(registry.unregister('mock', 'lattice')).toBe(true);
    expect(registry.has('mock')).toBe(false);
  });

  test('throws on duplicate key by default', () => {
    const registry = createAssetRegistry();
    registry.register(createPlugin('lattice'));
    expect(() => registry.register(createPlugin('lattice'))).toThrow(
      'already registered',
    );
  });

  test('resolve prefers default device', () => {
    const registry = createAssetRegistry();
    registry.register(createPlugin('lattice'));
    registry.register(createPlugin('lattice2'));

    const resolved = registry.resolve('mock', { defaultDevice: 'lattice2' });
    expect(resolved?.device).toBe('lattice2');
  });

  test('lattice2 plugin can be resolved explicitly', () => {
    const registry = createAssetRegistry();
    registry.register(createPlugin('lattice'));
    registry.register(createPlugin('lattice2'));

    const resolved = registry.resolve('mock', { device: 'lattice2' });
    expect(resolved?.device).toBe('lattice2');
  });
});
