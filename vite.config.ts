import { defineConfig } from 'vitest/config';

export default defineConfig(() => {
  return {
    test: {
      coverage: {
        reporter: ['lcov'],
      },
      update: true, // SHOULD BE FALSE MOST OF THE TIME
      reporters: ['default'],
      globals: true,
      testTimeout: 120000,
      threads: false,
      setupFiles: ['./src/__test__/utils/setup.ts'],
      /** connect.test.ts is excluded because it is still a WIP (https://github.com/GridPlus/gridplus-sdk/issues/420) */
      exclude: ['./src/__test__/integration/connect.test.ts'],
      watchExclude: ['**/*.json'],
    },
  }
});
