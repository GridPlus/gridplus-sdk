import type {
  Address,
  ChainPlugin,
  DerivationPath,
  DeviceContext,
  PrimitiveKind,
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
  resolvePrimitive: (kind: PrimitiveKind, name: string) => number;
  constants: {
    EXTERNAL: {
      GET_ADDR_FLAGS: {
        SECP256K1_PUB: number;
      };
    };
  };
};

function getLatticeXrpContext(context: DeviceContext): LatticeXrpContext {
  const typed = context as LatticeXrpContext;
  const constants = typed.constants;
  const hasNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);
  if (typeof typed.resolvePrimitive !== 'function') {
    throw new Error('Lattice XRP signer requires primitive resolver');
  }

  if (!hasNumber(constants?.EXTERNAL?.GET_ADDR_FLAGS?.SECP256K1_PUB)) {
    throw new Error('Lattice XRP signer requires EXTERNAL constants');
  }

  return typed;
}

export function createLatticeXrpSigner(context: DeviceContext): XrpSigner {
  const { queue, resolvePrimitive, constants } = getLatticeXrpContext(context);
  const { EXTERNAL } = constants;
  const curveSecp256k1 = resolvePrimitive('curve', 'SECP256K1');
  const hashSha512Half = resolvePrimitive('hash', 'SHA512HALF');
  const encodingXrp = resolvePrimitive('encoding', 'XRP');

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
      curveType: curveSecp256k1,
      hashType: hashSha512Half,
      encodingType: encodingXrp,
      payload: toBuffer(request.payload as any),
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
  primitives: {
    requirements: [
      { kind: 'curve', name: 'SECP256K1', minFirmware: [0, 14, 0] },
      { kind: 'hash', name: 'SHA512HALF', minFirmware: [0, 18, 10] },
      { kind: 'encoding', name: 'XRP', minFirmware: [0, 18, 10] },
    ],
  },
};
