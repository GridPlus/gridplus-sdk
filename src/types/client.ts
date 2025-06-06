import { CURRENCIES } from '../constants';
import { KeyPair } from './shared';
import type { Address, Hash, Hex, Signature } from 'viem';

export type Currency = keyof typeof CURRENCIES;

export type SigningPath = number[];

export interface SignData {
  tx?: string;
  txHash?: Hash;
  changeRecipient?: string;
  sig?: Signature;
  sigs?: Buffer[];
  signer?: Address;
  err?: string;
}

export type SigningRequestResponse = SignData | { pubkey: null; sig: null };

/**
 * @deprecated This type uses legacy field names and number types instead of viem-compatible bigint.
 * Use viem's TransactionSerializable types directly, or create viem-aligned request types.
 * This will be removed in a future version.
 */
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
