import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'GridPlusSDK',
      fileName: (format) => `gridplus-sdk.${format}.js`,
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: [
        '@ethereumjs/common',
        '@ethereumjs/rlp',
        '@ethereumjs/tx',
        '@ethersproject/abi',
        '@metamask/eth-sig-util',
        'bn.js',
      ],
      output: {
        globals: {
          '@ethereumjs/common': 'EthereumjsCommon',
          '@ethereumjs/rlp': 'EthereumjsRlp',
          '@ethereumjs/tx': 'EthereumjsTx',
          '@ethersproject/abi': 'EthersprojectAbi',
          '@metamask/eth-sig-util': 'MetamaskEthSigUtil',
          'bn.js': 'BN',
        },
      },
    },
    sourcemap: true,
    minify: false,
  },
  plugins: [dts()],
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    /** connect.test.ts is excluded because it is still a WIP (https://github.com/GridPlus/gridplus-sdk/issues/420) */
    exclude: ['./src/__test__/integration/connect.test.ts', './forge'],
    testTimeout: 120000,
    maxConcurrency: 1,
    fileParallelism: false,
    setupFiles: ['./src/__test__/utils/setup.ts'],
    coverage: {
      provider: 'istanbul', // or 'v8'
      reporter: ['lcov'],
    },
  },
});
