# GridPlus Lattice1 SDK

The GridPlus SDK lets any application establish a connection and interact with a GridPlus Lattice1 device as a remote signer. With the Lattice1 as an extremely secure, connected keystore with signing capabilities, this SDK gives users the following functionality:

* **Connect** to a Lattice1 device over the internet
* **Pair** with a Lattice1 by exchanging keys and deriving a secret using an out-of-band secret displayed on the Lattice1. A pairing acts as a mechanism through which to derive shared encryption secrets for future requests.
* Get **addresses** from the paired device (Bitcoin or Ethereum)
* Request **signatures** on ETH or BTC transactions, which the Lattice1 owner must authorize on the device

## [Documentation](https://gridplus-sdk.readthedocs.io)

The documentation for this SDK can be found [here](https://gridplus-sdk.readthedocs.io). There you will find a complete quickstart guide and API docs for the above functionality.

## Testing

If you have a Lattice1 device that is connected to the internet, you can run the full test suite with:

```sh
npm test
```

If you would like to run tests multiple times, you will need to re-pair with a fresh, random key pair using the above command.
If you instead wish to quickly test non-pairing items, consider the following setup:

```sh
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

Ethereum tests include both boundary checks on transaction params and randomized test vectors (20 by default). You can run the suite with:

```sh
env DEVICE_ID='my_device_id' npm run test-eth
```

If you wish to do more or fewer than 20 random transaction tests, you can specify the `N` param:

```sh
env DEVICE_ID='my_device_id' N=25 npm run test-eth
```


**BTC**

Bitcoin tests cover legacy and segwit spends on both mainnet and testnet. They are completely randomized and when you run them, the following happens:

1. Build a wallet using a mnemonic. There is a default mnemonic matching other GridPlus tests, but you can pass your own in with the `env` param `MNEMONIC`. This mnemonic **must** match the wallet on your Lattice or none of these tests will work.
2. Build a bunch of randomized inputs. The number defaults to 10, but you can define a number with the `env` param `N`.
3. Use `bitcoinjs-lib` to generate a series of sighashes corresponding to the inputs. These first need to be signed with the respective keys, which can be derived using the wallet from step 1.
4. Build the Lattice request with the same inputs. You will get `N` signatures back from the Lattice (in addition to a fully broadcastable transaction payload, which we do not use in these tests). Note that `N` must be <11, as the Lattice will only sign up to 10 inputs together.
5. With the `bitcoinjs-lib` sighashes, the derived keys from the wallet, and now signatures from the Lattice, we validate the signatures against the sighashes. If the validation passes, it means we built the correct sighash in the Lattice and signed it with the correct derived key.

Run the tests with:

```sh
env DEVICE_ID='my_device_id' npm run test-btc
```

If you want to specify the above params:

```sh
env DEVICE_ID='my_device_id' N=5 MNEMONIC='negative spare peasant raw feature camera glide notice fee gown heavy depart' npm run test-btc
```

### Ethereum ABI Tests

You may test functionality around loading Ethereum ABI definitions and displaying calldata in a markdwon screen with the following script:

```sh
env DEVICE_ID='my_device_id' N=<numRandomTests> npm run test-eth-abi
```

> Note that this test uses a random seed to generate data. You may include a `SEED=<mySeed>` if you want to use your own.

### Test Harness

We can test debug firmware builds using the `client.test` function in the SDK. This utilizes the firmware's test harness with an encrypted route. You can run these tests with the same `env DEVICE_ID='my_device_id` flag as some of the other tests.

> NOTE: Since these are encrypted routes, you need to be paired with your Lattice before you can run them (using `env REUSE_KEY=1 npm test` as before -- you still only need to do this once).

**Wallet Jobs**

Lattice firmware uses "wallet jobs" to interact with the SafeCard/Lattice wallet directly. The SDK does not have access to these methods in production builds, but for debug builds the test harness can be used to interact with them.

```sh
env DEVICE_ID='my_device_id' npm run test-wallet-jobs
```
