import { Client } from '../client';

export interface EIP2335KeyExportReq {
  path: number[];
  c?: number;
  kdf?: number;
  walletUID?: Buffer;
}

export interface FetchEncDataRequest {
  schema: number;
  params: EIP2335KeyExportReq; // NOTE: This is a union, but only one type of request exists currently
}

export interface FetchEncDataRequestFunctionParams extends FetchEncDataRequest {
  client: Client;
}

export interface EIP2335KeyExportData {
  iterations: number;
  cipherText: Buffer;
  salt: Buffer;
  checksum: Buffer;
  iv: Buffer;
  pubkey: Buffer;
}
