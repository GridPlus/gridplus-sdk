import type { Address, Hash } from 'viem';
import type { KeyPair } from './shared';

export type SigningPath = number[];

/**
 * Signature components as returned by the Lattice device.
 * Values can be Buffer (raw) or string (hex) depending on context.
 */
export interface LatticeSignature {
  r: Buffer | string;
  s: Buffer | string;
  v?: Buffer | string | number | bigint;
}

export interface SignData {
  tx?: string;
  txHash?: Hash;
  changeRecipient?: string;
  sig?: LatticeSignature;
  sigs?: Buffer[];
  signer?: Address;
  pubkey?: Buffer;
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
  payload: any;
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
