export type DerivationPath = number[];
export type Address = string;
export type PublicKey = Uint8Array;

export type Signature = {
  bytes: Uint8Array;
  r?: Uint8Array;
  s?: Uint8Array;
  v?: number | bigint;
};

export type SignResult = {
  signature: Signature;
  publicKey?: PublicKey;
  signedPayload?: Uint8Array | string;
  txHash?: string;
  metadata?: Record<string, unknown>;
};

export type Account = {
  address: Address;
  publicKey?: PublicKey;
  path: DerivationPath;
  index?: number;
};

export type ChainCapabilities = {
  signTransaction: boolean;
  signMessage: boolean;
  signTypedData: boolean;
  signArbitrary: boolean;
  getPublicKey: boolean;
  getXpub?: boolean;
};

export type GetAddressParams = {
  path?: DerivationPath;
  accountIndex?: number;
  change?: number;
  addressIndex?: number;
};

export type GetPublicKeyParams = {
  path?: DerivationPath;
  accountIndex?: number;
  change?: number;
  addressIndex?: number;
  compressed?: boolean;
};

export type GetAccountsParams = {
  startIndex?: number;
  count?: number;
  includePublicKey?: boolean;
  change?: number;
};

export type SignRequest =
  | { kind: 'transaction'; payload: unknown; options?: unknown }
  | { kind: 'message'; payload: string | Uint8Array; options?: unknown }
  | { kind: 'typedData'; payload: unknown; options?: unknown }
  | { kind: 'arbitrary'; payload: Uint8Array; options?: unknown };

export type Signer<TSignRequest = SignRequest> = {
  getAddress: (path: DerivationPath, options?: unknown) => Promise<Address>;
  getPublicKey: (path: DerivationPath, options?: unknown) => Promise<PublicKey>;
  sign: (request: TSignRequest) => Promise<SignResult>;
};

export type ChainAdapter<
  TSignRequest = SignRequest,
  TGetAddressParams = GetAddressParams,
  TGetAccountsParams = GetAccountsParams,
  TGetPublicKeyParams = GetPublicKeyParams,
  TAccount = Account,
> = {
  getAddress(params?: TGetAddressParams): Promise<Address>;
  getAddresses(params?: TGetAccountsParams): Promise<Address[]>;
  getPublicKey(params?: TGetPublicKeyParams): Promise<PublicKey>;
  getPublicKeys?(params?: TGetAccountsParams): Promise<PublicKey[]>;
  getAccount?(params?: TGetAddressParams): Promise<TAccount>;
  getAccounts?(params?: TGetAccountsParams): Promise<TAccount[]>;
  sign(request: TSignRequest): Promise<SignResult>;
  validateAddress?(address: Address): boolean;
  normalizeAddress?(address: Address): Address;
};

export type ChainModule<
  TSignRequest = SignRequest,
  TAdapter extends ChainAdapter<TSignRequest> = ChainAdapter<TSignRequest>,
  TOptions = unknown,
  TSigner extends Signer<TSignRequest> = Signer<TSignRequest>,
> = {
  readonly id: string;
  readonly name: string;
  readonly coinType: number;
  readonly curve: 'secp256k1' | 'ed25519' | 'bls12-381';
  readonly defaultPath: DerivationPath;
  readonly supports: ChainCapabilities;
  create: (signer: TSigner, options?: TOptions) => TAdapter;
  utils: Record<string, unknown>;
};

export type DeviceId = 'lattice' | (string & {});
export type ChainKey = `${string}:${DeviceId}`;

export type DeviceContext = {
  queue: <T>(fn: (client: unknown) => Promise<T>) => Promise<T>;
  getClient: () => Promise<unknown>;
  constants: Record<string, unknown>;
  services?: Record<string, unknown>;
};

export type ChainPlugin<
  TContext = DeviceContext,
  TSignRequest = SignRequest,
  TAdapter extends ChainAdapter<TSignRequest> = ChainAdapter<TSignRequest>,
  TOptions = unknown,
  TSigner extends Signer<TSignRequest> = Signer<TSignRequest>,
> = {
  chainId: string;
  device: DeviceId;
  module: ChainModule<TSignRequest, TAdapter, TOptions, TSigner>;
  createSigner: (context: TContext) => Promise<TSigner> | TSigner;
  createAdapter?: (
    context: TContext,
    signer: TSigner,
    options?: TOptions,
  ) => Promise<TAdapter> | TAdapter;
};

export type ChainRegistryResolveOptions = {
  device?: DeviceId;
  defaultDevice?: DeviceId;
};

export type ChainRegistryOptions = {
  onDuplicate?: 'throw' | 'replace';
};

export type ChainRegistry<TContext = DeviceContext> = {
  register: (plugin: ChainPlugin<TContext>) => void;
  unregister: (chainId: string, device?: DeviceId) => boolean;
  get: (chainId: string, device: DeviceId) => ChainPlugin<TContext> | undefined;
  list: () => ChainPlugin<TContext>[];
  has: (chainId: string, device?: DeviceId) => boolean;
  resolve: (
    chainId: string,
    options?: ChainRegistryResolveOptions,
  ) => ChainPlugin<TContext> | undefined;
};

export const toChainKey = (chainId: string, device: DeviceId): ChainKey =>
  `${chainId}:${device}`;

export const isChainModule = (value: unknown): value is ChainModule => {
  if (!value || typeof value !== 'object') return false;
  const mod = value as ChainModule;
  return (
    typeof mod.id === 'string' &&
    typeof mod.name === 'string' &&
    typeof mod.coinType === 'number' &&
    Array.isArray(mod.defaultPath) &&
    typeof mod.create === 'function'
  );
};

export const isChainPlugin = (value: unknown): value is ChainPlugin => {
  if (!value || typeof value !== 'object') return false;
  const plugin = value as ChainPlugin;
  return (
    typeof plugin.chainId === 'string' &&
    typeof plugin.device === 'string' &&
    isChainModule(plugin.module) &&
    typeof plugin.createSigner === 'function'
  );
};

export function createChainRegistry<TContext = DeviceContext>(
  options: ChainRegistryOptions = {},
): ChainRegistry<TContext> {
  const store = new Map<ChainKey, ChainPlugin<TContext>>();
  const onDuplicate = options.onDuplicate ?? 'throw';

  const register = (plugin: ChainPlugin<TContext>) => {
    if (!isChainPlugin(plugin)) {
      throw new Error('Invalid chain plugin');
    }
    if (plugin.module.id !== plugin.chainId) {
      throw new Error(
        `Chain plugin mismatch: chainId (${plugin.chainId}) must equal module.id (${plugin.module.id})`,
      );
    }
    const key = toChainKey(plugin.chainId, plugin.device);
    if (store.has(key) && onDuplicate === 'throw') {
      throw new Error(`Chain plugin already registered for key: ${key}`);
    }
    store.set(key, plugin);
  };

  const unregister = (chainId: string, device?: DeviceId): boolean => {
    if (device) {
      return store.delete(toChainKey(chainId, device));
    }
    const keys = [...store.keys()].filter((key) =>
      key.startsWith(`${chainId}:`),
    );
    keys.forEach((key) => store.delete(key));
    return keys.length > 0;
  };

  const get = (chainId: string, device: DeviceId) =>
    store.get(toChainKey(chainId, device));

  const list = () => [...store.values()];

  const has = (chainId: string, device?: DeviceId) => {
    if (device) return store.has(toChainKey(chainId, device));
    return [...store.keys()].some((key) => key.startsWith(`${chainId}:`));
  };

  const resolve = (
    chainId: string,
    opts: ChainRegistryResolveOptions = {},
  ): ChainPlugin<TContext> | undefined => {
    if (opts.device) {
      return get(chainId, opts.device);
    }
    if (opts.defaultDevice) {
      const preferred = get(chainId, opts.defaultDevice);
      if (preferred) return preferred;
    }
    const candidates = list().filter((plugin) => plugin.chainId === chainId);
    if (candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0];
    const lattice = candidates.find((plugin) => plugin.device === 'lattice');
    if (lattice) return lattice;
    return undefined;
  };

  return {
    register,
    unregister,
    get,
    list,
    has,
    resolve,
  };
}
