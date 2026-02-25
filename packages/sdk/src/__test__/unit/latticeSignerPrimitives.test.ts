import { createLatticeCosmosSigner } from '@gridplus/cosmos';
import { createLatticeEvmSigner } from '@gridplus/evm';
import { createLatticeSolanaSigner } from '@gridplus/solana';
import { createLatticeXrpSigner } from '@gridplus/xrp';
import type { PrimitiveKind } from '@gridplus/chain-core';

type PrimitiveMap = Record<string, number>;

type MockContextOptions = {
  primitives: PrimitiveMap;
  firmware?: [number, number, number];
  includeResolver?: boolean;
};

const primitiveKey = (kind: PrimitiveKind, name: string): string =>
  `${kind}:${name}`;

const buildSigningConstants = (primitives: PrimitiveMap) => {
  const signing = {
    HASHES: {} as Record<string, number>,
    CURVES: {} as Record<string, number>,
    ENCODINGS: {} as Record<string, number>,
  };

  Object.entries(primitives).forEach(([key, code]) => {
    const [kind, name] = key.split(':');
    if (!name) return;
    if (kind === 'hash') signing.HASHES[name] = code;
    if (kind === 'curve') signing.CURVES[name] = code;
    if (kind === 'encoding') signing.ENCODINGS[name] = code;
  });

  return signing;
};

const buildMockContext = (options: MockContextOptions) => {
  const firmware = options.firmware ?? [1, 0, 0];
  const includeResolver = options.includeResolver ?? true;
  const signCalls: Array<any> = [];

  const client = {
    sign: vi.fn(async (request: any) => {
      signCalls.push(request);
      return { sig: {} };
    }),
    getFwVersion: () => ({
      major: firmware[0],
      minor: firmware[1],
      fix: firmware[2],
    }),
    getAddresses: vi.fn(async () => []),
  };

  const resolvePrimitive = vi.fn((kind: PrimitiveKind, name: string) => {
    const key = primitiveKey(kind, name);
    const code = options.primitives[key];
    if (code === undefined) {
      throw new Error(`Missing primitive mapping for ${key}`);
    }
    return code;
  });

  const context: any = {
    queue: async <T>(fn: (client: unknown) => Promise<T>) => fn(client),
    getClient: async () => client,
    constants: {
      EXTERNAL: {
        GET_ADDR_FLAGS: {
          SECP256K1_PUB: 1,
          ED25519_PUB: 2,
        },
        SIGNING: buildSigningConstants(options.primitives),
      },
      CURRENCIES: {
        ETH_MSG: 'ETH_MSG',
      },
    },
    services: {},
  };
  if (includeResolver) {
    context.resolvePrimitive = resolvePrimitive;
  }

  return {
    context,
    client,
    signCalls,
    resolvePrimitive,
  };
};

const buildEip7702AuthListTx = () => ({
  type: 'eip7702',
  chainId: 1,
  nonce: 0,
  maxPriorityFeePerGas: 1n,
  maxFeePerGas: 2n,
  gas: 21000n,
  to: '0x1111111111111111111111111111111111111111',
  value: 0n,
  data: '0x',
  accessList: [],
  authorizationList: [
    {
      chainId: 1,
      address: '0x2222222222222222222222222222222222222222',
      nonce: 0,
      signature: {
        yParity: 0,
        r: `0x${'1'.repeat(64)}`,
        s: `0x${'2'.repeat(64)}`,
      },
    },
  ],
});

describe('lattice signer primitive resolution', () => {
  test('evm signer uses resolved primitive codes in sign payload', async () => {
    const { context, signCalls } = buildMockContext({
      primitives: {
        'curve:SECP256K1': 91,
        'hash:KECCAK256': 92,
        'encoding:EVM': 93,
        'encoding:EIP7702_AUTH': 94,
        'encoding:EIP7702_AUTH_LIST': 95,
      },
    });
    const signer = createLatticeEvmSigner(context);

    await signer.sign({
      kind: 'transaction',
      payload: '0x01',
      options: { path: [44, 60, 0] },
    });

    expect(signCalls).toHaveLength(1);
    expect(signCalls[0].data.curveType).toBe(91);
    expect(signCalls[0].data.hashType).toBe(92);
    expect(signCalls[0].data.encodingType).toBe(93);
  });

  test('solana signer uses resolved primitive codes in sign payload', async () => {
    const { context, signCalls } = buildMockContext({
      primitives: {
        'curve:ED25519': 11,
        'hash:NONE': 12,
        'encoding:SOLANA': 13,
      },
    });
    const signer = createLatticeSolanaSigner(context);

    await signer.sign({
      kind: 'transaction',
      payload: new Uint8Array([1, 2, 3]),
      options: { path: [44, 501, 0] },
    });

    expect(signCalls).toHaveLength(1);
    expect(signCalls[0].data.curveType).toBe(11);
    expect(signCalls[0].data.hashType).toBe(12);
    expect(signCalls[0].data.encodingType).toBe(13);
  });

  test('cosmos signer uses resolved primitive codes in sign payload', async () => {
    const { context, signCalls } = buildMockContext({
      primitives: {
        'curve:SECP256K1': 21,
        'hash:SHA256': 22,
        'encoding:COSMOS': 23,
      },
    });
    const signer = createLatticeCosmosSigner(context);

    await signer.sign({
      kind: 'transaction',
      payload: new Uint8Array([4, 5, 6]),
      options: { path: [44, 118, 0, 0, 0] },
    });

    expect(signCalls).toHaveLength(1);
    expect(signCalls[0].data.curveType).toBe(21);
    expect(signCalls[0].data.hashType).toBe(22);
    expect(signCalls[0].data.encodingType).toBe(23);
  });

  test('xrp signer uses resolved primitive codes in sign payload', async () => {
    const { context, signCalls } = buildMockContext({
      primitives: {
        'curve:SECP256K1': 31,
        'hash:SHA512HALF': 32,
        'encoding:XRP': 33,
      },
    });
    const signer = createLatticeXrpSigner(context);

    await signer.sign({
      kind: 'transaction',
      payload: new Uint8Array([7, 8, 9]),
      options: { path: [44, 144, 0, 0, 0] },
    });

    expect(signCalls).toHaveLength(1);
    expect(signCalls[0].data.curveType).toBe(31);
    expect(signCalls[0].data.hashType).toBe(32);
    expect(signCalls[0].data.encodingType).toBe(33);
  });

  test('evm signer falls back to EXTERNAL.SIGNING when resolvePrimitive is missing', async () => {
    const { context, signCalls } = buildMockContext({
      primitives: {
        'curve:SECP256K1': 61,
        'hash:KECCAK256': 62,
        'encoding:EVM': 63,
      },
      includeResolver: false,
    });
    const signer = createLatticeEvmSigner(context);

    await signer.sign({
      kind: 'transaction',
      payload: '0x01',
      options: { path: [44, 60, 0] },
    });

    expect(signCalls).toHaveLength(1);
    expect(signCalls[0].data.curveType).toBe(61);
    expect(signCalls[0].data.hashType).toBe(62);
    expect(signCalls[0].data.encodingType).toBe(63);
  });

  test('evm EIP-7702 signing fails below minimum firmware', async () => {
    const { context, client } = buildMockContext({
      primitives: {
        'curve:SECP256K1': 41,
        'hash:KECCAK256': 42,
        'encoding:EVM': 43,
        'encoding:EIP7702_AUTH': 44,
        'encoding:EIP7702_AUTH_LIST': 45,
      },
      firmware: [0, 17, 9],
    });
    const signer = createLatticeEvmSigner(context);

    await expect(
      signer.sign({
        kind: 'transaction',
        payload: buildEip7702AuthListTx() as any,
        options: { path: [44, 60, 0] },
      }),
    ).rejects.toThrow('requires firmware 0.18.0');
    expect(client.sign).not.toHaveBeenCalled();
  });

  test('evm EIP-7702 signing succeeds at minimum firmware and uses EIP-7702 encoding', async () => {
    const { context, signCalls } = buildMockContext({
      primitives: {
        'curve:SECP256K1': 51,
        'hash:KECCAK256': 52,
        'encoding:EVM': 53,
        'encoding:EIP7702_AUTH': 54,
        'encoding:EIP7702_AUTH_LIST': 55,
      },
      firmware: [0, 18, 0],
    });
    const signer = createLatticeEvmSigner(context);

    await signer.sign({
      kind: 'transaction',
      payload: buildEip7702AuthListTx() as any,
      options: { path: [44, 60, 0] },
    });

    expect(signCalls).toHaveLength(1);
    expect(signCalls[0].data.encodingType).toBe(55);
  });
});
