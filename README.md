# GridPlus Lattice1 SDK

**WARNING: This is early alpha software and is subject to change. It is recommended that any mainnet usage be restricted to small amounts.**

The Grid+ SDK allows any application to establish a connection and interact with a Grid+ Lattice1 device as a remote signer. With the Lattice1 as an extremely secure, connected keystore with signing capabilities, this SDK gives users the following functionality:

* **Pair** (exchange keys and establish encrypted communication channel) with a user's Lattice1 device using a serial
* Get **addresses** from the paired device (Bitcoin or Ethereum)
* Request ETH, ERC20, and BTC **signatures**, which the Lattice1 owner must authorize on the device
* Create a **permission** giving your app the ability to request automated signatures based on rules accepted by the user
* Request **automated signatures** against a permission

## [Documentation](https://gridplus-sdk.readthedocs.io)

The documentation for this SDK can be found [here](https://gridplus-sdk.readthedocs.io). There you will find a complete quickstart guide (a shorter version of which is available in the next section) as well as a full API reference and schema enumerations. Please consider that document the source of truth for all things SDK.

## Installation and Setup

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

### Instantiate a Client

Once imported, you can instantiate your SDK client with a `clientConfig` object, which at minimum requires the name of your app (`name`) and a private key with which to sign requests (`privKey`). The latter is not meant to e.g. hold onto any cryptocurrencies; it is simply a way of maintaining a secure communication channel between the device and your application.

```
const clientConfig = {
    baseUrl: 'http://192.168.18.92'
    name: 'MyApp',
    privKey: crypto.randomBytes(32).toString('hex')
}
```

#### Adding Providers

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
    coin: 'btc',
});

clientConfig.providers = [ eth, btc ];
```

#### Instantiate

With the `clientConfig` filled out, you can instantiate a new SDK client object:

```
const client = new Client(clientConfig);
```


## Running Tests

You can run the tests in this repo, but you need to ensure you have proper configuration. You should create a file called `secrets.json` in the root of this repo, which should be of the following form:

```
{
  "ethHolder": {
    "address": <ETH address>,
    "privKey": <32 byte hex string>
  },
  "btcHolder": {
    "address": <BTC recipient regtest address>,
    "wif": <BTC recipient regtest wif>,
    "regtestAddress": <BTC sender regtest address>,
    "regtestWif": <BTC sender regtest wif>,
    "bcyAddress": <BTC sender blockcypher testnet address>,
    "bcyWif": <BTC sender blockcypher testnet address>
  },
  "etherscanApiKey": <key>,
  "blockcypherApiKey": <key>,
  "baseUrl": <URL of host>,
  "ethNode": {
    "host": "localhost",
    "port": 7545
  },
  "btcNode": {
      "host": "localhost",
      "port": 48332,
      "network": "regtest"
  }
}
```

Note that only `baseUrl` is needed to run basic tests with:

```
npm run test:lattice
```

which should be enough to validate all of the signing endpoints. The other fields are needed for currency-specific tests.

**Testing with Ethereum**

You can test with a local Ethereum provider such as [Ganache](https://truffleframework.com/ganache) by utilizing the `ethNode` and `ethHolder` objects in your `secrets.json` file and running

```
npm run test:local-eth
```

You can also run a test on the [Rinkeby](https://rinkeby.io) test network using the `etherscanApiKey` param (i.e. your API key for [Etherscan](https://etherscan.io)) and running:

```
npm run test:rinkeby
```

**Testing with Bitcoin**

To run Bitcoin-based tests, you should have a local [bcoin](https://bcoin.io/) client running, preferably in `regtest` mode, and run:

```
npm run test:local-btc
```

You can also run a test using the [Blockcypher](https://blockcypher.com) testnet (BCY), which runs much faster than testnet3. You will need to utilize the `blockcypherApiKey` param in `secrets.json` and run:

```
npm run test:bcy
```

## Bug Testing and Contributing

We welcome UX-related pull requests and any feedback from Lattice1 developers. To learn more about the Lattice1, please visit our [website](https://gridplus.io/technology).
