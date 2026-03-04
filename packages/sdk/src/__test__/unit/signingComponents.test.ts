import type {
  ChainAdapter,
  ChainModule,
  ChainPlugin,
  ChainSigningSuite,
  Signer,
} from '@gridplus/chain-core';
import {
  ensureSigningComponentsSeeded,
  getSigningComponentRegistry,
  registerPluginSigningComponents,
  resetSigningComponentRegistry,
  validatePluginSigningRequirements,
} from '../../chains/signingComponents';

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
  signingSuite?: ChainSigningSuite,
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
    signingSuite,
  };
};

describe('sdk signing components module', () => {
  afterEach(() => {
    resetSigningComponentRegistry();
  });

  test('ensureSigningComponentsSeeded is idempotent and registers builtins', () => {
    ensureSigningComponentsSeeded();
    ensureSigningComponentsSeeded();

    const registry = getSigningComponentRegistry();
    expect(registry.resolve('hash', 'KECCAK256')).toBeDefined();
    expect(registry.resolve('curve', 'SECP256K1')).toBeDefined();
    expect(registry.resolve('encoding', 'EVM')).toBeDefined();
  });

  test('registerPluginSigningComponents registers custom definitions', () => {
    const plugin = buildPlugin('testchain', {
      definitions: [{ kind: 'encoding', name: 'TESTCHAIN', code: 99 }],
      requirements: [
        { kind: 'encoding', name: 'TESTCHAIN', minFirmware: [0, 20, 0] },
      ],
    });

    registerPluginSigningComponents(plugin);
    expect(getSigningComponentRegistry().resolve('encoding', 'TESTCHAIN')).toBe(
      99,
    );
  });

  test('registerPluginSigningComponents fails on conflicts without partial commit', () => {
    registerPluginSigningComponents(
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

    expect(() => registerPluginSigningComponents(conflicting)).toThrow();
    expect(
      getSigningComponentRegistry().resolve('hash', 'BLAKE2B'),
    ).toBeUndefined();
  });

  test('validatePluginSigningRequirements passes when firmware requirement is met', () => {
    ensureSigningComponentsSeeded();
    const plugin = buildPlugin('cosmos-like', {
      requirements: [
        { kind: 'encoding', name: 'COSMOS', minFirmware: [0, 18, 10] },
      ],
    });

    expect(() =>
      validatePluginSigningRequirements(plugin, [0, 19, 0]),
    ).not.toThrow();
  });

  test('validatePluginSigningRequirements throws when firmware requirement is unmet', () => {
    ensureSigningComponentsSeeded();
    const plugin = buildPlugin('cosmos-like', {
      requirements: [
        { kind: 'encoding', name: 'COSMOS', minFirmware: [0, 18, 10] },
      ],
    });

    expect(() => validatePluginSigningRequirements(plugin, [0, 18, 9])).toThrow(
      'Please update firmware',
    );
  });

  test('validatePluginSigningRequirements throws for missing signing component mapping', () => {
    const plugin = buildPlugin('custom-chain', {
      requirements: [
        {
          kind: 'encoding',
          name: 'UNREGISTERED_CHAIN',
          minFirmware: [0, 20, 0],
        },
      ],
    });

    expect(() => validatePluginSigningRequirements(plugin, [0, 20, 0])).toThrow(
      'not registered',
    );
  });

  test('rejects invalid requirement shape (fail-closed)', () => {
    const plugin = buildPlugin('invalid') as ChainPlugin<any>;
    (plugin as any).signingSuite = {
      requirements: [{ kind: 'hash', name: 'SHA256' }],
    };

    expect(() => registerPluginSigningComponents(plugin)).toThrow(
      'invalid signing component requirement',
    );
    expect(() => validatePluginSigningRequirements(plugin, [9, 9, 9])).toThrow(
      'invalid signing component requirement',
    );
  });
});
