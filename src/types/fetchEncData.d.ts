interface EIP2335KeyExportReq {
  path: number[];
  c?: number;
  kdf?: number;
  walletUID?: Buffer;
}

interface FetchEncDataRequest {
  schema: number;
  params: EIP2335KeyExportReq; // NOTE: This is a union, but only one type of request exists currently
}

interface FetchEncDataRequestFunctionParams extends FetchEncDataRequest {
  client: Client;
}

interface EIP2335KeyExportData {
  iterations: number;
  cipherText: Buffer;
  salt: Buffer;
  checksum: Buffer;
  iv: Buffer;
  pubkey: Buffer;
}
