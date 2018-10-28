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

## Requesting a Signature

The Lattice device, at its core, is a tightly controlled, highly configurable, cryptographic signing machine. By default, each pairing (the persistent association between your app and a user's lattice) allows the app an ability to request signatures that the user must manually authorize. However, this SDK also gives the app an ability to establish "automated signatures", which conform to permissions established by the user. For more information on that functionality, please see the [Permissions section](#Permissions). Since this is an advanced topic, this quick start guide does not cover it.

### Building a Transaction

To request a signature that must be manually authorized, you must have a pairing. Once you do, you can form a request like so:




#<a name="Permissions"></a>Permissions

#<a name="Providers"></a>Providers

#<a name="API-Reference"></a>API Reference