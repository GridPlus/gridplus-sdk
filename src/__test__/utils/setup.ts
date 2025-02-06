import fetch, { Request } from 'node-fetch';
import * as fs from 'fs';
import { question } from 'readline-sync';
import { getClient, pair, setup } from '../..';
import * as dotenv from 'dotenv';
import { expect } from 'vitest';
import { Client } from '../../client';
import { getEnv } from './getters';
import { setupTestClient } from './helpers';

dotenv.config();

if (!globalThis.fetch) {
  // @ts-expect-error - fetch must be patched in a node environment
  globalThis.fetch = fetch;
  // @ts-expect-error - Request must be patched in a node environment
  globalThis.Request = Request;
}

let storedClient: Client | null = null;

export const setStoredClient = (client: Client) => {
  storedClient = client;
};

export const getStoredClient = async () => {
  try {
    return fs.readFileSync('./client.temp', 'utf8');
  } catch (err) {
    return '';
  }
};

export const setupClient = async () => {
  if (storedClient) {
    return storedClient;
  }
  const env = getEnv();
  const client = setupTestClient(env);
  if (env.DEVICE_ID) {
    await client.connect(env.DEVICE_ID);
  }
  return client;
};

// Add custom matchers for vitest
expect.extend({
  toEqualElseLog(received: any, expected: any, message?: string) {
    const pass = this.equals(received, expected);
    if (pass) {
      return {
        message: () => 'Values are equal',
        pass: true,
      };
    } else {
      console.error(message || `Expected ${expected} but received ${received}`);
      return {
        message: () => message || `Expected ${expected} but received ${received}`,
        pass: false,
      };
    }
  },
});
