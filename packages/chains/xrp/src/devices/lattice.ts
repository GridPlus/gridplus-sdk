import type {
  Address,
  ChainPlugin,
  DerivationPath,
  DeviceContext,
  PublicKey,
  SignResult,
} from '@gridplus/chain-core';
import {
  type Signer as XrpSigner,
  type XrpAdapter,
  type XrpAdapterOptions,
  type XrpSignRequest,
  pubkeyToAddress,
  xrp,
} from '../chain';
import {
  buildSigResultFromRsv,
  compressSecp256k1Pubkey,
  toBuffer,
} from './shared';

type LatticeXrpContext = DeviceContext & {
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
          SHA512HALF: number;
        };
        ENCODINGS: {
          XRP: number;
        };
      };
    };
  };
};

function getLatticeXrpConstants(
  context: DeviceContext,
): LatticeXrpContext['constants'] {
  const constants = (context as LatticeXrpContext).constants;
  const hasNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

  if (
    !hasNumber(constants?.EXTERNAL?.GET_ADDR_FLAGS?.SECP256K1_PUB) ||
    !hasNumber(constants?.EXTERNAL?.SIGNING?.CURVES?.SECP256K1) ||
    !hasNumber(constants?.EXTERNAL?.SIGNING?.HASHES?.SHA512HALF) ||
    !hasNumber(constants?.EXTERNAL?.SIGNING?.ENCODINGS?.XRP)
  ) {
    throw new Error('Lattice XRP signer requires EXTERNAL constants');
  }

  return constants;
}

export function createLatticeXrpSigner(context: DeviceContext): XrpSigner {
  const { queue } = context;
  const { EXTERNAL } = getLatticeXrpConstants(context);

  const getPublicKey = async (
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
  };

  const getAddress = async (path: DerivationPath): Promise<Address> => {
    const pubkey = await getPublicKey(path, { compressed: true });
    return pubkeyToAddress(pubkey);
  };

  const sign = async (request: XrpSignRequest): Promise<SignResult> => {
    if (request.kind !== 'transaction') {
      throw new Error(`Unsupported XRP sign request kind: ${request.kind}`);
    }

    const path = (request as any).options?.path as DerivationPath | undefined;
    if (!path || path.length < 2) {
      throw new Error('XRP sign request missing signer path');
    }

    const signPayload = {
      signerPath: path,
      curveType: EXTERNAL.SIGNING.CURVES.SECP256K1,
      hashType: EXTERNAL.SIGNING.HASHES.SHA512HALF,
      encodingType: EXTERNAL.SIGNING.ENCODINGS.XRP,
      payload: toBuffer(request.payload as any),
    };

    const res = await queue((client: any) => client.sign({ data: signPayload }));
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
    };
  };

  return {
    getAddress,
    getPublicKey,
    sign,
  };
}

export const latticePlugin: ChainPlugin<
  LatticeXrpContext,
  XrpSignRequest,
  XrpAdapter,
  XrpAdapterOptions,
  XrpSigner
> = {
  chainId: xrp.id,
  device: 'lattice',
  module: xrp,
  createSigner: createLatticeXrpSigner,
};
