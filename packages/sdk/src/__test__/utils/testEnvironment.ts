import * as dotenv from 'dotenv'

dotenv.config()

expect.extend({
  toEqualElseLog(received: unknown, expected: unknown, message?: string) {
    return {
      pass: received === expected,
      message: () =>
        message ?? `Expected ${String(received)} to equal ${String(expected)}`,
    }
  },
})
