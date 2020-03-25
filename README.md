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

```
npm test
```

If you would like to run tests multiple times, you will need to re-pair with a fresh, random key pair using the above command.
If you instead wish to quickly test non-pairing items, consider the following setup:

```
// Pair with a hardcoded, re-usable test key. You only need to do this ONCE!
env REUSE_KEY=1 npm test

// All subsequent tests will use the re-usable key if you specify your device ID
// as an env variable
env DEVICE_ID='my_device_id' npm test
```

> Note: By default, your Lattice will utilize its on-board wallet. If you wish to test against a SafeCard, you will need to insert it and PIN it (i.e. the card needs to be set up). If you reboot your unit, you will need to remove the card and re-insert (and re-authenticate) before testing against it.