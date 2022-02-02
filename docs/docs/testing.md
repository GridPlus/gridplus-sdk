# Testing

If you have a Lattice1 device that is connected to the internet, you can run the full test suite with:

```bash
npm test
```

By default, running tests this way will pair with your Lattice device each time you run the tests. 

If you aren't testing the pairing process, you can reuse the pairing key for each test by passing an
environment variable, `REUSE_KEY`, when pairing like this:

```bash
env REUSE_KEY=1 npm test
```

All subsequent tests will re-use the key if you specify your device ID as an environment variable like this: 

```bash
env DEVICE_ID='my_device_id' npm test
```

> **Note**: By default, your Lattice will utilize its on-board wallet. If you wish to test against a SafeCard, you will need to insert it and PIN it (i.e. the card needs to be set up). If you reboot your unit, you will need to remove the card and re-insert (and re-authenticate) before testing against it.

## Signing

Once you have paired with a device in a re-usable way (i.e. setting `REUSE_KEY=1` as above), you can run more robust tests around signing. 

> **Note**: If you are testing with a dev Lattice, it is highly recommended that you compile the
> autosign flag into your firmware (or else you will need to press accept `n` times).

## Test Suites

There are a series of test suites that can be used to validate the SDK's behavior. Each can be run independently using the commands as described below. 

### Test Suite Options 

Some test suites allow for additional options that allow for more versatile testing configurations. These options are passed in as environment variables like this: 

```bash
env DEVICE_ID='my_device_id' N=25 npm test
```

See the options area for each test suite for which options are usable with that suite.

- #### `N`
  - `default=3`
  - number of inputs per test. Note that if you choose e.g. `N=2` each test will first test one input, then will test two. Must be >0 and <11.
- #### `SEED` 
  - `default="myrandomseed"` 
  - randomness for the pseudorandom number generator that builds deterministic test vectors
- #### `TESTNET` 
  - `default=false` 
  - if set to any value you will test all combinations for both mainnet and testnet transactions (doubles number of tests run)


### Ethereum

Ethereum tests include both boundary checks on transaction params and randomized test vectors (20 by
default). 

Run the suite with:

```bash
env DEVICE_ID='my_device_id' npm run test-eth
```

#### Options

- [`N`](#n)
- [`SEED`](#seed)

### Ethereum Messages

You may test Ethereum messages sent to the Lattice with the following script:

```bash
env DEVICE_ID='my_device_id' npm run test-eth-msg
```

#### Options

- [`N`](#n)
- [`SEED`](#seed)

### Ethereum ABI

You may test functionality around loading Ethereum ABI definitions and displaying calldata in a markdown screen with the following script:

```bash
env DEVICE_ID='my_device_id' npm run test-eth-abi
```

#### Options

- [`SEED`](#seed)

## Dev Lattice Tests

The following tests *require* a development Lattice to complete successfully.

### Bitcoin

Bitcoin tests cover legacy, wrapped segwit, and segwit spending to all address types. Vectors are built deterministically using the seed and all permutations are tested.

```bash
env DEVICE_ID='my_device_id' npm run test-btc
```

#### Options

- [`N`](#n)
- [`SEED`](#seed)
- [`TESTNET`](#testnet)


### Wallet Jobs

Lattice firmware uses "wallet jobs" to interact with the SafeCard/Lattice wallet directly. The SDK does not have access to these methods in production builds, but for debug builds the test harness can be used to interact with them.

```bash
env DEVICE_ID='my_device_id' npm run test-wallet-jobs
```

### Signatures

Tests signing with and without SafeCards.

```bash
env DEVICE_ID='my_device_id' npm run test-sigs
```

#### Options

- [`N`](#n)
- [`SEED`](#seed)

## Test Harness

We can test debug firmware builds using the `client.test` function in the SDK. This utilizes the firmware's test harness with an encrypted route. You can run these tests with the same `env DEVICE_ID='my_device_id` flag as some of the other tests.

> NOTE: Since these are encrypted routes, you need to be paired with your Lattice before you can run them (using `env REUSE_KEY=1 npm test` as before -- you still only need to do this once).
