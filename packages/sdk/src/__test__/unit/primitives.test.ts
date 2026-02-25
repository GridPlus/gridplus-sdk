import type {
  ChainAdapter,
  ChainModule,
  ChainPlugin,
  PluginPrimitives,
  Signer,
} from '@gridplus/chain-core';
import {
  ensurePrimitivesSeeded,
  getPrimitiveRegistry,
  registerPluginPrimitives,
  resetPrimitiveRegistry,
  validatePluginPrimitiveRequirements,
} from '../../chains/primitives';

const mockSigner: Signer = {
  getAddress: async () => 'mock',
  getPublicKey: async () => new Uint8Array([1]),
  sign: async () => ({ signature: { bytes: new Uint8Array([2]) } }),
};

const mockAdapter: ChainAdapter = {
  getAddress: async () => 'mock',
  getAddresses: async () => ['mock'],
  getPublicKey: async () => new Uint8Array([1]),
  sign: async () => ({ signature: { bytes: new Uint8Array([2]) } }),
};

const buildPlugin = (
  chainId: string,
  primitives?: PluginPrimitives,
): ChainPlugin<any> => {
  const module: ChainModule = {
    id: chainId,
    name: chainId,
    coinType: 1,
    curve: 'secp256k1',
    defaultPath: [44, 60, 0, 0, 0],
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
    device: 'lattice',
    module,
    createSigner: async () => mockSigner,
    primitives,
  };
};

describe('sdk primitives module', () => {
  afterEach(() => {
    resetPrimitiveRegistry();
  });

  test('ensurePrimitivesSeeded is idempotent and registers builtins', () => {
    ensurePrimitivesSeeded();
    ensurePrimitivesSeeded();

    const registry = getPrimitiveRegistry();
    expect(registry.resolve('hash', 'KECCAK256')).toBeDefined();
    expect(registry.resolve('curve', 'SECP256K1')).toBeDefined();
    expect(registry.resolve('encoding', 'EVM')).toBeDefined();
  });

  test('registerPluginPrimitives registers custom definitions', () => {
    const plugin = buildPlugin('testchain', {
      definitions: [{ kind: 'encoding', name: 'TESTCHAIN', code: 99 }],
      requirements: [
        { kind: 'encoding', name: 'TESTCHAIN', minFirmware: [0, 20, 0] },
      ],
    });

    registerPluginPrimitives(plugin);
    expect(getPrimitiveRegistry().resolve('encoding', 'TESTCHAIN')).toBe(99);
  });

  test('registerPluginPrimitives fails on conflicts without partial commit', () => {
    registerPluginPrimitives(
      buildPlugin('chain-a', {
        definitions: [{ kind: 'encoding', name: 'TESTCHAIN', code: 99 }],
      }),
    );

    const conflicting = buildPlugin('chain-b', {
      definitions: [
        { kind: 'encoding', name: 'TESTCHAIN', code: 100 },
        { kind: 'hash', name: 'BLAKE2B', code: 4 },
      ],
    });

    expect(() => registerPluginPrimitives(conflicting)).toThrow();
    expect(getPrimitiveRegistry().resolve('hash', 'BLAKE2B')).toBeUndefined();
  });

  test('validatePluginPrimitiveRequirements passes when firmware requirement is met', () => {
    ensurePrimitivesSeeded();
    const plugin = buildPlugin('cosmos-like', {
      requirements: [
        { kind: 'encoding', name: 'COSMOS', minFirmware: [0, 18, 10] },
      ],
    });

    expect(() =>
      validatePluginPrimitiveRequirements(plugin, [0, 19, 0]),
    ).not.toThrow();
  });

  test('validatePluginPrimitiveRequirements throws when firmware requirement is unmet', () => {
    ensurePrimitivesSeeded();
    const plugin = buildPlugin('cosmos-like', {
      requirements: [
        { kind: 'encoding', name: 'COSMOS', minFirmware: [0, 18, 10] },
      ],
    });

    expect(() =>
      validatePluginPrimitiveRequirements(plugin, [0, 18, 9]),
    ).toThrow('Please update firmware');
  });

  test('validatePluginPrimitiveRequirements throws for missing primitive mapping', () => {
    const plugin = buildPlugin('custom-chain', {
      requirements: [
        { kind: 'encoding', name: 'UNREGISTERED_CHAIN', minFirmware: [0, 20, 0] },
      ],
    });

    expect(() =>
      validatePluginPrimitiveRequirements(plugin, [0, 20, 0]),
    ).toThrow('not registered');
  });

  test('rejects invalid requirement shape (fail-closed)', () => {
    const plugin = buildPlugin('invalid') as ChainPlugin<any>;
    (plugin as any).primitives = {
      requirements: [{ kind: 'hash', name: 'SHA256' }],
    };

    expect(() => registerPluginPrimitives(plugin)).toThrow(
      'invalid primitive requirement',
    );
    expect(() =>
      validatePluginPrimitiveRequirements(plugin, [9, 9, 9]),
    ).toThrow('invalid primitive requirement');
  });
});
