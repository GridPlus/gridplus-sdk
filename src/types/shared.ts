import type { ec } from 'elliptic';

export interface KVRecords {
  [key: string]: string;
}

export interface EncrypterParams {
  payload: Buffer;
  sharedSecret: Buffer;
}

export interface Signature {
  r: Buffer;
  s: Buffer;
  v?: Buffer;
}

export type KeyPair = ec.KeyPair;

export type WalletPath = [number, number, number, number, number];

export interface DecryptedResponse {
  decryptedData: Buffer;
  newEphemeralPub: Buffer;
}
