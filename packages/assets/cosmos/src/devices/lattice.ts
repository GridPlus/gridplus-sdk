import type {
  Address,
  AssetPlugin,
  DerivationPath,
  DeviceContext,
  PublicKey,
  SignResult,
} from '@gridplus/asset-core';
import {
  cosmos,
  type CosmosAdapter,
  type CosmosAdapterOptions,
  type CosmosSignRequest,
  type Signer as CosmosSigner,
} from '../asset';
import { buildSigResultFromRsv, compressSecp256k1Pubkey } from './shared';

type LatticeCosmosContext = DeviceContext & {
  constants: {
    EXTERNAL: {
      GET_ADDR_FLAGS: {
        SECP256K1_PUB: number;
      };
      SIGNING: {
        CURVES: {
          SECP256K1: number;
        };
        HASHES: {
          SHA256: number;
        };
        ENCODINGS: {
          COSMOS: number;
        };
      };
    };
  };
};

function getLatticeCosmosConstants(
  context: DeviceContext,
): LatticeCosmosContext['constants'] {
  const constants = (context as LatticeCosmosContext).constants;
  const hasNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);
  if (
    !hasNumber(constants?.EXTERNAL?.GET_ADDR_FLAGS?.SECP256K1_PUB) ||
    !hasNumber(constants?.EXTERNAL?.SIGNING?.CURVES?.SECP256K1) ||
    !hasNumber(constants?.EXTERNAL?.SIGNING?.HASHES?.SHA256) ||
    !hasNumber(constants?.EXTERNAL?.SIGNING?.ENCODINGS?.COSMOS)
  ) {
    throw new Error('Lattice Cosmos signer requires EXTERNAL constants');
  }
  return constants;
}

export function createLatticeCosmosSigner(
  context: DeviceContext,
): CosmosSigner {
  const { queue } = context;
  const { EXTERNAL } = getLatticeCosmosConstants(context);

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
        curveType: EXTERNAL.SIGNING.CURVES.SECP256K1,
        hashType: EXTERNAL.SIGNING.HASHES.SHA256,
        encodingType: EXTERNAL.SIGNING.ENCODINGS.COSMOS,
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

export const latticePlugin: AssetPlugin<
  LatticeCosmosContext,
  CosmosSignRequest,
  CosmosAdapter,
  CosmosAdapterOptions,
  CosmosSigner
> = {
  assetId: cosmos.id,
  device: 'lattice',
  module: cosmos,
  createSigner: createLatticeCosmosSigner,
};
