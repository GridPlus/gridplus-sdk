import {
  getFirmwareVersion,
  isAtLeastFirmware,
  type Address,
  type ChainPlugin,
  type DerivationPath,
  type DeviceContext,
  type FirmwareVersionTuple,
  type SigningComponentKind,
  type PublicKey,
  type SignResult,
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

type SigningComponentCodes = {
  HASHES?: Record<string, number>;
  CURVES?: Record<string, number>;
  ENCODINGS?: Record<string, number>;
};

type LatticeEvmContextInput = DeviceContext & {
  resolveSigningComponent?: (
    kind: SigningComponentKind,
    name: string,
  ) => number;
  constants: {
    EXTERNAL: {
      GET_ADDR_FLAGS: {
        SECP256K1_PUB: number;
      };
      SIGNING?: SigningComponentCodes;
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

type LatticeEvmContext = DeviceContext & {
  resolveSigningComponent: (kind: SigningComponentKind, name: string) => number;
  constants: LatticeEvmContextInput['constants'];
  services?: LatticeEvmContextInput['services'];
};

const hasNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const getSigningComponentFromConstants = (
  signing: SigningComponentCodes | undefined,
  kind: SigningComponentKind,
  name: string,
): number | undefined => {
  const byKind: Record<
    SigningComponentKind,
    Record<string, number> | undefined
  > = {
    hash: signing?.HASHES,
    curve: signing?.CURVES,
    encoding: signing?.ENCODINGS,
  };
  const code = byKind[kind]?.[name];
  return hasNumber(code) ? code : undefined;
};

function getLatticeEvmContext(context: DeviceContext): LatticeEvmContext {
  const typed = context as LatticeEvmContextInput;
  const constants = typed.constants;
  const resolveSigningComponent = (
    kind: SigningComponentKind,
    name: string,
  ): number => {
    if (typeof typed.resolveSigningComponent === 'function') {
      return typed.resolveSigningComponent(kind, name);
    }
    const fromConstants = getSigningComponentFromConstants(
      constants?.EXTERNAL?.SIGNING,
      kind,
      name,
    );
    if (fromConstants !== undefined) return fromConstants;
    throw new Error(
      `Lattice EVM signer requires resolveSigningComponent() or EXTERNAL.SIGNING mapping for ${kind}:${name}.`,
    );
  };
  if (
    !hasNumber(constants?.EXTERNAL?.GET_ADDR_FLAGS?.SECP256K1_PUB) ||
    !constants?.CURRENCIES?.ETH_MSG
  ) {
    throw new Error(
      'Lattice EVM signer requires EXTERNAL and CURRENCIES constants',
    );
  }
  return {
    ...typed,
    resolveSigningComponent,
  };
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
  resolveSigningComponent: (kind: SigningComponentKind, name: string) => number,
): number {
  if ((tx as any).type === 'eip7702') {
    const eip7702 = tx as TransactionSerializableEIP7702;
    const hasAuthList =
      eip7702.authorizationList && eip7702.authorizationList.length > 0;
    return hasAuthList
      ? resolveSigningComponent('encoding', 'EIP7702_AUTH_LIST')
      : resolveSigningComponent('encoding', 'EIP7702_AUTH');
  }
  return resolveSigningComponent('encoding', 'EVM');
}

const EIP7702_MIN_FIRMWARE: FirmwareVersionTuple = [0, 18, 0];

const assertEip7702FirmwareSupport = async (
  context: DeviceContext,
): Promise<void> => {
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
  const { queue, services, resolveSigningComponent } = latticeContext;
  const { EXTERNAL, CURRENCIES } = latticeContext.constants;
  const curveSecp256k1 = resolveSigningComponent('curve', 'SECP256K1');
  const hashKeccak256 = resolveSigningComponent('hash', 'KECCAK256');
  const encodingEvm = resolveSigningComponent('encoding', 'EVM');

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
          ? encodingEvm
          : getEvmEncodingType(
              request.payload as TransactionSerializable,
              resolveSigningComponent,
            );
        if (!isRaw && (request.payload as any).type === 'eip7702') {
          await assertEip7702FirmwareSupport(latticeContext);
        }

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
  signingSuite: {
    requirements: [
      { kind: 'curve', name: 'SECP256K1', minFirmware: [0, 14, 0] },
      { kind: 'hash', name: 'KECCAK256', minFirmware: [0, 14, 0] },
      { kind: 'encoding', name: 'EVM', minFirmware: [0, 15, 0] },
    ],
  },
};
