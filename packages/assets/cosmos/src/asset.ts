import type {
  Account,
  Address,
  AssetAdapter,
  AssetModule,
  DerivationPath,
  GetAccountsParams,
  GetAddressParams,
  GetPublicKeyParams,
  PublicKey,
  SignResult,
  Signer as CoreSigner,
} from '@gridplus/asset-core';
import { bech32 } from 'bech32';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { sha256 } from '@noble/hashes/sha256';

export type CosmosSignMode = 'direct' | 'amino';

export type CosmosSignRequest = {
  kind: 'transaction';
  payload: Uint8Array | Buffer;
  options?: { path?: DerivationPath; mode?: CosmosSignMode };
};

export type Signer = CoreSigner<CosmosSignRequest>;

export type CosmosGetAddressParams = GetAddressParams & {
  hrp?: string;
  includePublicKey?: boolean;
};

export type CosmosGetPublicKeyParams = GetPublicKeyParams & {
  /** Cosmos public keys are typically compressed secp256k1 (33 bytes). */
  compressed?: boolean;
};

export type CosmosAdapterOptions = {
  /** Default derivation params used when no explicit path is provided. */
  coinType?: number;
  accountIndex?: number;
  change?: number;
  addressIndex?: number;
  hrp?: string;
};

export type CosmosAdapter = AssetAdapter<
  CosmosSignRequest,
  CosmosGetAddressParams,
  GetAccountsParams,
  CosmosGetPublicKeyParams,
  Account
> & {
  signDirect?: (
    signDoc: Uint8Array | Buffer,
    options?: { path?: DerivationPath },
  ) => Promise<SignResult>;
  signAmino?: (
    aminoSignDoc: Uint8Array | Buffer,
    options?: { path?: DerivationPath },
  ) => Promise<SignResult>;
};

const HARDENED_OFFSET = 0x80000000;

const DEFAULT_COIN_TYPE = 118;
const DEFAULT_HRP = 'cosmos';

const buildPath = (
  coinType: number,
  accountIndex: number,
  change: number,
  addressIndex: number,
): DerivationPath => {
  return [
    44 + HARDENED_OFFSET,
    coinType + HARDENED_OFFSET,
    accountIndex + HARDENED_OFFSET,
    change,
    addressIndex,
  ];
};

function compressSecp256k1Pubkey(pubkey: Uint8Array): Uint8Array {
  if (pubkey.length === 33 && (pubkey[0] === 0x02 || pubkey[0] === 0x03)) {
    return pubkey;
  }
  if (pubkey.length === 65 && pubkey[0] === 0x04) {
    const x = pubkey.slice(1, 33);
    const yLastByte = pubkey[64];
    const prefix = yLastByte % 2 === 0 ? 0x02 : 0x03;
    const out = new Uint8Array(33);
    out[0] = prefix;
    out.set(x, 1);
    return out;
  }
  // Unknown format, return as-is.
  return pubkey;
}

const pubkeyToBech32Address = (pubkeyCompressed: Uint8Array, hrp: string) => {
  const digest = ripemd160(sha256(pubkeyCompressed));
  const words = bech32.toWords(digest);
  return bech32.encode(hrp, words);
};

const resolvePath = (
  params?: {
    path?: DerivationPath;
    accountIndex?: number;
    change?: number;
    addressIndex?: number;
  },
  options?: CosmosAdapterOptions,
): DerivationPath => {
  if (params?.path) return params.path;
  const coinType = options?.coinType ?? DEFAULT_COIN_TYPE;
  const accountIndex = params?.accountIndex ?? options?.accountIndex ?? 0;
  const change = params?.change ?? options?.change ?? 0;
  const addressIndex = params?.addressIndex ?? options?.addressIndex ?? 0;
  return buildPath(coinType, accountIndex, change, addressIndex);
};

export const cosmos: AssetModule<
  CosmosSignRequest,
  CosmosAdapter,
  CosmosAdapterOptions
> = {
  id: 'cosmos',
  name: 'Cosmos',
  coinType: DEFAULT_COIN_TYPE,
  curve: 'secp256k1',
  defaultPath: buildPath(DEFAULT_COIN_TYPE, 0, 0, 0),
  supports: {
    signTransaction: true,
    signMessage: false,
    signTypedData: false,
    signArbitrary: false,
    getPublicKey: true,
  },
  create: (signer: Signer, options?: CosmosAdapterOptions): CosmosAdapter => {
    const getPublicKey = async (
      params: CosmosGetPublicKeyParams = {},
    ): Promise<PublicKey> => {
      const path = resolvePath(params, options);
      const wantCompressed = params.compressed ?? true;
      const pk = await signer.getPublicKey(path, {
        compressed: wantCompressed,
      });
      return wantCompressed ? compressSecp256k1Pubkey(pk) : pk;
    };

    const getAddress = async (params: CosmosGetAddressParams = {}) => {
      const hrp = params.hrp ?? options?.hrp ?? DEFAULT_HRP;
      const pubkey = await getPublicKey({
        ...params,
        compressed: true,
      });
      return pubkeyToBech32Address(pubkey, hrp);
    };

    const getAddresses = async (params: GetAccountsParams = {}) => {
      const hrp = options?.hrp ?? DEFAULT_HRP;
      const startIndex = params.startIndex ?? 0;
      const count = params.count ?? 1;
      const addresses: Address[] = [];
      for (let i = 0; i < count; i += 1) {
        addresses.push(
          await getAddress({
            hrp,
            addressIndex: startIndex + i,
            change: params.change,
          }),
        );
      }
      return addresses;
    };

    const getAccount = async (params: CosmosGetAddressParams = {}) => {
      const address = await getAddress(params);
      const path = resolvePath(params, options);
      const publicKey = params.includePublicKey
        ? await getPublicKey({ ...params, compressed: true })
        : undefined;
      return { address, publicKey, path, index: params.addressIndex };
    };

    const sign = async (request: CosmosSignRequest): Promise<SignResult> => {
      const path = request.options?.path ?? resolvePath(undefined, options);
      const next: CosmosSignRequest = {
        ...request,
        options: { ...(request.options ?? {}), path },
      };
      return signer.sign(next);
    };

    return {
      getAddress,
      getAddresses,
      getPublicKey,
      getAccount,
      sign,
      signDirect: (signDoc, signOptions) =>
        sign({
          kind: 'transaction',
          payload: signDoc,
          options: { ...(signOptions ?? {}), mode: 'direct' },
        }),
      signAmino: (aminoSignDoc, signOptions) =>
        sign({
          kind: 'transaction',
          payload: aminoSignDoc,
          options: { ...(signOptions ?? {}), mode: 'amino' },
        }),
    };
  },
  utils: {
    buildPath,
    compressSecp256k1Pubkey,
    pubkeyToBech32Address,
  },
};
