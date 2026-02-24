import type {
  Address,
  ChainPlugin,
  DerivationPath,
  DeviceContext,
  PublicKey,
  SignResult,
} from '@gridplus/chain-core';
import {
  type SolanaAdapter,
  type SolanaAdapterOptions,
  type SolanaSignRequest,
  type Signer as SolanaSigner,
  pubkeyToAddress,
  solana,
} from '../chain';
import { buildSigResultFromRsv, toBuffer } from './shared';

type LatticeSolanaContext = DeviceContext & {
  constants: {
    EXTERNAL: {
      GET_ADDR_FLAGS: {
        ED25519_PUB: number;
      };
      SIGNING: {
        CURVES: {
          ED25519: number;
        };
        HASHES: {
          NONE: number;
        };
        ENCODINGS: {
          SOLANA: number;
        };
      };
    };
  };
};

function getLatticeSolanaConstants(
  context: DeviceContext,
): LatticeSolanaContext['constants'] {
  const constants = (context as LatticeSolanaContext).constants;
  const hasNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);
  if (
    !hasNumber(constants?.EXTERNAL?.GET_ADDR_FLAGS?.ED25519_PUB) ||
    !hasNumber(constants?.EXTERNAL?.SIGNING?.CURVES?.ED25519) ||
    !hasNumber(constants?.EXTERNAL?.SIGNING?.HASHES?.NONE) ||
    !hasNumber(constants?.EXTERNAL?.SIGNING?.ENCODINGS?.SOLANA)
  ) {
    throw new Error('Lattice Solana signer requires EXTERNAL constants');
  }
  return constants;
}

export function createLatticeSolanaSigner(
  context: DeviceContext,
): SolanaSigner {
  const { queue } = context;
  const { EXTERNAL } = getLatticeSolanaConstants(context);

  const getPublicKey = async (path: DerivationPath): Promise<PublicKey> => {
    const res = (await queue((client: any) =>
      client.getAddresses({
        startPath: path,
        n: 1,
        flag: EXTERNAL.GET_ADDR_FLAGS.ED25519_PUB,
      }),
    )) as any[];
    const pub = res?.[0];
    if (!pub) throw new Error('Device did not return a public key');
    const pubBytes = Buffer.from(pub);
    return new Uint8Array(pubBytes.slice(0, 32));
  };

  const getAddress = async (path: DerivationPath): Promise<Address> => {
    const pubkey = await getPublicKey(path);
    return pubkeyToAddress(pubkey);
  };

  const sign = async (request: SolanaSignRequest): Promise<SignResult> => {
    if (request.kind !== 'transaction') {
      throw new Error(`Unsupported Solana sign request kind: ${request.kind}`);
    }
    const path = (request as any).options?.path as DerivationPath | undefined;
    if (!path || path.length < 2) {
      throw new Error('Solana sign request missing signer path');
    }

    const signPayload = {
      signerPath: path,
      curveType: EXTERNAL.SIGNING.CURVES.ED25519,
      hashType: EXTERNAL.SIGNING.HASHES.NONE,
      encodingType: EXTERNAL.SIGNING.ENCODINGS.SOLANA,
      payload: toBuffer(request.payload as any),
    };

    const res = await queue((client: any) =>
      client.sign({ data: signPayload }),
    );
    const sig = (res as any).sig ?? {};
    const { signature } = buildSigResultFromRsv(sig);

    const pubkey = (res as any).pubkey
      ? new Uint8Array(Buffer.from((res as any).pubkey).slice(0, 32))
      : undefined;

    return {
      signature,
      publicKey: pubkey,
    };
  };

  return {
    getAddress,
    getPublicKey,
    sign,
  };
}

export const latticePlugin: ChainPlugin<
  LatticeSolanaContext,
  SolanaSignRequest,
  SolanaAdapter,
  SolanaAdapterOptions,
  SolanaSigner
> = {
  chainId: solana.id,
  device: 'lattice',
  module: solana,
  createSigner: createLatticeSolanaSigner,
};
