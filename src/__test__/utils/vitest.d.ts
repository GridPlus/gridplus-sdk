/// <reference types="vitest" />

interface CustomMatchers<R = unknown> {
  toEqualElseLog(expected: unknown, message?: string): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
} 