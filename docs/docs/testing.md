---
id: "testing"
---

# Testing

All functionality is tested in some script in `/test`. Please see those scripts for examples on functionality not documented.

:::info

Testing is only possible with a development Lattice, which GridPlus does not distribute publicly. Therefore, if you do not have a development Lattice, you will not be able to run many of these tests.**

:::

## Setting up a test connection

Only one test can be run against an unpaired Lattice: `npm run test`. Therefore this must be run before running any other tests. If you wish to run additional tests, you need to specify the following:

```ts
env REUSE_KEY=1 npm run test
```

The `REUSE_KEY` will save the connection locally so you can run future tests. Running this test will ask for your device ID and will go through the pairing process. After pairing, the rest of the script will test a broad range of SDK functionality.

To use the connection you've established with any test (including this initial one), you need to include your `DEVICE_ID` as an env argument:

```ts
env DEVICE_ID='mydeviceid' npm run test
```

## Global `env` Options

The following options can be used after `env` with any test.

| Param | Options | Description |
|:------|:--------|:------------|
| `REUSE_KEY` | Must be `1` | Indicates we will be creating a new pairing with a Lattice and stashing that connection |
| `DEVICE_ID` | A six character string | The device ID of the target Lattice. |
| `ENC_PW` | Device-level password set by the user, used when exporting encrypted data. |
| `ETHERSCAN_KEY` | Any string | API key for making requests to Etherscan. This is needed specifically for `e2e-sign-evm-abi`. |
| `name` | Any 5-25 character string (default="SDK Test") | The name of the pairing you will create |
| `baseUrl` | Any URL (default="https://signing.gridpl.us") | URL describing where to send HTTP requests. Should be changed if your Lattice is on non-default message routing infrastructure. |

## Setting up the `.env` file

Alternatively, you may input `env` options into a `.env` file to make it easier to run scripts. To create your `.env` file, follow these steps:
1. Copy the `.env.template` file.
2. Rename the `.env.template` file to `.env`.
3. Update the desired params in that file, probably your `DEVICE_ID`.

## Firmware Test Runner

Several tests require dev Lattice firmware with the following flag in the root `CMakeLists.txt`:

```ts
FEATURE_TEST_RUNNER=1
```

See table in the next section.

## Reference: Tests and Options

You can run the following tests with `npm run <test name>`.

| Test | Description | Requires `FEATURE_TEST_RUNNER=1` |
|:-----|:------------|:-----------------|
| `test` | Runs integration tests. Does not use Lattice. | No |
| `test-unit` | Runs SDK unit tests. Does not use Lattice. | No |
| `e2e` | Runs all end-to-end tests. | Yes |
| `e2e-btc` | Tests BTC signatures (legacy signing) | Yes |
| `e2e-eth` | Tests EIP712 and `personal_sign` messages (legacy signing) | No |
| `e2e-gen` | Tests seveal Lattice message routes and some SDK functionality. Bit of a legacy test but still useful. | No |
| `e2e-kv` | Tests KV-files, which are used primarily for tags. | No |
| `e2e-ne` | Tests non-exportable seeded SafeCards (legacy). | No |
| `e2e-sign` | Runs all signing tests. | Yes |
| `e2e-sign-bls` | Tests BLS signatures and key derivations. | Yes |
| `e2e-sign-determinism` | Tests determinism of signatures using known seed loading. | Yes |
| `e2e-sign-evm-abi` | Tests ABI decoding and fetching for EVM transactions. | Yes |
| `e2e-sign-evm-tx` | Tests EVM transaction types. | Yes |
| `e2e-sign-solana` | Tests Solana transactions and address derivation. | Yes |
| `e2e-sign-unformatted` | Tests signing unformatted payloads (ASCII or hex strings). | Yes |
| `e2e-wj` | Tests wallet jobs, validating path derivations, seed management, etc. | Yes |