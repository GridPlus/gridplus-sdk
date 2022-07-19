import * as path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Loads .env file into process.env based on mode (NODE_ENV)
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    build: {
      lib: {
        entry: path.resolve(__dirname, 'src/index.ts'),
        name: 'gridplus-sdk',
        fileName: (format) => `gridplus-sdk.${format}.js`,
      },
      rollupOptions: {
        external: [],
        output: {
          globals: {},
        },
      },
    },
    test: {
      coverage: {
        reporter: ['lcov'],
      },
      update: false,
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
