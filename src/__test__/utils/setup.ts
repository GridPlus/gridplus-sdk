import fetch, { Request } from 'node-fetch';
import * as fs from 'fs';
import { question } from 'readline-sync';
import { getClient, pair, setup } from '../..';
import * as dotenv from 'dotenv';
dotenv.config();

if (!globalThis.fetch) {
  // @ts-expect-error - fetch must be patched in a node environment
  globalThis.fetch = fetch;
  // @ts-expect-error - Request must be patched in a node environment
  globalThis.Request = Request;
}

expect.extend({
  toEqualElseLog(received: any, expected: any, message: string) {
    return {
      pass: received === expected,
      message: () =>
        message ? message : `Expected ${received} to equal ${expected}`,
    };
  },
});

export const setStoredClient = async (data: string) => {
  try {
    fs.writeFileSync('./client.temp', data);
  } catch (err) {
    return;
  }
};

export const getStoredClient = async () => {
  try {
    return fs.readFileSync('./client.temp', 'utf8');
  } catch (err) {
    return '';
  }
};

export const setupClient = async () => {
  const deviceId = process.env.DEVICE_ID;
  const baseUrl = process.env.baseUrl || 'https://signing.gridpl.us';
  const password = process.env.PASSWORD || 'password';
  const name = process.env.APP_NAME || 'SDK Test';
  const pairingSecret = process.env.PAIRING_SECRET || '12345678';
  console.log(`deviceId: ${deviceId}, baseUrl: ${baseUrl}, password: ${password}, name: ${name}`);
  const isPaired = await setup({
    deviceId,
    password,
    name,
    baseUrl,
    getStoredClient,
    setStoredClient,
  });
  if (!isPaired) {
    if (!pairingSecret) {
      throw new Error('PAIRING_SECRET environment variable required for pairing');
    }
    console.log(`Using pairing secret from environment`);
    await pair(pairingSecret.toUpperCase());
  }
  return getClient();
};
