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

export type PrimitiveKind = 'hash' | 'curve' | 'encoding';

export type PrimitiveDefinition = {
  kind: PrimitiveKind;
  name: string;
  code: number;
};

export type PrimitiveRequirement = {
  kind: PrimitiveKind;
  name: string;
  minFirmware: [number, number, number];
};

export type PluginPrimitives = {
  definitions?: PrimitiveDefinition[];
  requirements?: PrimitiveRequirement[];
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
  primitives?: PluginPrimitives;
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

export {
  createPrimitiveRegistry,
  PrimitiveConflictError,
  type PrimitiveRegistry,
} from './primitiveRegistry';

// ---------------------------------------------------------------------------
// Firmware version utilities
// ---------------------------------------------------------------------------

export type FirmwareVersionTuple = [number, number, number];

const normalizeFirmwarePart = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
};

export const getFirmwareVersion = (client: unknown): FirmwareVersionTuple => {
  const maybeClient = client as {
    getFwVersion?: () => {
      major?: unknown;
      minor?: unknown;
      fix?: unknown;
    };
  };
  if (typeof maybeClient?.getFwVersion !== 'function') {
    return [0, 0, 0];
  }
  const fw = maybeClient.getFwVersion();
  return [
    normalizeFirmwarePart(fw?.major),
    normalizeFirmwarePart(fw?.minor),
    normalizeFirmwarePart(fw?.fix),
  ];
};

export const compareFirmwareVersions = (
  current: FirmwareVersionTuple,
  required: FirmwareVersionTuple,
): number => {
  if (current[0] !== required[0]) return current[0] - required[0];
  if (current[1] !== required[1]) return current[1] - required[1];
  return current[2] - required[2];
};

export const isAtLeastFirmware = (
  current: FirmwareVersionTuple,
  minimum: FirmwareVersionTuple,
): boolean => compareFirmwareVersions(current, minimum) >= 0;

// ---------------------------------------------------------------------------
// Shared chain utilities
// ---------------------------------------------------------------------------

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

export function toBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') {
    const hex = value.startsWith('0x') ? value.slice(2) : value;
    return Buffer.from(hex, 'hex');
  }
  throw new Error('Unsupported byte input');
}

export function parseHexBytes(
  value: unknown,
  expectedLen?: number,
): Uint8Array {
  if (typeof value === 'string') {
    const hex = value.startsWith('0x') ? value.slice(2) : value;
    const buf = Buffer.from(hex, 'hex');
    if (
      expectedLen !== undefined &&
      buf.length !== expectedLen &&
      buf.length < expectedLen
    ) {
      const out = Buffer.alloc(expectedLen);
      buf.copy(out, expectedLen - buf.length);
      return new Uint8Array(out);
    }
    return new Uint8Array(buf);
  }
  if (Buffer.isBuffer(value)) return new Uint8Array(value);
  if (value instanceof Uint8Array) return value;
  throw new Error('Unsupported signature component type');
}

export function buildSigResultFromRsv(sig: {
  r?: unknown;
  s?: unknown;
  v?: unknown;
}): {
  signature: {
    bytes: Uint8Array;
    r?: Uint8Array;
    s?: Uint8Array;
    v?: bigint | number;
  };
} {
  const r = sig.r !== undefined ? parseHexBytes(sig.r, 32) : undefined;
  const s = sig.s !== undefined ? parseHexBytes(sig.s, 32) : undefined;

  let v: bigint | number | undefined;
  if (typeof sig.v === 'bigint') v = sig.v;
  else if (typeof sig.v === 'number') v = sig.v;
  else if (typeof sig.v === 'string') v = BigInt(sig.v);
  else if (Buffer.isBuffer(sig.v) || sig.v instanceof Uint8Array) {
    const buf = Buffer.from(sig.v);
    v = buf.length === 0 ? 0n : BigInt(`0x${buf.toString('hex')}`);
  }

  const bytes =
    r && s
      ? new Uint8Array(Buffer.concat([Buffer.from(r), Buffer.from(s)]))
      : new Uint8Array();
  return { signature: { bytes, r, s, v } };
}
