
type Currency = keyof typeof CURRENCIES;

type SigningPath = [number, number, number, number, number];

interface SignData {
  tx?: string;
  txHash?: string;
  changeRecipient?: string;
  sig?: {
    v: Buffer;
    r: Buffer;
    s: Buffer;
  };
  sigs?: Buffer[];
  signer?: Buffer;
  err?: string;
}

interface TransactionPayload {
  type: number;
  gasPrice: number;
  nonce: number;
  gasLimit: number;
  to: string;
  value: number;
  data: string;
  maxFeePerGas: number;
  maxPriorityFeePerGas: number;
}

interface SigningPayload {
  signerPath: SigningPath;
  payload: TransactionPayload;
  curveType: number;
  hashType: number;
  encodingType: number;
}

interface Wallet {
  /** 32 byte id */
  uid: Buffer;
  /** 20 char (max) string */
  name: Buffer;
  /** 4 byte flag */
  capabilities: number;
  /** External or internal wallet */
  external: boolean;
}

interface ActiveWallets {
  internal: Wallet;
  external: Wallet;
}

interface RequestParams {
  url: string;
  payload: any; //TODO Fix this any
  timeout?: number;
  retries?: number;
}

interface ClientStateData {
  activeWallets: ActiveWallets;
  ephemeralPub: Buffer;
  fwVersion: Buffer;
  deviceId: string;
  name: string;
  baseUrl: string;
  privKey: Buffer;
  key: Buffer;
  retryCount: number;
  timeout: number;
}