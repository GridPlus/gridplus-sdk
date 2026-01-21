import { writeFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const esmWrapper = `// ESM wrapper - loads the CJS bundle
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cjs = require('./index.cjs');
export const Calldata = cjs.Calldata;
export const Client = cjs.Client;
export const Constants = cjs.Constants;
export const Utils = cjs.Utils;
export * from './index.cjs';
export default cjs;
`;

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: './dist',
  format: ['cjs'],
  target: 'node20',
  platform: 'node',
  sourcemap: true,
  clean: true,
  bundle: true,
  dts: true,
  silent: true,
  noExternal: [/.*/],
  tsconfig: './tsconfig.build.json',
  onSuccess: async () => {
    writeFileSync('./dist/index.mjs', esmWrapper);
    console.log('Generated ESM wrapper: dist/index.mjs');
  },
});
