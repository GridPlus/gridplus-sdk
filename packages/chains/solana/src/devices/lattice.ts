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
  type SolanaAdapter,
  type SolanaAdapterOptions,
  type SolanaSignRequest,
  type Signer as SolanaSigner,
  pubkeyToAddress,
  solana,
} from '../chain';
import { buildSigResultFromRsv, toBuffer } from './shared';

type SigningComponentCodes = {
  HASHES?: Record<string, number>;
  CURVES?: Record<string, number>;
  ENCODINGS?: Record<string, number>;
};

type LatticeSolanaContextInput = DeviceContext & {
  resolveSigningComponent?: (
    kind: SigningComponentKind,
    name: string,
  ) => number;
  constants: {
    EXTERNAL: {
      GET_ADDR_FLAGS: {
        ED25519_PUB: number;
      };
      SIGNING?: SigningComponentCodes;
    };
  };
};

type LatticeSolanaContext = DeviceContext & {
  resolveSigningComponent: (kind: SigningComponentKind, name: string) => number;
  constants: LatticeSolanaContextInput['constants'];
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

function getLatticeSolanaContext(context: DeviceContext): LatticeSolanaContext {
  const typed = context as LatticeSolanaContextInput;
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
      `Lattice Solana signer requires resolveSigningComponent() or EXTERNAL.SIGNING mapping for ${kind}:${name}.`,
    );
  };
  if (!hasNumber(constants?.EXTERNAL?.GET_ADDR_FLAGS?.ED25519_PUB)) {
    throw new Error('Lattice Solana signer requires EXTERNAL constants');
  }
  return {
    ...typed,
    resolveSigningComponent,
  };
}

export function createLatticeSolanaSigner(
  context: DeviceContext,
): SolanaSigner {
  const { queue, resolveSigningComponent, constants } =
    getLatticeSolanaContext(context);
  const { EXTERNAL } = constants;
  const curveEd25519 = resolveSigningComponent('curve', 'ED25519');
  const hashNone = resolveSigningComponent('hash', 'NONE');
  const encodingSolana = resolveSigningComponent('encoding', 'SOLANA');

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
      curveType: curveEd25519,
      hashType: hashNone,
      encodingType: encodingSolana,
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
  signingSuite: {
    requirements: [
      { kind: 'curve', name: 'ED25519', minFirmware: [0, 14, 0] },
      { kind: 'hash', name: 'NONE', minFirmware: [0, 14, 0] },
      { kind: 'encoding', name: 'SOLANA', minFirmware: [0, 14, 0] },
    ],
  },
};
