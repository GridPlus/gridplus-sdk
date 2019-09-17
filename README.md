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