import type {
  Account,
  Address,
  ChainAdapter,
  ChainModule,
  Signer as CoreSigner,
  DerivationPath,
  GetAccountsParams,
  GetAddressParams,
  GetPublicKeyParams,
  PublicKey,
  SignResult,
} from '@gridplus/chain-core';
import { base58 } from '@scure/base';

const HARDENED_OFFSET = 0x80000000;
const SOLANA_COIN_TYPE = 501;

export type SolanaSignRequest = {
  kind: 'transaction';
  /** Typically a Solana message bytes (compiled message), not a full transaction. */
  payload: Uint8Array | Buffer;
  options?: { path?: DerivationPath };
};

export type Signer = CoreSigner<SolanaSignRequest>;

export type SolanaGetAddressParams = Omit<GetAddressParams, 'addressIndex'> & {
  includePublicKey?: boolean;
};

export type SolanaGetPublicKeyParams = Omit<
  GetPublicKeyParams,
  'addressIndex' | 'compressed'
>;

export type SolanaAdapterOptions = {
  accountIndex?: number;
  /** Solana derivations are typically fully hardened. This maps to the 4th path index. */
  change?: number;
};

export type SolanaAdapter = ChainAdapter<
  SolanaSignRequest,
  SolanaGetAddressParams,
  GetAccountsParams,
  SolanaGetPublicKeyParams,
  Account
>;

export const buildPath = (
  accountIndex: number,
  change: number,
): DerivationPath => {
  return [
    44 + HARDENED_OFFSET,
    SOLANA_COIN_TYPE + HARDENED_OFFSET,
    accountIndex + HARDENED_OFFSET,
    change + HARDENED_OFFSET,
  ];
};

export const pubkeyToAddress = (pubkey: Uint8Array): Address => {
  if (pubkey.length !== 32) {
    throw new Error(`Invalid Solana pubkey length: ${pubkey.length}`);
  }
  return base58.encode(pubkey);
};

export const addressToPubkey = (address: Address): PublicKey => {
  const bytes = base58.decode(address);
  if (bytes.length !== 32) {
    throw new Error(`Invalid Solana address length: ${bytes.length}`);
  }
  return bytes;
};

const validateAddress = (address: Address): boolean => {
  try {
    addressToPubkey(address);
    return true;
  } catch {
    return false;
  }
};

const normalizeAddress = (address: Address): Address => {
  // Ensures canonical base58 encoding for the underlying 32-byte pubkey.
  return pubkeyToAddress(addressToPubkey(address));
};

const resolvePath = (
  params?: { path?: DerivationPath; accountIndex?: number; change?: number },
  options?: SolanaAdapterOptions,
): DerivationPath => {
  if (params?.path) return params.path;
  const accountIndex = params?.accountIndex ?? options?.accountIndex ?? 0;
  const change = params?.change ?? options?.change ?? 0;
  return buildPath(accountIndex, change);
};

export const solana: ChainModule<
  SolanaSignRequest,
  SolanaAdapter,
  SolanaAdapterOptions
> = {
  id: 'solana',
  name: 'Solana',
  coinType: SOLANA_COIN_TYPE,
  curve: 'ed25519',
  defaultPath: buildPath(0, 0),
  supports: {
    signTransaction: true,
    signMessage: false,
    signTypedData: false,
    signArbitrary: false,
    getPublicKey: true,
  },
  create: (signer: Signer, options?: SolanaAdapterOptions): SolanaAdapter => {
    const getPublicKey = async (
      params: SolanaGetPublicKeyParams = {},
    ): Promise<PublicKey> => {
      const path = resolvePath(params, options);
      return signer.getPublicKey(path);
    };

    const getAddress = async (params: SolanaGetAddressParams = {}) => {
      const pubkey = await getPublicKey(params);
      return pubkeyToAddress(pubkey);
    };

    const getAddresses = async (params: GetAccountsParams = {}) => {
      const startIndex = params.startIndex ?? 0;
      const count = params.count ?? 1;
      const addresses: Address[] = [];
      for (let i = 0; i < count; i += 1) {
        addresses.push(
          await getAddress({
            accountIndex: startIndex + i,
            change: params.change ?? options?.change ?? 0,
          }),
        );
      }
      return addresses;
    };

    const getAccount = async (params: SolanaGetAddressParams = {}) => {
      const address = await getAddress(params);
      const path = resolvePath(params, options);
      const publicKey = params.includePublicKey
        ? await getPublicKey(params)
        : undefined;
      return { address, publicKey, path, index: params.accountIndex };
    };

    const getAccounts = async (params: GetAccountsParams = {}) => {
      const startIndex = params.startIndex ?? 0;
      const count = params.count ?? 1;
      const accounts: Account[] = [];
      for (let i = 0; i < count; i += 1) {
        const accountIndex = startIndex + i;
        const path = resolvePath(
          { accountIndex, change: params.change ?? options?.change ?? 0 },
          options,
        );
        const publicKey = params.includePublicKey
          ? await signer.getPublicKey(path)
          : undefined;
        const address = publicKey
          ? pubkeyToAddress(publicKey)
          : await getAddress({ path });
        accounts.push({ address, publicKey, path, index: accountIndex });
      }
      return accounts;
    };

    const sign = async (request: SolanaSignRequest): Promise<SignResult> => {
      const path = request.options?.path ?? resolvePath(undefined, options);
      const next: SolanaSignRequest = {
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
    };
  },
  utils: {
    buildPath,
    pubkeyToAddress,
    addressToPubkey,
    validateAddress,
    normalizeAddress,
  },
};
