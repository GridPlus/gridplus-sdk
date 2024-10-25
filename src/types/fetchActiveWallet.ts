import { Client } from '../client';

export interface FetchActiveWalletRequestFunctionParams {
  client: Client;
}

export interface ValidatedFetchActiveWalletRequest {
  sharedSecret: Buffer;
}
