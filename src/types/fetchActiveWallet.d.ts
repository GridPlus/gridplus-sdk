interface FetchActiveWalletRequestFunctionParams {
  client: Client;
}

interface ValidateFetchActiveWalletRequestParams {
  url?: string;
  ephemeralPub?: Buffer;
  sharedSecret?: Buffer;
}

interface ValidatedFetchActiveWalletRequest {
  sharedSecret: Buffer;
}
