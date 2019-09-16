# GridPlus SDK

**WARNING: This is beta software and may contain bugs. Please limit cryptocurrency-related use to small amounts.**

The [GridPlus SDK](https://github.com/GridPlus/gridplus-sdk) allows any application to establish a connection and interact with a GridPlus Lattice device. 

# Installation

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

# Instantiating a Client

Once imported, you can instantiate your SDK client with a `clientConfig` object, which at minimum requires the name of your app (`name`) and a private key with which to sign requests (`privKey`). The latter is not meant to e.g. hold onto any cryptocurrencies; it is simply a way of maintaining a secure communication channel between the device and your application.

```
const crypto = require('crypto');
const clientConfig = {
    name: 'MyApp',
    crypto: crypto,
    privKey: crypto.randomBytes(32).toString('hex')
}
```

## Client options

| Param      | Type      | Default          | Description           |
|:-----------|:----------|:-----------------|:----------------------|
| `name`     | string    | None             | Name of the app. This will appear on the Lattice <br>                                                                                 screen for requests. Not required, but strongly <br>                                                                                  suggested. |
| `privKey`  | buffer    | None             | Private key buffer used for encryption/decryption<br>                                                                                 of Lattice messages. A random private key will be<br>                                                                                 generated and stored if none is provided. |
| `crypto`   | object    | None             | Crypto function package (e.g. `node.js`' native `crypto` module) |
| `timeout`  | number    | 60000            | Number of milliseconds to needed to timeout on a Lattice request |
| `baseUrl`  | string    |`https://signing.gridpl.us`| Hostname of Lattice request handlerName of the app. You probably don't need to ever change this. |

# Connecting to a Lattice

With the `clientConfig` filled out, you can instantiate a new SDK object:

```
const client = new Client(clientConfig);
```

With the client object, you can make a connection to any Lattice device which is connected to the internet:

```
const deviceId = 'MY_LATTICE';
client.connect(deviceId, (err) => {
    ...
});
```

If you get a non-error response, it means you can talk to the device. 

*NOTE: The `deviceId` is listed on your Lattice under `Settings->Device Info`*

# Pairing with a Lattice

When `connect` is called, your Lattice will draw a random, six digit secret on the screen. The SDK uses
this to "pair" with the device:

```
client.pair('SECRET', (err) => {
    ...
});
```

*NOTE: This function requires the user to interact with the Lattice. It therefore uses your client's timeout to sever the request if needed.*

# Getting Addresses

You may retrieve some number of addresses for supported cryptocurrencies. The Lattice uses [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)-compliant highly-deterministic (HD) wallets for generating addresses. You may request a set of contiguous addresses (e.g. indices 5 to 10 or 33 to 36) based on a currency (`ETH` or `BTC`).

> NOTE: For now, you may only request a maximum of 10 addresses at a time from the Lattice per request

An example request looks like:

```
const req = {
    start: 0,
    n: 4,
    currency: 'BTC'
    version: 'SEGWIT'
};
client.addresses(req, (err, res) => {
    ...
})
```

**Options:**

| Param      | Type      | Default          | Options         | Description           |
|:-----------|:----------|:-----------------|:----------------|:----------------------|
| `start`    | number    | none             | n/a             | First address index in BIP44 tree to return |
| `n`        | number    | 1                | n/a             | Number of subsequent addresses after `start` to derive |
| `currency` | string    | `BTC`            | `BTC`, `ETH`    | Currency to get addresses for |
| `version`  | string    | `SEGWIT`         | `LEGACY`, `SEGWIT`, `TESTNET`, `SEGWIT_TESTNET` | Bitcoin only -- type of addresses to retrieve |


# Requesting Signatures

The Lattice device, at its core, is a tightly controlled, highly configurable, cryptographic signing machine. By default, each pairing (the persistent association between your app and a user's lattice) allows the app an ability to request signatures that the user must manually authorize.

## Building a Transaction (ETH)

Ethereum transactions consist of six fields. An example payload looks as follows:

```
const txData = {
    nonce: 1,
    gasLimit: 25000,
    gasPrice: 1000000000,
    to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
    value: 0,
    data: '0x12345678'
    signerIndex: 0,
    chainId: 'rinkeby',
    useEIP155: true,
}
```

| Param      | Type      | Restrictions       |        
|:-----------|:----------|:-------------------|
| `nonce`    | number    | None               |
| `gasLimit` | number    | Must be >=22000    |
| `gasPrice` | number    | Must be >0         |
| `to`       | string    | Must be 20 bytes (excluding optional `0x` prefix) |
| `value`    | number    | None               |
| `data`     | string    | Must be <557 bytes |
| `signerIndex` | number | Address index of the Lattice Ethereum wallet to sign this transaction |
| `chainId`  | string    | Name of the chain to use, options provided below |
| `useEIP155` | bool | Default=true. Whether to use EIP155 to prevent replay attacks on the transaction. |


| Param    | Default  | Options                           |
|:---------|:---------|:----------------------------------|
| `chainId`| `mainnet` | `mainnet`, `ropsten`, `rinkeby`, `kovan`, `goerli` |

## Building a Transaction (BTC)

Bitcoin transactions are constructed by referencing a set of inputs to spend and a recipient + output value. You must also
specify a change address index (defaults to 0):

```
let txData = {
    prevOuts: [
        { 
            txHash: '08911991c5659349fa507419a20fd398d66d59e823bca1b1b94f8f19e21be44c',
            value: 3469416,
            index: 1,
            recipientIndex: 0,
        },
        {
            txHash: '19e7aa056a82b790c478e619153c35195211b58923a8e74d3540f8ff1f25ecef',
            value: 3461572,
            index: 0,
            recipientIndex: 1,
        }
    ],
    recipient: 'mhifA1DwiMPHTjSJM8FFSL8ibrzWaBCkVT',
    value: 1000,
    fee: 1000,
    isSegwit: true,
    changeIndex: 0,
    changeVersion: 'SEGWIT_TESTNET',
    network: 'TESTNET',
};
```

| Param                     | Type      |Restrictions                  |   Description              |
|:--------------------------|:----------|:-----------------------------|:-------------------------- |
| `prevOuts->txHash`        | string    | Must be 32 bytes             | Transaction hash of the previous output |
| `prevOuts->value`         | number    | Must be >0                   | Value of the previous output |
| `prevOuts->index`         | number    | Must be <255                 | Index of this previous output in the transaction |
| `prevOuts->recipientIndex`| number    | None                         | Address index in the Lattice wallet that received this output |
| `recipient`               | string    | Must be a valid address      | Address you are sending to |
| `value`                   | number    | Must be >0                   | Number of satoshis you are sending to `recipient` |
| `fee`                     | number    | Must be >0                   | Number of satoshis reserved for the transaction fee |
| `isSegwit`                | bool      | Must be true/false           | True if the inputs are encumbered by P2SH(P2WPKH), i.e. segwit |
| `changeIndex`             | number    | None                         | Address index in the Lattice wallet where the change will go |
| `changeVersion`           | string    | Must be one of below options | Version byte to build change address based on `changeIndex` |
| `network`                 | string    | Must be one of below options | Bitcoin network this transaction will be broadcast on |

| Param            | Default          |   Options              |
|:-----------------|:-----------------|:-----------------------|
| `changeVersion`  | `SEGWIT`         | `LEGACY`, `SEGWIT`, `TESTNET`, `SEGWIT_TESTNET` |
| `network`        |  `MAINNET`       | `MAINNET`, `TESTNET`   |


## Requesting the Signature

With the transaction params set, we can request the signature using the method outlined below. Upon receipt of the request, the Lattice will display the contents of your transaction data and wait for the user to authorize.

```
client.sign(opts, (err, signedTx) => {
    
})
```

The returned `signedTx` object has the following properties:

| Currency  | Param             |   Type  |  Description   |
|:----------|:------------------|:--------|:---------------|
| ETH / BTC | `tx`              | string  | Ready-to-broadcast, serialized transaction + signature payload |
| ETH / BTC | `txHash`          | string  | Hash of the transaction for lookup on the relevant block explorer |
| BTC       | `changeRecipient` | string  | Lattice wallet address that recieved the BTC change |
