import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '../../..');
const cjsOutput = path.resolve(packageRoot, 'dist/index.cjs');
const esmOutput = path.resolve(packageRoot, 'dist/index.mjs');
const packageName = 'gridplus-sdk';

let built = false;
let fixtureDir: string | undefined;

const ensureBuildArtifacts = () => {
  if (built) {
    return;
  }
  console.log('Building package with pnpm run build ...');
  execSync('pnpm run build', {
    cwd: packageRoot,
    stdio: 'inherit',
  });
  if (!existsSync(cjsOutput) || !existsSync(esmOutput)) {
    throw new Error('Expected dual build outputs were not generated');
  }
  built = true;
};

const ensureLinkedFixture = () => {
  if (fixtureDir) {
    return fixtureDir;
  }
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'gridplus-sdk-interop-'));
  const nodeModulesDir = path.join(tmpDir, 'node_modules');
  mkdirSync(nodeModulesDir, { recursive: true });
  const linkTarget = path.join(nodeModulesDir, packageName);
  symlinkSync(packageRoot, linkTarget, 'junction');
  fixtureDir = tmpDir;
  return fixtureDir;
};

const runNodeCheck = (args: string[]) => {
  const cwd = ensureLinkedFixture();
  const result = spawnSync(process.execPath, args, {
    cwd,
    env: { ...process.env },
    encoding: 'utf-8',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Node command failed (${result.status}):\n${result.stderr || result.stdout}`);
  }
};

describe('package module interoperability', () => {
  beforeAll(() => {
    ensureBuildArtifacts();
  });
  afterAll(() => {
    if (fixtureDir) {
      rmSync(fixtureDir, { recursive: true, force: true });
      fixtureDir = undefined;
    }
  });

  it('exposes CommonJS entry via require()', () => {
    const script = `
      const sdk = require('${packageName}');
      if (typeof sdk.connect !== 'function') {
        throw new Error('connect export missing');
      }
      if (typeof sdk.Client !== 'function') {
        throw new Error('Client export missing');
      }
    `;
    runNodeCheck(['-e', script]);
  });

  it('exposes ESM entry via dynamic import()', () => {
    const script = `
      const sdk = await import('${packageName}');
      if (typeof sdk.connect !== 'function') {
        throw new Error('connect export missing');
      }
      if (typeof sdk.Client !== 'function') {
        throw new Error('Client export missing');
      }
    `;
    runNodeCheck(['--input-type=module', '-e', script]);
  });
});
