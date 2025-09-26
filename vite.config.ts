import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,mjs,ts,mts,jsx,tsx}'],
    /** connect.test.ts is excluded because it is still a WIP (https://github.com/GridPlus/gridplus-sdk/issues/420) */
    exclude: ['./src/__test__/integration/connect.test.ts', './forge'],
    testTimeout: 120000,
    maxConcurrency: 1,
    fileParallelism: false,
    setupFiles: ['./src/__test__/utils/testEnvironment.ts'],
    coverage: {
      provider: 'istanbul',
      reporter: ['lcov'],
    },
  },
});
