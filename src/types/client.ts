import { CURRENCIES } from '../constants';
import { KeyPair } from './shared';

export type Currency = keyof typeof CURRENCIES;

export type SigningPath = number[];

export interface SignData {
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

export type SigningRequestResponse = SignData | { pubkey: null; sig: null };

export interface TransactionPayload {
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

export interface Wallet {
  /** 32 byte id */
  uid: Buffer;
  /** 20 char (max) string */
  name: Buffer | null;
  /** 4 byte flag */
  capabilities: number;
  /** External or internal wallet */
  external: boolean;
}

export interface ActiveWallets {
  internal: Wallet;
  external: Wallet;
}

export interface RequestParams {
  url: string;
  payload: any; //TODO Fix this any
  timeout?: number;
  retries?: number;
}

export interface ClientStateData {
  activeWallets: ActiveWallets;
  ephemeralPub: KeyPair;
  fwVersion: Buffer;
  deviceId: string;
  name: string;
  baseUrl: string;
  privKey: Buffer;
  key: Buffer;
  retryCount: number;
  timeout: number;
}
