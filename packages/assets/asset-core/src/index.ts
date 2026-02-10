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
