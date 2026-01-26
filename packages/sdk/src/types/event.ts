import type { Client } from '../client';

export interface SendEventParams {
  eventType: number;
  eventId: string;
  message: string;
}

export interface SendEventRequestFunctionParams extends SendEventParams {
  client: Client;
}

export interface SendEventResponse {
  status: number;
}
