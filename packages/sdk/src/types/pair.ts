import type { Client } from '../client';

export interface PairRequestParams {
  pairingSecret: string;
  client: Client;
}
