import type {
  ChainAdapter,
  ChainModule,
  ChainPlugin,
  PluginPrimitives,
  Signer,
} from '@gridplus/chain-core';
import { setLoadClient } from '../../api/state';
import {
  configureChainRuntime,
  getChain,
  registerChainPlugin,
  unregisterChain,
  useChain,
} from '../../chains';
import {
  getPrimitiveRegistry,
  resetPrimitiveRegistry,
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
      signMessage: false,
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

describe('chain runtime primitive integration', () => {
  afterEach(() => {
    unregisterChain('chain-a', 'lattice');
    unregisterChain('chain-b', 'lattice');
    unregisterChain('dup-chain', 'lattice');
    unregisterChain('req-chain', 'lattice');
    resetPrimitiveRegistry();
    configureChainRuntime({
      autoRegisterChains: true,
      defaultDevice: 'lattice',
      resetCache: true,
    });
    setLoadClient(async () => undefined);
  });

  test('primitive conflict does not register conflicting chain', () => {
    registerChainPlugin(
      buildPlugin('chain-a', {
        definitions: [{ kind: 'encoding', name: 'TESTCHAIN', code: 99 }],
      }),
    );

    expect(() =>
      registerChainPlugin(
        buildPlugin('chain-b', {
          definitions: [{ kind: 'encoding', name: 'TESTCHAIN', code: 100 }],
        }),
      ),
    ).toThrow();

    expect(getChain('chain-a', 'lattice')).toBeDefined();
    expect(getChain('chain-b', 'lattice')).toBeUndefined();
  });

  test('chain registration failure does not leave new primitive definitions', () => {
    registerChainPlugin(
      buildPlugin('dup-chain', {
        definitions: [{ kind: 'encoding', name: 'DUP_A', code: 201 }],
      }),
    );

    expect(() =>
      registerChainPlugin(
        buildPlugin('dup-chain', {
          definitions: [{ kind: 'encoding', name: 'DUP_B', code: 202 }],
        }),
      ),
    ).toThrow('already registered');

    const primitiveRegistry = getPrimitiveRegistry();
    expect(primitiveRegistry.resolve('encoding', 'DUP_A')).toBe(201);
    expect(primitiveRegistry.resolve('encoding', 'DUP_B')).toBeUndefined();
  });

  test('unregisterChain removes plugin-owned primitive definitions', () => {
    registerChainPlugin(
      buildPlugin('chain-a', {
        definitions: [{ kind: 'encoding', name: 'REPLACE_ME', code: 301 }],
      }),
    );

    const primitiveRegistry = getPrimitiveRegistry();
    expect(primitiveRegistry.resolve('encoding', 'REPLACE_ME')).toBe(301);

    expect(unregisterChain('chain-a', 'lattice')).toBe(true);
    expect(primitiveRegistry.resolve('encoding', 'REPLACE_ME')).toBeUndefined();

    registerChainPlugin(
      buildPlugin('chain-a', {
        definitions: [{ kind: 'encoding', name: 'REPLACE_ME', code: 302 }],
      }),
    );
    expect(primitiveRegistry.resolve('encoding', 'REPLACE_ME')).toBe(302);
  });

  test('useChain enforces primitive minFirmware requirements', async () => {
    configureChainRuntime({
      autoRegisterChains: false,
      defaultDevice: 'lattice',
      resetCache: true,
    });
    registerChainPlugin(
      buildPlugin('req-chain', {
        definitions: [{ kind: 'encoding', name: 'REQ_CHAIN', code: 88 }],
        requirements: [
          { kind: 'encoding', name: 'REQ_CHAIN', minFirmware: [0, 20, 0] },
        ],
      }),
    );

    setLoadClient(
      async () =>
        ({
          getFwVersion: () => ({ major: 0, minor: 19, fix: 0 }),
        }) as any,
    );

    await expect(useChain('req-chain')).rejects.toThrow(
      'Please update firmware',
    );
  });

  test('useChain succeeds when firmware satisfies requirements', async () => {
    configureChainRuntime({
      autoRegisterChains: false,
      defaultDevice: 'lattice',
      resetCache: true,
    });
    registerChainPlugin(
      buildPlugin('req-chain', {
        definitions: [{ kind: 'encoding', name: 'REQ_CHAIN', code: 88 }],
        requirements: [
          { kind: 'encoding', name: 'REQ_CHAIN', minFirmware: [0, 20, 0] },
        ],
      }),
    );
    setLoadClient(
      async () =>
        ({
          getFwVersion: () => ({ major: 0, minor: 20, fix: 0 }),
        }) as any,
    );

    await expect(useChain('req-chain')).resolves.toBeDefined();
  });
});
