---
id: 'testing'
---

# Testing

All SDK functionality is covered by a comprehensive suite of unit and integration tests. To run these tests, you will need a development-mode Lattice, as some tests require loading a known seed.

:::info

Many tests require a development Lattice, which GridPlus does not distribute publicly. Unit tests can be run without a device, but integration and end-to-end tests require a connected Lattice.

:::

## Setting Up the Local Test Environment

The test suite now uses **Foundry** and **Anvil** for local EVM testing, which is required for features like EIP-7702.

### 1. Initial Setup

First, ensure you have a `.env` file in the project root with your `DEVICE_ID`. You can copy from `.env.example`.

Then, run the setup script. This will install Foundry, all dependencies, and start a local Anvil node:

```bash
# This needs to be run once before starting a testing session.
# It will keep running and output Anvil logs to your terminal.
npm run setup:anvil
```

### 2. Pairing Your Device

If this is your first time running tests, you must pair the SDK with your Lattice:

```bash
# Option 1: Use the dedicated pairing script
npm run pair-device

# Option 2: Run the test suite (will prompt for pairing if needed)
npm run test
```

Once paired, the connection info is saved in `client.temp`, and you won't need to pair again unless you delete this file.

### 3. Running Tests

With the setup script running in one terminal, you can run tests in another terminal:

```bash
# Run all tests
npm run test

# Run only unit tests (no device required)
npm run test-unit

# Run specific test suites
npm run e2e-eth       # Ethereum message signing
npm run e2e-eip7702   # EIP-7702 authorization signing
npm run e2e-sign      # All signing tests
```

### 4. Cleanup

When finished testing, stop the setup script (`Ctrl+C`) and run cleanup:

```bash
npm run cleanup:anvil
```

## Environment Variables

The following environment variables can be configured in your `.env` file:

| Variable        | Description                                 | Default                     |
| :-------------- | :------------------------------------------ | :-------------------------- |
| `DEVICE_ID`     | Your Lattice device ID (6 characters)       | Required                    |
| `PASSWORD`      | Device password for pairing                 | "password"                  |
| `APP_NAME`      | Name shown on device during pairing         | "SDK Test"                  |
| `ENC_PW`        | Device-level password for encrypted exports | None                        |
| `ETHERSCAN_KEY` | API key for ABI fetching tests              | None                        |
| `baseUrl`       | Message routing URL                         | "https://signing.gridpl.us" |

## Setting up the `.env` file

Alternatively, you may input `env` options into a `.env` file to make it easier to run scripts. To create your `.env` file, follow these steps:

1. Copy the `.env.template` file.
2. Rename the `.env.template` file to `.env`.
3. Update the desired params in that file, probably your `DEVICE_ID`.

## Firmware Test Runner

Several tests require dev Lattice firmware with the following flag in the root `CMakeLists.txt`:

```ts
FEATURE_TEST_RUNNER = 1;
```

See table in the next section.

## Reference: Tests and Options

You can run the following tests with `npm run <test name>`.

| Test                   | Description                                                                                            | Requires `FEATURE_TEST_RUNNER=1` |
| :--------------------- | :----------------------------------------------------------------------------------------------------- | :------------------------------- |
| `test`                 | Runs integration tests. Does not use Lattice.                                                          | No                               |
| `test-unit`            | Runs SDK unit tests. Does not use Lattice.                                                             | No                               |
| `e2e`                  | Runs all end-to-end tests.                                                                             | Yes                              |
| `e2e-btc`              | Tests BTC signatures (legacy signing)                                                                  | Yes                              |
| `e2e-eth`              | Tests EIP712 and `personal_sign` messages (legacy signing)                                             | No                               |
| `e2e-eip7702`          | Tests EIP-7702 authorization signing                                                                   | Yes                              |
| `e2e-gen`              | Tests seveal Lattice message routes and some SDK functionality. Bit of a legacy test but still useful. | No                               |
| `e2e-kv`               | Tests KV-files, which are used primarily for tags.                                                     | No                               |
| `e2e-ne`               | Tests non-exportable seeded SafeCards (legacy).                                                        | No                               |
| `e2e-sign`             | Runs all signing tests.                                                                                | Yes                              |
| `e2e-sign-bls`         | Tests BLS signatures and key derivations.                                                              | Yes                              |
| `e2e-sign-determinism` | Tests determinism of signatures using known seed loading.                                              | Yes                              |
| `e2e-sign-evm-abi`     | Tests ABI decoding and fetching for EVM transactions.                                                  | Yes                              |
| `e2e-sign-evm-tx`      | Tests EVM transaction types.                                                                           | Yes                              |
| `e2e-sign-solana`      | Tests Solana transactions and address derivation.                                                      | Yes                              |
| `e2e-sign-unformatted` | Tests signing unformatted payloads (ASCII or hex strings).                                             | Yes                              |
| `e2e-wj`               | Tests wallet jobs, validating path derivations, seed management, etc.                                  | Yes                              |
| `contracts`            | Tests smart contract interactions on local Anvil network                                               | Yes                              |
