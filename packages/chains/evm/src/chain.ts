import type {
  Account,
  Address,
  ChainAdapter,
  ChainModule,
  DerivationPath,
  GetAccountsParams,
  GetAddressParams,
  GetPublicKeyParams,
  SignResult,
  Signer as CoreSigner,
} from '@gridplus/chain-core';
import { getAddress as checksumAddress, isAddress } from 'viem';
import type { Hex, TransactionSerializable } from 'viem';

export type Eip712Payload = {
  types: Record<string, Array<{ name: string; type: string }>>;
  domain: Record<string, unknown>;
  primaryType: string;
  message: Record<string, unknown>;
};

export type EvmRawTransaction = Hex | Uint8Array | Buffer;

export type EvmSignRequest =
  | {
      kind: 'transaction';
      payload: TransactionSerializable | EvmRawTransaction;
      options?: { path?: DerivationPath };
    }
  | {
      kind: 'message';
      payload: string | Uint8Array | Buffer;
      options?: { path?: DerivationPath; protocol?: 'signPersonal' };
    }
  | {
      kind: 'typedData';
      payload: Eip712Payload;
      options?: { path?: DerivationPath };
    };

export type Signer = CoreSigner<EvmSignRequest>;

export type EvmGetAddressParams = GetAddressParams & {
  checksum?: boolean;
  includePublicKey?: boolean;
};

export type EvmGetPublicKeyParams = GetPublicKeyParams;

export type EvmAdapterOptions = {
  /** Default path used for getAddress/getPublicKey/sign if none is provided. */
  path?: DerivationPath;
  accountIndex?: number;
  change?: number;
  addressIndex?: number;
  checksum?: boolean;
};

export type EvmAdapter = ChainAdapter<
  EvmSignRequest,
  EvmGetAddressParams,
  GetAccountsParams,
  EvmGetPublicKeyParams,
  Account
> & {
  signTransaction?: (
    tx: TransactionSerializable | EvmRawTransaction,
    options?: { path?: DerivationPath },
  ) => Promise<SignResult>;
  signMessage?: (
    msg: string | Uint8Array | Buffer,
    options?: { path?: DerivationPath; protocol?: 'signPersonal' },
  ) => Promise<SignResult>;
  signTypedData?: (
    typedData: Eip712Payload,
    options?: { path?: DerivationPath },
  ) => Promise<SignResult>;
};

const HARDENED_OFFSET = 0x80000000;
const DEFAULT_PATH: DerivationPath = [
  44 + HARDENED_OFFSET,
  60 + HARDENED_OFFSET,
  0 + HARDENED_OFFSET,
  0,
  0,
];

const buildPath = (
  accountIndex: number,
  change: number,
  addressIndex: number,
): DerivationPath => {
  return [
    44 + HARDENED_OFFSET,
    60 + HARDENED_OFFSET,
    accountIndex + HARDENED_OFFSET,
    change,
    addressIndex,
  ];
};

const resolvePath = (
  params?: {
    path?: DerivationPath;
    accountIndex?: number;
    change?: number;
    addressIndex?: number;
  },
  options?: EvmAdapterOptions,
): DerivationPath => {
  if (params?.path) return params.path;

  const base = options?.path ? [...options.path] : [...DEFAULT_PATH];

  const defaultAccount =
    options?.path && base.length >= 3 ? base[2] - HARDENED_OFFSET : 0;
  const defaultChange = options?.path && base.length >= 4 ? base[3] : 0;
  const defaultIndex = options?.path && base.length >= 5 ? base[4] : 0;

  const accountIndex =
    params?.accountIndex ?? options?.accountIndex ?? defaultAccount;
  const change = params?.change ?? options?.change ?? defaultChange;
  const addressIndex =
    params?.addressIndex ?? options?.addressIndex ?? defaultIndex;

  // Ensure 5-depth path.
  if (base.length < 5) {
    return buildPath(accountIndex, change, addressIndex);
  }

  base[2] = accountIndex + HARDENED_OFFSET;
  base[3] = change;
  base[4] = addressIndex;
  return base;
};

const normalizeAddress = (address: Address, checksum = true): Address => {
  if (!checksum) return address;
  return checksumAddress(address);
};

export const evm: ChainModule<EvmSignRequest, EvmAdapter, EvmAdapterOptions> = {
  id: 'evm',
  name: 'EVM',
  coinType: 60,
  curve: 'secp256k1',
  defaultPath: DEFAULT_PATH,
  supports: {
    signTransaction: true,
    signMessage: true,
    signTypedData: true,
    signArbitrary: false,
    getPublicKey: true,
  },
  create: (signer: Signer, options?: EvmAdapterOptions): EvmAdapter => {
    const getAddress = async (params: EvmGetAddressParams = {}) => {
      const path = resolvePath(params, options);
      const checksum = params.checksum ?? options?.checksum ?? true;
      const addr = await signer.getAddress(path);
      return normalizeAddress(addr, checksum);
    };

    const getAddresses = async (params: GetAccountsParams = {}) => {
      const startIndex = params.startIndex ?? 0;
      const count = params.count ?? 1;
      const addresses: Address[] = [];
      for (let i = 0; i < count; i += 1) {
        const path = resolvePath(
          {
            accountIndex: options?.accountIndex ?? 0,
            change: params.change ?? options?.change ?? 0,
            addressIndex: startIndex + i,
          },
          options,
        );
        addresses.push(await signer.getAddress(path));
      }
      return addresses;
    };

    const getPublicKey = async (params: EvmGetPublicKeyParams = {}) => {
      const path = resolvePath(params, options);
      return signer.getPublicKey(path, {
        compressed: params.compressed ?? true,
      });
    };

    const getAccount = async (params: EvmGetAddressParams = {}) => {
      const address = await getAddress(params);
      const path = resolvePath(params, options);
      const publicKey = params.includePublicKey
        ? await signer.getPublicKey(path, { compressed: true })
        : undefined;
      return { address, publicKey, path, index: params.addressIndex };
    };

    const sign = async (request: EvmSignRequest): Promise<SignResult> => {
      // Ensure a path is always attached for signers that need it.
      const path =
        (request as any).options?.path ?? resolvePath(undefined, options);
      const next = {
        ...request,
        options: { ...(request as any).options, path },
      } as EvmSignRequest;
      return signer.sign(next);
    };

    return {
      getAddress,
      getAddresses,
      getPublicKey,
      getAccount,
      sign,
      validateAddress: (address) => isAddress(address),
      normalizeAddress: (address) => normalizeAddress(address, true),
      signTransaction: (tx, signOptions) =>
        sign({ kind: 'transaction', payload: tx, options: signOptions }),
      signMessage: (msg, signOptions) =>
        sign({ kind: 'message', payload: msg, options: signOptions }),
      signTypedData: (typedData, signOptions) =>
        sign({ kind: 'typedData', payload: typedData, options: signOptions }),
    };
  },
  utils: {
    buildPath,
    normalizeAddress,
  },
};
