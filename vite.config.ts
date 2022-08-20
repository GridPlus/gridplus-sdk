import * as path from 'path';
import { defineConfig, loadEnv } from 'vite';
import dts from 'vite-plugin-dts'
import Web3Polyfill from 'vite-plugin-web3-polyfill'

export default defineConfig(({ mode }) => {
  // Loads .env file into process.env based on mode (NODE_ENV)
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    build: {
      lib: {
        entry: path.resolve(__dirname, 'src/index.ts'),
        name: 'gridplus-sdk',
        fileName: (format) => `gridplus-sdk.${format}.js`,
        formats: ["cjs", "umd", "es"],
      },
      commonjsOptions: {
        ignoreDynamicRequires: true,
        dynamicRequireTargets: [
          "node_modules/ethereum-cryptography"
        ]
      },
      rollupOptions: {
        external: [],
        output: {
          globals: {},
        },
      },
      minify: false
    },
    optimizeDeps: {
      exclude: ['ethereum-cryptography']
    },
    plugins: [
      dts(),
      Web3Polyfill() as any
    ],
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
