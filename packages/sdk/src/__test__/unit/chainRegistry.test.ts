import type {
  ChainAdapter,
  ChainModule,
  ChainPlugin,
  Signer,
} from '@gridplus/chain-core';
import { createChainRegistry } from '@gridplus/chain-core';

const mockSigner: Signer = {
  getAddress: async () => '0xmock',
  getPublicKey: async () => new Uint8Array([1, 2, 3]),
  sign: async () => ({ signature: { bytes: new Uint8Array([4, 5, 6]) } }),
};

const mockAdapter: ChainAdapter = {
  getAddress: async () => '0xmock',
  getAddresses: async () => ['0xmock'],
  getPublicKey: async () => new Uint8Array([1, 2, 3]),
  sign: async () => ({ signature: { bytes: new Uint8Array([4, 5, 6]) } }),
};

const mockModule: ChainModule = {
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

const createPlugin = (device: 'lattice' | 'lattice2'): ChainPlugin => ({
  chainId: 'mock',
  device,
  module: mockModule,
  createSigner: async () => mockSigner,
});

describe('chain-core registry', () => {
  test('register/get/list/unregister flow', () => {
    const registry = createChainRegistry();
    registry.register(createPlugin('lattice'));

    expect(registry.has('mock')).toBe(true);
    expect(registry.has('mock', 'lattice')).toBe(true);
    expect(registry.get('mock', 'lattice')).toBeDefined();
    expect(registry.list()).toHaveLength(1);

    expect(registry.unregister('mock', 'lattice')).toBe(true);
    expect(registry.has('mock')).toBe(false);
  });

  test('throws on duplicate key by default', () => {
    const registry = createChainRegistry();
    registry.register(createPlugin('lattice'));
    expect(() => registry.register(createPlugin('lattice'))).toThrow(
      'already registered',
    );
  });

  test('resolve prefers default device', () => {
    const registry = createChainRegistry();
    registry.register(createPlugin('lattice'));
    registry.register(createPlugin('lattice2'));

    const resolved = registry.resolve('mock', { defaultDevice: 'lattice2' });
    expect(resolved?.device).toBe('lattice2');
  });

  test('lattice2 plugin can be resolved explicitly', () => {
    const registry = createChainRegistry();
    registry.register(createPlugin('lattice'));
    registry.register(createPlugin('lattice2'));

    const resolved = registry.resolve('mock', { device: 'lattice2' });
    expect(resolved?.device).toBe('lattice2');
  });
});
