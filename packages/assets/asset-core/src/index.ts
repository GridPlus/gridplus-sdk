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

export type AssetCapabilities = {
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

export type AssetAdapter<
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

export type AssetModule<
  TSignRequest = SignRequest,
  TAdapter extends AssetAdapter<TSignRequest> = AssetAdapter<TSignRequest>,
  TOptions = unknown,
  TSigner extends Signer<TSignRequest> = Signer<TSignRequest>,
> = {
  readonly id: string;
  readonly name: string;
  readonly coinType: number;
  readonly curve: 'secp256k1' | 'ed25519' | 'bls12-381';
  readonly defaultPath: DerivationPath;
  readonly supports: AssetCapabilities;
  create: (signer: TSigner, options?: TOptions) => TAdapter;
  utils: Record<string, unknown>;
};

export type DeviceId = 'lattice' | (string & {});
export type AssetKey = `${string}:${DeviceId}`;

export type DeviceContext = {
  queue: <T>(fn: (client: unknown) => Promise<T>) => Promise<T>;
  getClient: () => Promise<unknown>;
  constants: Record<string, unknown>;
  services?: Record<string, unknown>;
};

export type AssetPlugin<
  TContext = DeviceContext,
  TSignRequest = SignRequest,
  TAdapter extends AssetAdapter<TSignRequest> = AssetAdapter<TSignRequest>,
  TOptions = unknown,
  TSigner extends Signer<TSignRequest> = Signer<TSignRequest>,
> = {
  assetId: string;
  device: DeviceId;
  module: AssetModule<TSignRequest, TAdapter, TOptions, TSigner>;
  createSigner: (context: TContext) => Promise<TSigner> | TSigner;
  createAdapter?: (
    context: TContext,
    signer: TSigner,
    options?: TOptions,
  ) => Promise<TAdapter> | TAdapter;
};

export type AssetRegistryResolveOptions = {
  device?: DeviceId;
  defaultDevice?: DeviceId;
};

export type AssetRegistryOptions = {
  onDuplicate?: 'throw' | 'replace';
};

export type AssetRegistry<TContext = DeviceContext> = {
  register: (plugin: AssetPlugin<TContext>) => void;
  unregister: (assetId: string, device?: DeviceId) => boolean;
  get: (assetId: string, device: DeviceId) => AssetPlugin<TContext> | undefined;
  list: () => AssetPlugin<TContext>[];
  has: (assetId: string, device?: DeviceId) => boolean;
  resolve: (
    assetId: string,
    options?: AssetRegistryResolveOptions,
  ) => AssetPlugin<TContext> | undefined;
};

export const toAssetKey = (assetId: string, device: DeviceId): AssetKey =>
  `${assetId}:${device}`;

export const isAssetModule = (value: unknown): value is AssetModule => {
  if (!value || typeof value !== 'object') return false;
  const mod = value as AssetModule;
  return (
    typeof mod.id === 'string' &&
    typeof mod.name === 'string' &&
    typeof mod.coinType === 'number' &&
    Array.isArray(mod.defaultPath) &&
    typeof mod.create === 'function'
  );
};

export const isAssetPlugin = (value: unknown): value is AssetPlugin => {
  if (!value || typeof value !== 'object') return false;
  const plugin = value as AssetPlugin;
  return (
    typeof plugin.assetId === 'string' &&
    typeof plugin.device === 'string' &&
    isAssetModule(plugin.module) &&
    typeof plugin.createSigner === 'function'
  );
};

export function createAssetRegistry<TContext = DeviceContext>(
  options: AssetRegistryOptions = {},
): AssetRegistry<TContext> {
  const store = new Map<AssetKey, AssetPlugin<TContext>>();
  const onDuplicate = options.onDuplicate ?? 'throw';

  const register = (plugin: AssetPlugin<TContext>) => {
    if (!isAssetPlugin(plugin)) {
      throw new Error('Invalid asset plugin');
    }
    if (plugin.module.id !== plugin.assetId) {
      throw new Error(
        `Asset plugin mismatch: assetId (${plugin.assetId}) must equal module.id (${plugin.module.id})`,
      );
    }
    const key = toAssetKey(plugin.assetId, plugin.device);
    if (store.has(key) && onDuplicate === 'throw') {
      throw new Error(`Asset plugin already registered for key: ${key}`);
    }
    store.set(key, plugin);
  };

  const unregister = (assetId: string, device?: DeviceId): boolean => {
    if (device) {
      return store.delete(toAssetKey(assetId, device));
    }
    const keys = [...store.keys()].filter((key) => key.startsWith(`${assetId}:`));
    keys.forEach((key) => store.delete(key));
    return keys.length > 0;
  };

  const get = (assetId: string, device: DeviceId) =>
    store.get(toAssetKey(assetId, device));

  const list = () => [...store.values()];

  const has = (assetId: string, device?: DeviceId) => {
    if (device) return store.has(toAssetKey(assetId, device));
    return [...store.keys()].some((key) => key.startsWith(`${assetId}:`));
  };

  const resolve = (
    assetId: string,
    opts: AssetRegistryResolveOptions = {},
  ): AssetPlugin<TContext> | undefined => {
    if (opts.device) {
      return get(assetId, opts.device);
    }
    if (opts.defaultDevice) {
      const preferred = get(assetId, opts.defaultDevice);
      if (preferred) return preferred;
    }
    const candidates = list().filter((plugin) => plugin.assetId === assetId);
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
