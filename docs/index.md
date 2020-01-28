# GridPlus SDK

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
| `privKey`  | buffer    | None             | Private key buffer used for encryption/decryption<br>                                                                                 of Lattice messages. A random private key will be<br>                                                                                 generated and stored if none is provided. **Note that you will need to persist the private key between SDK sessions!** |
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
client.connect(deviceId, (err, isPaired) => {
    ...
});
```

If you get a non-error response, it means you can talk to the device. Note that the response also tells you whether you are paired with the device.

> The `deviceId` is listed on your Lattice under `Settings->Device Info`

# Pairing with a Lattice

> This function requires the user to interact with the Lattice. It therefore uses your client's timeout to sever the request if needed.

When `connect` is called, your Lattice will draw a random, six digit secret on the screen. The SDK uses
this to "pair" with the device:

```
client.pair('SECRET', (err, hasActiveWallet) => {
    ...
});
```

A non-error response indicates you may now make encrypted requests. 

> If `hasActiveWallet = false`, it means there was an error fetching the current wallet on the device. This could mean the device has not been set up
or that a SafeCard is inserted which has not been set up. It could also mean there was an error with the connection. If you try to get addresses or sign without
an active wallet saved (it is saved automatically if `hasActiveWallet = true`), the SDK will automatically retry fetching the active wallet before making the
original request.

# Getting Addresses

> If the SDK is connected to the wrong wallet or if the device has no current active wallet, this request will take additional time to complete.

You may retrieve some number of addresses for supported cryptocurrencies. The Lattice uses [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)-compliant highly-deterministic (HD) wallets for generating addresses. You may request a set of contiguous addresses (e.g. indices 5 to 10 or 33 to 36) based on a currency (`ETH` or `BTC`). *For now, you may only request a maximum of 10 addresses at a time from the Lattice per request.*


> NOTE: For BTC, the type of address returned will be based on the user's setting. For example, if the user's latter is configured to return segwit addresses, you will get addresses that start with `3`.

An example request looks like:

```
// Hardened offset is , referenced in the BIP44 spec here: https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#purpose
const HARDENED_OFFSET = 0x80000000;
const req = {
    // -- m/44'/0'/0'/0/0, i.e. first BTC address
    startPath: [HARDENED_OFFSET+44, HARDENED_OFFSET, HARDENED_OFFSET, 0, 0],
    n: 4
};
client.addresses(req, (err, res) => {
    ...
})
```

**Options:**

| Param      | Type      | Default          | Options         | Description           |
|:-----------|:----------|:-----------------|:----------------|:----------------------|
| `startPath` | Array    | none             | n/a             | First address path in BIP44 tree to return. You must provide 5 indices to form the path. |
| `n`        | number    | 1                | n/a             | Number of subsequent addresses after `start` to derive. These will increment over the final index in the path |

**Response:**

Returns an array of address strings (if the user's Lattice is configured to return segwit addresses):

```
res = [
    '3PKEDaainApM4u5Tqm1nn3txzZWbtFXUQ2', 
    '3He2JrsT33DEnjCgdpPgc6RXD3UogALCNF', 
    '3QybQyM8i9YR9e9Tgb1zLsYHHRXWF1eDAR', 
    '3PNwCSHKNfCjzvcU8XE9N8wp8DRxrUzsyL'
]
```

# Requesting Signatures

> This function requires the user to interact with the Lattice. It therefore uses your client's timeout to sever the request if needed.
> If the SDK is connected to the wrong wallet or if the device has no current active wallet, this request will take additional time to complete.

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
    // -- m/44'/60'/0'/0/0
    signerPath: [HARDENED_OFFSET+44, HARDENED_OFFSET+60, HARDENED_OFFSET, 0, 0],
    chainId: 'rinkeby',
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
| `signerPath`| Array | Address path from which to sign this transaction. NOTE: Ethereum wallets typically use the path specified in the example above for all transactions. |
| `chainId`  | string/number    | Name of the chain to use, options provided below. If a number is passed, it will use that. |

| Param    | Default  | Options                           |
|:---------|:---------|:----------------------------------|
| `chainId`| `mainnet` | `mainnet`, `ropsten`, `rinkeby`, `kovan`, `goerli` |

## Building a Transaction (BTC)

Bitcoin transactions are constructed by referencing a set of inputs to spend and a recipient + output value. You should also specify a change address path (defaults to `m/44'/0'/0'/1/0`):

```
let txData = {
    prevOuts: [
        { 
            txHash: '08911991c5659349fa507419a20fd398d66d59e823bca1b1b94f8f19e21be44c',
            value: 3469416,
            index: 1,
            signerPath: [HARDENED_OFFSET+44, HARDENED_OFFSET, HARDENED_OFFSET, 1, 0],
        },
        {
            txHash: '19e7aa056a82b790c478e619153c35195211b58923a8e74d3540f8ff1f25ecef',
            value: 3461572,
            index: 0,
            signerPath: [HARDENED_OFFSET+44, HARDENED_OFFSET, HARDENED_OFFSET, 0, 5],
        }
    ],
    recipient: 'mhifA1DwiMPHTjSJM8FFSL8ibrzWaBCkVT',
    value: 1000,
    fee: 1000,
    isSegwit: true,
    changePath: [HARDENED_OFFSET+44, HARDENED_OFFSET, HARDENED_OFFSET, 1, 1],
    changeVersion: 'SEGWIT_TESTNET',
    network: 'TESTNET',
};
```

| Param                     | Type      |Restrictions                  |   Description              |
|:--------------------------|:----------|:-----------------------------|:-------------------------- |
| `prevOuts->txHash`        | string    | Must be 32 bytes             | Transaction hash of the previous output |
| `prevOuts->value`         | number    | Must be >0                   | Value of the previous output |
| `prevOuts->index`         | number    | Must be <255                 | Index of this previous output in the transaction |
| `prevOuts->signerPath`| Array    | Must have 5x 4-byte numbers                         | BIP44 address path needed to sign this input |
| `recipient`               | string    | Must be a valid address      | Address you are sending to |
| `value`                   | number    | Must be >0                   | Number of satoshis you are sending to `recipient` |
| `fee`                     | number    | Must be >0                   | Number of satoshis reserved for the transaction fee |
| `isSegwit`                | bool      | Must be true/false           | True if the inputs are encumbered by P2SH(P2WPKH), i.e. segwit |
| `changePath`             | Array    |  Must have 5x 4-byte numbers                          | BIP44 address path to which the change will go |
| `changeVersion`           | string    | Must be one of below options | Version byte to build change address based on `changePath` |
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

**Response**

The returned `signedTx` object has the following properties:

| Currency  | Param             |   Type  |  Description   |
|:----------|:------------------|:--------|:---------------|
| ETH / BTC | `tx`              | string  | Ready-to-broadcast, serialized transaction + signature payload |
| ETH / BTC | `txHash`          | string  | Hash of the transaction for lookup on the relevant block explorer |
| BTC       | `changeRecipient` | string  | Lattice wallet address that recieved the BTC change |
