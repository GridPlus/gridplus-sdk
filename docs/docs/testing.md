
# 🧪 Testing

All functionality is tested in some script in `/test`. Please see those scripts for examples on functionality not documented.

:::caution

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
| `DEVICE_ID` | A six character string | The device ID of the target Lattice |
| `name` | Any 5-25 character string (default="SDK Test") | The name of the pairing you will create |
| `baseUrl` | Any URL (default="https://signing.gridplus.io") | URL describing where to send HTTP requests. Should be changed if your Lattice is on non-default message routing infrastructure. |

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

This section gives an overview of each test and which options can be passed for the specific test (in addition to global options)

| Test | Description | Uses Test Runner | Additional `env` Options |
|:-----|:------------|:-----------------|:--------------|
| `npm run test` | Sets up test connection and tests basic functionality like `getAddresses` and `sign`. You need to run this with `REUSE_KEY=1` and pair before running any other tests. | No | N/A |
| `npm run test-signing` | Tests various aspects of the message signing path as well as all known decoders. | Yes | `SEED` (random string to seed a random number generator)<br/>`ETHERSCAN_KEY` (API key for making Etherscan requests. Used in EVM tests.) |
| `npm run test-btc` | *(Legacy pathway)* Tests spending different types of BTC inputs. Signatures validated against `bitcoinjs-lib` using seed exported by test harness. | Yes | `N` (number of random vectors to populate)<br/>`SEED` (random string to seed a random number generator)<br/>`testnet` (if true, testnet addresses and transactions will also be tested) |
| `npm run test-eth-msg` | *(Legacy pathway)* Tests Ethereum message requests `signPersonal` and `signTypedData`. Tests boundary conditions of EIP712 messages. | No | `N` (number of random vectors to populate)<br/>`SEED` (random string to seed a random number generator) |
| `npm run test-kv` | Tests loading and using kv (key-value) files. These are used for address tags. | No | N/A |
| `npm run test-non-exportable` | Tests to validate signatures from a SafeCards with a non-exportable seed (legacy) | No | N/A |
| `npm run test-wallet-jobs` | Tests exported addresses and public keys against those from reference libraries using seed exported by test harness. | Yes | N/A |
