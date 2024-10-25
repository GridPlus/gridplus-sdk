import { Client } from '../client';

export interface ConnectRequestParams {
  id: string;
}

export interface ConnectRequestFunctionParams extends ConnectRequestParams {
  client: Client;
}
