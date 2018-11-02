# Grid+ SDK

The Grid+ SDK allows any application to establish a connection and interact with a Grid+ Lattice device. 

# Quickstart

The following tutorial will cover all the steps you need to start using the SDK at a basic level. For documentation on all functionality, please see the [API Reference section](#API-Reference).

## Installation

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
```

## Connecting to a Lattice

Once you have a client initialized, you can make a connection to any Lattice device which is connected to the internet:

```
const serial = 'MY_LATTICE';
client.connect(serial, (err, res) => {
    ...
});
```

If you get a non-error response, it means you can talk to the device. 

## Pairing with a Device

We can now *pair* with a Lattice device, which means establishing a permanent, secure channel between your app and the device. We do this by generating a 6-digit secret, signing it, and sending that signature (plus some other content) to the device. The user then enters the secret you generated into the device (out of band).

*NOTE: The library of possible characters includes digits 0-9 and letters a-f,w,x,y,z (upper and lowercase), making it **base40**. You must generate a 6-digit secret that uses only these characters*

```
const secret = crypto.randomBytes(3).toString('hex');
client.pair(secret, (err) => {
    ...
});
```

If you receive a callback with `err==null`, the pairing has been made successfully.

*NOTE: There is a timeout on the callback, so if the user does not enter the secret in 60 seconds, you will receive an error to that effect.*

## Adding a Manual Permission

**THIS WILL BE DEPRECATED SOON**

```
client.addManualPermission((err, res) => {
})
```

## Getting Addresses

You may retrieve some number of addresses for supported cryptocurrencies. The Grid+ Lattice uses [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)-compliant highly-deterministic (HD) wallets for generating addresses. This means that for each currency you want to access, you must specify a `coin_type` (by default it will choose Bitcoin, or `0'`). You may also specify `start` (the starting index) and `total` the total number of addresses to generate, starting at the starting index.

An example request looks like:

```
const req = {
    permissionIndex: 0,  // Will be deprecated soon
    isManual: true,      // Will be deprecated soon
    start: 0,
    total: 4,
    coin_type: "0'"
    network: 'regtest'
};
client.addresses(req, (err, res) => {
    ...
})
```

**TODO: We need to remove permissionIndex for manual permissions and we also need to talk about automated permissions**

## Requesting a Manual Signature

The Lattice device, at its core, is a tightly controlled, highly configurable, cryptographic signing machine. By default, each pairing (the persistent association between your app and a user's lattice) allows the app an ability to request signatures that the user must manually authorize. However, this SDK also gives the app an ability to establish "automated signatures", which conform to permissions established by the user. For more information on that functionality, please see the [Permissions section](#Permissions). This section will focus on the more basic *manual signature request* functionality.

###<a name="Build-Tx"></a>Building a Transaction

For security reasons, transactions must be built according to pre-defined [schema](#Schema-Reference). Here we will use an ether transfer as an example, but several others are available (see [here](#Schema-Reference)).

#### TODO: Standardize `buildTx`

All supported schema are available in the SDK with a string representing its code:

```
const schemaCode = 'ETH';
const req = {
    amount: 1*(10**18), // atomic units: 10**18 per 1 ether
    to: '0x123...ab',
    gasPrice: 1*(10**9),
}
client.buildTx(schemaCode, req, (err, tx) => {
    ...
})
```

### Requesting the Signature

Without a specified permission, an SDK user with a pairing can always request a signature that the Lattice user can manually accept on the device (similar to the experience of other hardware wallets).

Once your transaction has been built by the SDK, you can send it to the device, which checks the boundaries of your request in the secure compute module and, if it conforms to the desired schema, is passed to the secure enclave for signing (pending user authorization).

```
client.signManual(tx, (err, res) => {
    ...
})
```

##<a name="Permissions"></a>Permissions

The Lattice1 offers an extended API which enables "automated" signatures, which are based on user-authorized *permissions*.

#### Requesitng a Permission

Before requesting automated signatures, the paired application or service must create a permission. For example, your service can establish a permission with a particular Lattice that will enable automated signatures on up to 0.1 ETH per 24 hours. Such a request would look like this:

```
const permission = {
    schemaCode = 'ETH',
    params: {
        gasPrice: {
            gte: 1*(10**8),
            lte: 1*(10**9),
        },
        value: {
            lte: 1*(10**17),
        }
    },
    timeLimit: 86400
}
client.requestPermission(permission, (err, res) => {
    ...
})
```

Let's walk through this request. Again we are using a `schemaCode` identical to the one in the [Building a Transaction](#Build-Tx) section. We are also defining a series of parameters that set boundaries on the transaction. In this example, we are saying that `gasPrice` must be between 10^8 and 10^9 (`gte` stands for greater than or equal, `lte` stands for less than or equal). Similarly, the `value` must be less than or equal to 0.1 ETH. Finally, the `timeLimit` shows that this permission resets every 86,400 seconds, or 24 hours.

Available range options include:

* `gte`: greater than or equal
* `lte`: less than or equal
* `eq`: equal
* `gt`: greater than
* `lt`: less than

*Note: The `params` fields depend on the schema (see [Schema Reference](#Schema-Reference)), but `schemaCode` must be a string and `timeLimit` must be an integer (in seconds). These three first-level fields are **required***.

Once we send this request, the user will be shown a screen on her Lattice which parses the request and awaits her confirmation. Once confirmed, the permission will be created and associated with the pairing of the requested it.

Since we do not require tracking of individual permissions (the next section will make this obvious), it is not possible to establish two permission whose ranges on any given paramter overlap. For example, the following two permissions would **NOT** be allowed to simultaneously exist for a given paired app for a given Lattice:

```
params: {
    gasPrice: {
        gte: 1*(10**8),
        lte: 1*(10**9),
    },
    value: {
        lte: 1*(10**17),
    }
}

params: {
    gasPrice: {
        gte: 1*(10**9), // overlaps with upper bound of previous permission
        lte: 1*(10**10),
    },
    value: {
        lte: 1*(10**17),
    }
}
```

### Requesting an Automated Signature

With a permission in hand, an app can make a request like this:

```
const schemaCode = 'ETH';
const req = {
    amount: 1*(10**17), // atomic units: 10**18 per 1 ether
    to: '0x123...ab',
    gasPrice: 1*(10**9),
}
client.buildTx(schemaCode, req, (err, tx) => {
    client.signAutomated(tx, (err, res) => {
        ...
    })
})
```

Notice how this process is nearly identical to requesting a manual signature. If the request does not conform to an established permission associated with your app, it will be converted to a manual signature request, which times out after a period of time.

#<a name="Providers"></a>Providers

The Lattice is designed to compartmentalize security and delegate logic to the appropriate level of security. As such, it is by default stateless, in the sense that it does not know the state of any blockchain network. Rather, it securely holds the entropy, which determines the cryptocurrency wallets according to BIP39/44 standards.

As such, network providers must be utilized at the application level by default. Providers are available through the SDK, though you are also able to [import your own](Using-Your-Own-Provider) so long as it conforms to the same API.

## Importing and Using a Provider

##<a name="Using-Your-Own-Provider"></a>Using Your Own Provider

## List of Built-In Providers

### API of Providers

#<a name="API-Reference"></a>API Reference

#<a name="Schema-Reference"></a>Schema Reference

## Ethereum

### 'ETH': Ether Transfers

### 'ETH-ERC20': ERC20 Transfers

## Bitcoin

### 'BTC': Bitcoin Transfers