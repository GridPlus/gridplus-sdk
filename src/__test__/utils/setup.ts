import fetch, { Request } from 'node-fetch';

import * as dotenv from 'dotenv'
dotenv.config()

if (!globalThis.fetch) {
  // @ts-expect-error - fetch must be patched in a node environment
  globalThis.fetch = fetch
  // @ts-expect-error - Request must be patched in a node environment
  globalThis.Request = Request
}

expect.extend({
  toEqualElseLog (received: any, expected: any, message: string) {
    return {
      pass: received === expected,
      message: () => message ? message : `Expected ${received} to equal ${expected}`,
    };
  },
});