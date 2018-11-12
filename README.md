# gridplus-sdk

**WARNING: This is early alpha software and is subject to change. It is recommended that any mainnet usage be restricted to small amounts.**

The Grid+ SDK allows any application to establish a connection and interact with a Grid+ Lattice device as a remote signer. With the Lattice1 as an extremely secure, connected keystore with signing capabilities, this SDK gives users the following functionality:

* **Pair** (exchange keys and establish encrypted communication channel) with a user's Lattice1 device using a serial
* Get **addresses** from the paired device (Bitcoin or Ethereum)
* Request ETH, ERC20, and BTC **signatures**, which the Lattice1 owner must authorize on the device
* Create a **permission** giving your app the ability to request automated signatures based on rules accepted by the user
* Request **automated signatures** against a permission

## Documentation

The documentation for this SDK can be found at [gridplus-sdk.readthedocs.io](gridplus-sdk.readthedocs.io). There you will find a complete quickstart guide (a shorter version of which is available in the next section) as well as a full API reference and schema enumerations. Please consider that document the source of truth for all things SDK.

# Installation and Setup

This SDK is currently only available as a `node.js` module. You can add it to your project with:

```
npm install gridplus-sdk
```

You can then import a new client with:

```
import { Client } from 'gridplus-sdk';
```

or, for older style syntax:

```
const Sdk = require('gridplus-sdk').Client;
```

## Initializing a Client

Once imported, you can initialize your SDK client with a `clientConfig` object, which at minimum requires the name of your app (`name`) and a private key with which to sign requests (`privKey`). The latter is not meant to e.g. hold onto any cryptocurrencies; it is simply a way of maintaining a secure communication channel between the device and your application.

```
const clientConfig = {
    name: 'MyApp',
    privKey: crypto.randomBytes(32).toString('hex')
}
```

### Adding Providers

To connect the SDK to supported cryptocurrency networks, you will need to add *providers* to the `clientConfig`. We have two from which to choose:

```
import { providers } from `gridplus-sdk`;
const eth = new providers.Ethereum({ 
    network: 'rinkeby' 
    etherscan: true, 
});
const btc = new providers.Bitcoin({
    network: 'test3',
    blockcypher: true,
    coin: 'btc'
});

clientConfig.providers = [ eth, btc ];
```

To see the full list of configuration options for these providers (and how to add your own), please see the [Providers](#Providers) section.


### Adding Crypto Module [Optional]

By default, this client will use the build in `node.js` [`crypto`](https://nodejs.org/api/crypto.html) module. If you are using React Native, you may want to add another option to the `clientConfig` which specifies a limited "crypto library". We have an [example library](https://github.com/GridPlus/gridplus-react-native-crypto), which you are free to use:

```
import ReactNativeCrypto from 'gridplus-react-native-crypto';
const cryptoLib = new ReactNativeCrypto(clientConfig.privKey);
clientConfig.crypto = cryptoLib;
```

### Initialize!

With the `clientConfig` filled out, you can initialize a new SDK object:

```
const client = new Client({ clientConfig: clientConfig });
client.initialize((err, connections) => { })
```

# Bug Testing and Contributing

We welcome UX-related pull requests and any feedback from Lattice1 developers. To learn more about the Lattice1, please visit our [website](https://gridplus.io/technology).