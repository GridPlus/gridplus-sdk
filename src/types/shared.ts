import type { ec } from 'elliptic';
import type { Signature } from 'viem';

export interface KVRecords {
  [key: string]: string;
}

export interface EncrypterParams {
  payload: Buffer;
  sharedSecret: Buffer;
}

export type { Signature };

export type KeyPair = ec.KeyPair;

export type WalletPath = [number, number, number, number, number];

export interface DecryptedResponse {
  decryptedData: Buffer;
  newEphemeralPub: KeyPair;
}
