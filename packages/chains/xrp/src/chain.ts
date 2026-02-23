import type {
  Account,
  Address,
  ChainAdapter,
  ChainModule,
  DerivationPath,
  GetAccountsParams,
  GetAddressParams,
  GetPublicKeyParams,
  PublicKey,
  SignResult,
  Signer as CoreSigner,
} from '@gridplus/chain-core';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { sha256 } from '@noble/hashes/sha256';
import { base58xrp } from '@scure/base';

const HARDENED_OFFSET = 0x80000000;
const XRP_COIN_TYPE = 144;
const XRP_ADDRESS_VERSION = 0x00;
const XRP_ACCOUNT_ID_LEN = 20;
const XRP_CHECKSUM_LEN = 4;
const XRP_ADDRESS_BYTES = 1 + XRP_ACCOUNT_ID_LEN + XRP_CHECKSUM_LEN;

export type XrpSignRequest = {
  kind: 'transaction';
  /** XRPL signing preimage bytes (typically STX\\0 + canonical serialized transaction). */
  payload: Uint8Array | Buffer;
  options?: { path?: DerivationPath };
};

export type Signer = CoreSigner<XrpSignRequest>;

export type XrpGetAddressParams = GetAddressParams & {
  includePublicKey?: boolean;
};

export type XrpGetPublicKeyParams = GetPublicKeyParams;

export type XrpAdapterOptions = {
  accountIndex?: number;
  change?: number;
  addressIndex?: number;
};

export type XrpAdapter = ChainAdapter<
  XrpSignRequest,
  XrpGetAddressParams,
  GetAccountsParams,
  XrpGetPublicKeyParams,
  Account
> & {
  signTransaction?: (
    payload: Uint8Array | Buffer,
    options?: { path?: DerivationPath },
  ) => Promise<SignResult>;
};

export const buildPath = (
  accountIndex: number,
  change: number,
  addressIndex: number,
): DerivationPath => {
  return [
    44 + HARDENED_OFFSET,
    XRP_COIN_TYPE + HARDENED_OFFSET,
    accountIndex + HARDENED_OFFSET,
    change,
    addressIndex,
  ];
};

export function compressSecp256k1Pubkey(pubkey: Uint8Array): Uint8Array {
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
  return pubkey;
}

function sha256d(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export const encodeClassicAddress = (accountId: Uint8Array): Address => {
  if (accountId.length !== XRP_ACCOUNT_ID_LEN) {
    throw new Error(`Invalid XRP account ID length: ${accountId.length}`);
  }
  const body = new Uint8Array(1 + XRP_ACCOUNT_ID_LEN);
  body[0] = XRP_ADDRESS_VERSION;
  body.set(accountId, 1);

  const checksum = sha256d(body).slice(0, XRP_CHECKSUM_LEN);
  const payload = new Uint8Array(XRP_ADDRESS_BYTES);
  payload.set(body, 0);
  payload.set(checksum, body.length);
  return base58xrp.encode(payload);
};

export const decodeClassicAddress = (address: Address): Uint8Array => {
  const payload = base58xrp.decode(address);
  if (payload.length !== XRP_ADDRESS_BYTES) {
    throw new Error(`Invalid XRP address length: ${payload.length}`);
  }
  const body = payload.slice(0, 1 + XRP_ACCOUNT_ID_LEN);
  if (body[0] !== XRP_ADDRESS_VERSION) {
    throw new Error(`Unsupported XRP address version: ${body[0]}`);
  }
  const checksum = payload.slice(1 + XRP_ACCOUNT_ID_LEN);
  const expectedChecksum = sha256d(body).slice(0, XRP_CHECKSUM_LEN);
  if (!bytesEqual(checksum, expectedChecksum)) {
    throw new Error('Invalid XRP address checksum');
  }
  return body.slice(1);
};

export const pubkeyToAddress = (pubkey: Uint8Array): Address => {
  const compressed = compressSecp256k1Pubkey(pubkey);
  if (compressed.length !== 33) {
    throw new Error(`Invalid secp256k1 pubkey length: ${compressed.length}`);
  }
  const accountId = ripemd160(sha256(compressed));
  return encodeClassicAddress(accountId);
};

const validateAddress = (address: Address): boolean => {
  try {
    decodeClassicAddress(address);
    return true;
  } catch {
    return false;
  }
};

const normalizeAddress = (address: Address): Address => {
  return encodeClassicAddress(decodeClassicAddress(address));
};

const resolvePath = (
  params?: {
    path?: DerivationPath;
    accountIndex?: number;
    change?: number;
    addressIndex?: number;
  },
  options?: XrpAdapterOptions,
): DerivationPath => {
  if (params?.path) return params.path;
  const accountIndex = params?.accountIndex ?? options?.accountIndex ?? 0;
  const change = params?.change ?? options?.change ?? 0;
  const addressIndex = params?.addressIndex ?? options?.addressIndex ?? 0;
  return buildPath(accountIndex, change, addressIndex);
};

export const xrp: ChainModule<XrpSignRequest, XrpAdapter, XrpAdapterOptions> = {
  id: 'xrp',
  name: 'XRP',
  coinType: XRP_COIN_TYPE,
  curve: 'secp256k1',
  defaultPath: buildPath(0, 0, 0),
  supports: {
    signTransaction: true,
    signMessage: false,
    signTypedData: false,
    signArbitrary: false,
    getPublicKey: true,
  },
  create: (signer: Signer, options?: XrpAdapterOptions): XrpAdapter => {
    const getPublicKey = async (
      params: XrpGetPublicKeyParams = {},
    ): Promise<PublicKey> => {
      const path = resolvePath(params, options);
      const wantCompressed = params.compressed ?? true;
      const pubkey = await signer.getPublicKey(path, {
        compressed: wantCompressed,
      });
      return wantCompressed ? compressSecp256k1Pubkey(pubkey) : pubkey;
    };

    const getAddress = async (params: XrpGetAddressParams = {}) => {
      const pubkey = await getPublicKey({ ...params, compressed: true });
      return pubkeyToAddress(pubkey);
    };

    // `startIndex` maps to XRP address index at m/44'/144'/account'/change/index.
    const getAddresses = async (params: GetAccountsParams = {}) => {
      const startIndex = params.startIndex ?? 0;
      const count = params.count ?? 1;
      const accountIndex = options?.accountIndex ?? 0;
      const change = params.change ?? options?.change ?? 0;
      const addresses: Address[] = [];

      for (let i = 0; i < count; i += 1) {
        addresses.push(
          await getAddress({
            accountIndex,
            change,
            addressIndex: startIndex + i,
          }),
        );
      }
      return addresses;
    };

    const getAccount = async (params: XrpGetAddressParams = {}) => {
      const address = await getAddress(params);
      const path = resolvePath(params, options);
      const publicKey = params.includePublicKey
        ? await getPublicKey({ ...params, compressed: true })
        : undefined;
      return { address, publicKey, path, index: params.addressIndex };
    };

    const getAccounts = async (params: GetAccountsParams = {}) => {
      const startIndex = params.startIndex ?? 0;
      const count = params.count ?? 1;
      const accountIndex = options?.accountIndex ?? 0;
      const change = params.change ?? options?.change ?? 0;
      const accounts: Account[] = [];

      for (let i = 0; i < count; i += 1) {
        const addressIndex = startIndex + i;
        const path = resolvePath(
          { accountIndex, change, addressIndex },
          options,
        );
        const publicKey = params.includePublicKey
          ? await getPublicKey({ path, compressed: true })
          : undefined;
        const address = publicKey
          ? pubkeyToAddress(publicKey)
          : await getAddress({ path });

        accounts.push({
          address,
          publicKey,
          path,
          index: addressIndex,
        });
      }
      return accounts;
    };

    const sign = async (request: XrpSignRequest): Promise<SignResult> => {
      const path = request.options?.path ?? resolvePath(undefined, options);
      const next: XrpSignRequest = {
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
      getAccounts,
      sign,
      validateAddress,
      normalizeAddress,
      signTransaction: (
        payload: Uint8Array | Buffer,
        signOptions?: { path?: DerivationPath },
      ) => sign({ kind: 'transaction', payload, options: signOptions }),
    };
  },
  utils: {
    buildPath,
    compressSecp256k1Pubkey,
    encodeClassicAddress,
    decodeClassicAddress,
    pubkeyToAddress,
    validateAddress,
    normalizeAddress,
  },
};
