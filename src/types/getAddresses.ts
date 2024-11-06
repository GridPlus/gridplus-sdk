import { Client } from '../client';

export interface GetAddressesRequestParams {
  startPath: number[];
  n: number;
  flag?: number;
  iterIdx?: number;
}

export interface GetAddressesRequestFunctionParams
  extends GetAddressesRequestParams {
  client: Client;
}
