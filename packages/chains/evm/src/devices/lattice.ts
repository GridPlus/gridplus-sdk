import type {
  Address,
  ChainPlugin,
  DerivationPath,
  DeviceContext,
  PrimitiveKind,
  PublicKey,
  SignResult,
} from '@gridplus/chain-core';
import { Hash } from 'ox';
import {
  type Hex,
  type TransactionSerializable,
  type TransactionSerializableEIP7702,
  serializeTransaction,
} from 'viem';
import {
  evm,
  type EvmAdapter,
  type EvmAdapterOptions,
  type EvmRawTransaction,
  type EvmSignRequest,
  type Signer as EvmSigner,
} from '../chain';
import {
  buildSigResultFromRsv,
  compressSecp256k1Pubkey,
  isHexString,
  toBuffer,
} from './shared';

export type LatticeEvmSignerOptions = {
  fetchEvmDecoder?: boolean;
};

type LatticeEvmContext = DeviceContext & {
  resolvePrimitive: (kind: PrimitiveKind, name: string) => number;
  constants: {
    EXTERNAL: {
      GET_ADDR_FLAGS: {
        SECP256K1_PUB: number;
      };
    };
    CURRENCIES: {
      ETH_MSG: string;
    };
  };
  services?: {
    fetchDecoder?: (request: {
      data: unknown;
      to: unknown;
      chainId: unknown;
    }) => Promise<Buffer | undefined>;
  };
};

function getLatticeEvmContext(context: DeviceContext): LatticeEvmContext {
  const typed = context as LatticeEvmContext;
  const constants = typed.constants;
  const hasNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);
  if (typeof typed.resolvePrimitive !== 'function') {
    throw new Error('Lattice EVM signer requires primitive resolver');
  }
  if (
    !hasNumber(constants?.EXTERNAL?.GET_ADDR_FLAGS?.SECP256K1_PUB) ||
    !constants?.CURRENCIES?.ETH_MSG
  ) {
    throw new Error(
      'Lattice EVM signer requires EXTERNAL and CURRENCIES constants',
    );
  }
  return typed;
}

function isRawEvmTx(
  value: TransactionSerializable | EvmRawTransaction,
): value is EvmRawTransaction {
  return (
    typeof value === 'string' ||
    value instanceof Uint8Array ||
    Buffer.isBuffer(value)
  );
}

function normalizeRawEvmTx(tx: EvmRawTransaction): Hex | Buffer {
  if (typeof tx === 'string') {
    return tx.startsWith('0x') ? (tx as Hex) : (`0x${tx}` as Hex);
  }
  return Buffer.from(tx);
}

function getEvmEncodingType(
  tx: TransactionSerializable,
  resolvePrimitive: LatticeEvmContext['resolvePrimitive'],
): number {
  if ((tx as any).type === 'eip7702') {
    const eip7702 = tx as TransactionSerializableEIP7702;
    const hasAuthList =
      eip7702.authorizationList && eip7702.authorizationList.length > 0;
    return hasAuthList
      ? resolvePrimitive('encoding', 'EIP7702_AUTH_LIST')
      : resolvePrimitive('encoding', 'EIP7702_AUTH');
  }
  return resolvePrimitive('encoding', 'EVM');
}

const EIP7702_MIN_FIRMWARE: [number, number, number] = [0, 18, 0];

const getFirmwareVersion = (client: unknown): [number, number, number] => {
  const maybeClient = client as {
    getFwVersion?: () => { major?: unknown; minor?: unknown; fix?: unknown };
  };
  if (typeof maybeClient?.getFwVersion !== 'function') return [0, 0, 0];
  const fw = maybeClient.getFwVersion();
  const normalize = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.trunc(value))
      : 0;
  return [normalize(fw?.major), normalize(fw?.minor), normalize(fw?.fix)];
};

const isAtLeastFirmware = (
  current: [number, number, number],
  minimum: [number, number, number],
): boolean => {
  if (current[0] !== minimum[0]) return current[0] > minimum[0];
  if (current[1] !== minimum[1]) return current[1] > minimum[1];
  return current[2] >= minimum[2];
};

const assertEip7702FirmwareSupport = async (
  context: DeviceContext,
  resolvePrimitive: LatticeEvmContext['resolvePrimitive'],
  encodingType: number,
): Promise<void> => {
  const eip7702Encodings = new Set<number>([
    resolvePrimitive('encoding', 'EIP7702_AUTH'),
    resolvePrimitive('encoding', 'EIP7702_AUTH_LIST'),
  ]);
  if (!eip7702Encodings.has(encodingType)) return;
  const client = await context.getClient();
  const fwVersion = getFirmwareVersion(client);
  if (!isAtLeastFirmware(fwVersion, EIP7702_MIN_FIRMWARE)) {
    throw new Error(
      `EIP-7702 signing requires firmware ${EIP7702_MIN_FIRMWARE.join('.')} or newer. Device firmware: ${fwVersion.join('.')}.`,
    );
  }
};

export function createLatticeEvmSigner(
  context: DeviceContext,
  options: LatticeEvmSignerOptions = {},
): EvmSigner {
  const latticeContext = getLatticeEvmContext(context);
  const { queue, services, resolvePrimitive } = latticeContext;
  const { EXTERNAL, CURRENCIES } = latticeContext.constants;
  const curveSecp256k1 = resolvePrimitive('curve', 'SECP256K1');
  const hashKeccak256 = resolvePrimitive('hash', 'KECCAK256');

  return {
    getAddress: async (path: DerivationPath): Promise<Address> => {
      const res = (await queue((client: any) =>
        client.getAddresses({ startPath: path, n: 1 }),
      )) as any[];
      const addr = res?.[0];
      if (typeof addr !== 'string') {
        throw new Error('Device did not return an EVM address string');
      }
      return addr;
    },
    getPublicKey: async (
      path: DerivationPath,
      opts?: unknown,
    ): Promise<PublicKey> => {
      const res = (await queue((client: any) =>
        client.getAddresses({
          startPath: path,
          n: 1,
          flag: EXTERNAL.GET_ADDR_FLAGS.SECP256K1_PUB,
        }),
      )) as any[];
      const pub = res?.[0];
      if (!pub) throw new Error('Device did not return a public key');
      const pubBytes = Buffer.from(pub);
      const wantCompressed =
        typeof (opts as any)?.compressed === 'boolean'
          ? Boolean((opts as any).compressed)
          : false;
      return wantCompressed
        ? compressSecp256k1Pubkey(new Uint8Array(pubBytes))
        : new Uint8Array(pubBytes);
    },
    sign: async (request: EvmSignRequest): Promise<SignResult> => {
      const path = (request as any).options?.path as DerivationPath | undefined;
      if (!path || path.length < 2) {
        throw new Error('EVM sign request missing signer path');
      }

      if (request.kind === 'transaction') {
        const isRaw = isRawEvmTx(request.payload);
        const payload = isRaw
          ? normalizeRawEvmTx(request.payload as EvmRawTransaction)
          : serializeTransaction(request.payload as TransactionSerializable);

        const encodingType = isRaw
          ? resolvePrimitive('encoding', 'EVM')
          : getEvmEncodingType(
              request.payload as TransactionSerializable,
              resolvePrimitive,
            );
        await assertEip7702FirmwareSupport(
          latticeContext,
          resolvePrimitive,
          encodingType,
        );

        let decoder: Buffer | undefined;
        const fetchDecoder = services?.fetchDecoder;
        if (!isRaw && options.fetchEvmDecoder && fetchDecoder) {
          const tx = request.payload as TransactionSerializable;
          if ('data' in tx && 'to' in tx && 'chainId' in tx) {
            decoder = await fetchDecoder({
              data: (tx as any).data,
              to: (tx as any).to,
              chainId: (tx as any).chainId,
            });
          }
        }

        const signPayload = {
          signerPath: path,
          curveType: curveSecp256k1,
          hashType: hashKeccak256,
          encodingType,
          payload,
          decoder,
        };

        const res = await queue((client: any) =>
          client.sign({ data: signPayload }),
        );
        const sig = (res as any).sig ?? {};
        const { signature } = buildSigResultFromRsv(sig);
        const pubkey = (res as any).pubkey
          ? compressSecp256k1Pubkey(
              new Uint8Array(Buffer.from((res as any).pubkey)),
            )
          : undefined;

        const signedPayload =
          (res as any).viemTx ?? (res as any).tx ?? undefined;
        const txHash =
          typeof signedPayload === 'string' && isHexString(signedPayload)
            ? (`0x${Buffer.from(Hash.keccak256(toBuffer(signedPayload))).toString('hex')}` as string)
            : undefined;

        return {
          signature,
          publicKey: pubkey,
          signedPayload,
          txHash,
          metadata: {
            viemTx: (res as any).viemTx,
          },
        };
      }

      if (request.kind === 'message') {
        const protocol = (request as any).options?.protocol ?? 'signPersonal';
        const res = await queue((client: any) =>
          client.sign({
            data: {
              signerPath: path,
              curveType: curveSecp256k1,
              hashType: hashKeccak256,
              payload: request.payload as any,
              protocol,
            },
            currency: CURRENCIES.ETH_MSG,
          }),
        );
        const sig = (res as any).sig ?? {};
        const { signature } = buildSigResultFromRsv(sig);
        return {
          signature,
          metadata: {
            signer: (res as any).signer,
          },
        };
      }

      if (request.kind === 'typedData') {
        const res = await queue((client: any) =>
          client.sign({
            data: {
              signerPath: path,
              curveType: curveSecp256k1,
              hashType: hashKeccak256,
              payload: request.payload as any,
              protocol: 'eip712',
            },
            currency: CURRENCIES.ETH_MSG,
          }),
        );
        const sig = (res as any).sig ?? {};
        const { signature } = buildSigResultFromRsv(sig);
        return {
          signature,
          metadata: {
            signer: (res as any).signer,
          },
        };
      }

      throw new Error(
        `Unsupported EVM sign request kind: ${(request as any).kind}`,
      );
    },
  };
}

export const latticePlugin: ChainPlugin<
  LatticeEvmContext,
  EvmSignRequest,
  EvmAdapter,
  EvmAdapterOptions,
  EvmSigner
> = {
  chainId: evm.id,
  device: 'lattice',
  module: evm,
  createSigner: (context) => createLatticeEvmSigner(context),
  primitives: {
    requirements: [
      { kind: 'curve', name: 'SECP256K1', minFirmware: [0, 14, 0] },
      { kind: 'hash', name: 'KECCAK256', minFirmware: [0, 14, 0] },
      { kind: 'encoding', name: 'EVM', minFirmware: [0, 15, 0] },
    ],
  },
};
