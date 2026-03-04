import type {
  Address,
  ChainPlugin,
  DerivationPath,
  DeviceContext,
  SigningComponentKind,
  PublicKey,
  SignResult,
} from '@gridplus/chain-core';
import {
  cosmos,
  type CosmosAdapter,
  type CosmosAdapterOptions,
  type CosmosSignRequest,
  type Signer as CosmosSigner,
} from '../chain';
import { buildSigResultFromRsv, compressSecp256k1Pubkey } from './shared';

type SigningComponentCodes = {
  HASHES?: Record<string, number>;
  CURVES?: Record<string, number>;
  ENCODINGS?: Record<string, number>;
};

type LatticeCosmosContextInput = DeviceContext & {
  resolveSigningComponent?: (kind: SigningComponentKind, name: string) => number;
  constants: {
    EXTERNAL: {
      GET_ADDR_FLAGS: {
        SECP256K1_PUB: number;
      };
      SIGNING?: SigningComponentCodes;
    };
  };
};

type LatticeCosmosContext = DeviceContext & {
  resolveSigningComponent: (kind: SigningComponentKind, name: string) => number;
  constants: LatticeCosmosContextInput['constants'];
};

const hasNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const getSigningComponentFromConstants = (
  signing: SigningComponentCodes | undefined,
  kind: SigningComponentKind,
  name: string,
): number | undefined => {
  const byKind: Record<SigningComponentKind, Record<string, number> | undefined> = {
    hash: signing?.HASHES,
    curve: signing?.CURVES,
    encoding: signing?.ENCODINGS,
  };
  const code = byKind[kind]?.[name];
  return hasNumber(code) ? code : undefined;
};

function getLatticeCosmosContext(context: DeviceContext): LatticeCosmosContext {
  const typed = context as LatticeCosmosContextInput;
  const constants = typed.constants;
  const resolveSigningComponent = (kind: SigningComponentKind, name: string): number => {
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
      `Lattice Cosmos signer requires resolveSigningComponent() or EXTERNAL.SIGNING mapping for ${kind}:${name}.`,
    );
  };
  if (!hasNumber(constants?.EXTERNAL?.GET_ADDR_FLAGS?.SECP256K1_PUB)) {
    throw new Error('Lattice Cosmos signer requires EXTERNAL constants');
  }
  return {
    ...typed,
    resolveSigningComponent,
  };
}

export function createLatticeCosmosSigner(
  context: DeviceContext,
): CosmosSigner {
  const { queue, resolveSigningComponent, constants } =
    getLatticeCosmosContext(context);
  const { EXTERNAL } = constants;
  const curveSecp256k1 = resolveSigningComponent('curve', 'SECP256K1');
  const hashSha256 = resolveSigningComponent('hash', 'SHA256');
  const encodingCosmos = resolveSigningComponent('encoding', 'COSMOS');

  return {
    getAddress: async (path: DerivationPath): Promise<Address> => {
      void path;
      throw new Error(
        'Cosmos addresses must be derived from pubkey (use @gridplus/cosmos adapter)',
      );
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
          : true;
      return wantCompressed
        ? compressSecp256k1Pubkey(new Uint8Array(pubBytes))
        : new Uint8Array(pubBytes);
    },
    sign: async (request: CosmosSignRequest): Promise<SignResult> => {
      if (request.kind !== 'transaction') {
        throw new Error(
          `Unsupported Cosmos sign request kind: ${request.kind}`,
        );
      }
      const path = (request as any).options?.path as DerivationPath | undefined;
      if (!path || path.length < 2) {
        throw new Error('Cosmos sign request missing signer path');
      }

      const signPayload = {
        signerPath: path,
        curveType: curveSecp256k1,
        hashType: hashSha256,
        encodingType: encodingCosmos,
        payload: Buffer.from(request.payload as any),
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

      return {
        signature,
        publicKey: pubkey,
        metadata: {
          mode: (request as any).options?.mode,
        },
      };
    },
  };
}

export const latticePlugin: ChainPlugin<
  LatticeCosmosContext,
  CosmosSignRequest,
  CosmosAdapter,
  CosmosAdapterOptions,
  CosmosSigner
> = {
  chainId: cosmos.id,
  device: 'lattice',
  module: cosmos,
  createSigner: createLatticeCosmosSigner,
  signingSuite: {
    requirements: [
      { kind: 'curve', name: 'SECP256K1', minFirmware: [0, 14, 0] },
      { kind: 'hash', name: 'SHA256', minFirmware: [0, 14, 0] },
      { kind: 'encoding', name: 'COSMOS', minFirmware: [0, 18, 10] },
    ],
  },
};
