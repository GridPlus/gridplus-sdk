interface EIP2335KeyExportReq {
  path: number[];
  c?: number;
  kdf?: number;
  walletUID?: Buffer;
}

interface ExportEncDataRequest {
  schema: number;
  params: EIP2335KeyExportReq; // NOTE: This is a union, but only one type of request exists currently
}

interface ExportEncDataRequestFunctionParams extends ExportEncDataRequest {
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