import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

const restrictedNodeImports = [
  { name: 'crypto', message: 'Use node:crypto instead.' },
  { name: 'fs', message: 'Use node:fs instead.' },
  { name: 'os', message: 'Use node:os instead.' },
  { name: 'path', message: 'Use node:path instead.' },
  { name: 'stream', message: 'Use node:stream instead.' },
  { name: 'url', message: 'Use node:url instead.' },
  { name: 'util', message: 'Use node:util instead.' },
];

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        Buffer: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        RequestInit: 'readonly',
        AbortController: 'readonly',
        caches: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        // Test globals
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        // Node.js globals
        process: 'readonly',
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...prettierPlugin.configs.recommended.rules,
      'prettier/prettier': 'error',
      eqeqeq: ['error'],
      'no-var': ['warn'],
      'no-duplicate-imports': ['error'],
      'prefer-const': ['error'],
      'prefer-spread': ['error'],
      'no-console': ['off'],
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      quotes: [
        'warn',
        'single',
        { avoidEscape: true, allowTemplateLiterals: true },
      ],
      'no-restricted-imports': ['error', { paths: restrictedNodeImports }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='require']",
          message: 'Use ESM imports instead of require.',
        },
        {
          selector:
            "AssignmentExpression[left.object.name='module'][left.property.name='exports']",
          message: 'Use ESM exports instead of module.exports.',
        },
      ],
    },
  },
  prettierConfig,
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.js',
      '*.cjs',
      '*.mjs',
      'build/**',
      'docs/**',
      'patches/**',
      'src/__test__/e2e/**',
      'src/__test__/integration/**',
      'src/__test__/utils/**',
    ],
  },
];
