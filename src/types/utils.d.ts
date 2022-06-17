import { Client } from '../client'

interface TestRequestPayload {
  payload: Buffer;
  testID: number;
  client: Client;
}