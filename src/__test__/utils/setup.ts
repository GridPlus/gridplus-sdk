import * as dotenv from 'dotenv'
dotenv.config()

expect.extend({
  toEqualElseLog (received: any, expected: any, message: string) {
    return {
      pass: received === expected,
      message: () => message ? message : `Expected ${received} to equal ${expected}`,
    };
  },
});