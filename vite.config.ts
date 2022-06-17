// vite.config.ts
import * as path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
    watchExclude: ['**/*.json'],
  },
});
