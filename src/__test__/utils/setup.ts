import fetch, { Request } from 'node-fetch';
import * as fs from 'fs';
import { setup } from '../..';
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

export const setStoredClient = (data: string) => {
  try {
    fs.writeFileSync('./client.temp', data);
  } catch (err) {
    return '';
  }
};

export const getStoredClient = () => {
  try {
    return fs.readFileSync('./client.temp', 'utf8');
  } catch (err) {
    return '';
  }
};

export const setupClient = async () => {
  const deviceId = process.env.DEVICE_ID;
  const password = process.env.PASSWORD || 'password';
  const name = process.env.name || 'api-test';
  return setup({
    deviceId,
    password,
    name,
    getStoredClient,
    setStoredClient,
  });
};
