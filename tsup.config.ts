import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf-8'),
);

const external = Object.keys({
  ...(pkg.dependencies ?? {}),
  ...(pkg.peerDependencies ?? {}),
});

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: './dist',
  format: ['esm'],
  target: 'node20',
  sourcemap: true,
  clean: true,
  bundle: true,
  dts: true,
  silent: true,
  outExtension: () => ({
    js: '.mjs',
  }),
  external,
  tsconfig: './tsconfig.build.json',
});
