# Testing


If you have a Lattice1 device that is connected to the internet, you can run the full test suite with:

```bash
npm test
```

If you would like to run tests multiple times, you will need to re-pair with a fresh, random key pair using the above command.
If you instead wish to quickly test non-pairing items, consider the following setup:

```bash
# Pair with a hardcoded, re-usable test key. You only need to do this ONCE!
env REUSE_KEY=1 npm test

# All subsequent tests will use the re-usable key if you specify your device ID
# as an env variable
env DEVICE_ID='my_device_id' npm test
```

> Note: By default, your Lattice will utilize its on-board wallet. If you wish to test against a SafeCard, you will need to insert it and PIN it (i.e. the card needs to be set up). If you reboot your unit, you will need to remove the card and re-insert (and re-authenticate) before testing against it.

### Signing tests

Once you have paired with a device in a re-usable way (i.e. using the commands above ^), you can run more robust tests around signing. If you are testing with a dev Lattice, it is highly recommended that you compile the autosign flag into your firmware (or else you will need to press accept `n` times).

**ETH**

Ethereum tests include both boundary checks on transaction params and randomized test vectors (20 by default). 

*`env` options:*

* `N=<int>` (default=`3`) - number of random vectors to test
* `SEED=<string>` (default=`myrandomseed`) - randomness for the pseudorandom number generator that builds deterministic test vectors

Run the suite with:

```bash
env DEVICE_ID='my_device_id' npm run test-eth
```

If you wish to do more or fewer than 20 random transaction tests, you can specify the `N` param:

**BTC**

Bitcoin tests cover legacy, wrapped segwit, and segwit spending to all address types. Vectors are built deterministically using the seed and all permutations are tested.

*`env` options:*

* `N=<int>` (default=`3`) - number of inputs per test. Note that if you choose e.g. `N=2` each test will first test one input, then will test two. Must be >0 and <11.
* `SEED=<string>` (default=`myrandomseed`) - randomness for the pseudorandom number generator that builds deterministic test vectors
* `TESTNET=<any>` (default=`false`) - if set to any value you will test all combinations for both mainnet and testnet transactions (doubles number of tests run)

Run the tests with:

```bash
env DEVICE_ID='my_device_id' npm run test-btc
```

### Ethereum ABI Tests

You may test functionality around loading Ethereum ABI definitions and displaying calldata in a markdwon screen with the following script:

```bash
env DEVICE_ID='my_device_id' N=<numRandomTests> npm run test-eth-abi
```

> Note that this test uses a random seed to generate data. You may include a `SEED=<mySeed>` if you want to use your own.

### Test Harness

We can test debug firmware builds using the `client.test` function in the SDK. This utilizes the firmware's test harness with an encrypted route. You can run these tests with the same `env DEVICE_ID='my_device_id` flag as some of the other tests.

> NOTE: Since these are encrypted routes, you need to be paired with your Lattice before you can run them (using `env REUSE_KEY=1 npm test` as before -- you still only need to do this once).

**Wallet Jobs**

Lattice firmware uses "wallet jobs" to interact with the SafeCard/Lattice wallet directly. The SDK does not have access to these methods in production builds, but for debug builds the test harness can be used to interact with them.

```bash
env DEVICE_ID='my_device_id' npm run test-wallet-jobs
```

