# Grid+ SDK

**WARNING: This is alpha software and may contain bugs. Please limit cryptocurrency-related use to small amounts.**

The [Grid+ SDK](https://github.com/GridPlus/gridplus-sdk) allows any application to establish a connection and interact with a Grid+ Lattice device. 

# Quickstart

The following tutorial will cover all the steps you need to start using the SDK at a basic level. For documentation on all functionality, please see the [API Reference section](#api-reference).

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

## Instantiating a Client

Once imported, you can instantiate your SDK client with a `clientConfig` object, which at minimum requires the name of your app (`name`) and a private key with which to sign requests (`privKey`). The latter is not meant to e.g. hold onto any cryptocurrencies; it is simply a way of maintaining a secure communication channel between the device and your application.

```
const crypto = require('crypto');
const clientConfig = {
    name: 'MyApp',
    crypto: crypto,
    privKey: crypto.randomBytes(32).toString('hex')
}
```

### Client options

| Param      | Type      | Default          | Description           |
|:-----------|:----------|:-----------------|:----------------------|
| `baseUrl`    | string    |`http://localhost`| Hostname of Lattice request handlerName of the app. |
| `name`     | string    | None             | Name of the app. This will appear on the Lattice <br>                                                screen for requests. Not required, but strongly <br>                                                 suggested. |
| `privKey`  | string/buffer| None          | Private key buffer used for encryption/decryption<br>                                                of Lattice messages. A random private key will be<br>                                                generated and stored if none is provided. | 
| `crypto`   | object    | None             | Crypto function package |


### Adding Providers

To connect the SDK to supported cryptocurrency networks, you will need to add *providers* to the `clientConfig`. We have two from which to choose:

```
import { providers } from `gridplus-sdk`;
const eth = new providers.Ethereum({ 
    network: 'rinkeby' 
    etherscan: true,
    apiKey: <myEtherscanApiKey>
});
const btc = new providers.Bitcoin({
    network: 'test3',
    blockcypher: true,
    coin: 'btc',
    apiKey: <myBlockCypherApiKey>
});

clientConfig.providers = [ eth, btc ];
```

To see the full list of configuration options for these providers (and how to add your own), please see the [Providers](#providers) section.


### Adding A Different Crypto Module [Optional]

By default, this client will use the build in `node.js` [`crypto`](https://nodejs.org/api/crypto.html) module. If you are using React Native, you may want to add another option to the `clientConfig` which specifies a limited "crypto library". We have an [example library](https://github.com/GridPlus/gridplus-react-native-crypto), which you are free to use:

```
import ReactNativeCrypto from 'gridplus-react-native-crypto';
const cryptoLib = new ReactNativeCrypto(clientConfig.privKey);
clientConfig.crypto = cryptoLib;
```

### Instantiate

With the `clientConfig` filled out, you can instantiate a new SDK object:

```
const client = new Client(clientConfig);
```

This returns an array of connections to the providers you have specified.

## Connecting to a Lattice

With the client object, you can make a connection to any Lattice device which is connected to the internet:

```
const serial = 'MY_LATTICE';
client.connect(serial, (err, res) => {
    ...
});
```

If you get a non-error response, it means you can talk to the device. 

## Pairing with a Device

We can now *pair* with a Lattice device, which means establishing a permanent, secure channel between your app and the device. We do this by generating a 6-digit secret, signing it, and sending that signature (plus some other content) to the device. The user then enters the secret you generated into the device (out of band).

*NOTE: The library of possible characters includes digits 0-9 and letters a-f,w,x,y,z (upper and lowercase), making it **base40**. You must generate a **6-digit** secret that uses only these characters*

```
const secret = crypto.randomBytes(3).toString('hex');
client.pair(secret, (err) => {
    ...
});
```

If you receive a callback with `err==null`, the pairing has been made successfully.

*NOTE: There is a timeout on the callback, so if the user does not enter the secret in 60 seconds, you will receive an error to that effect.*


## Getting Addresses

You may retrieve some number of addresses for supported cryptocurrencies. The Grid+ Lattice uses [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)-compliant highly-deterministic (HD) wallets for generating addresses. This means that for each currency you want to access, you must specify a `coin_type` (by default it will choose Bitcoin, or `0'`). You may also specify `start` (the starting index) and `total` the total number of addresses to generate, starting at the starting index.

An example request looks like:

```
const req = {
    start: 0,
    total: 4,
    coin_type: "0'"
    network: 'regtest'
};
client.addresses(req, (err, res) => {
    ...
})
```

## Requesting Signatures

The Lattice device, at its core, is a tightly controlled, highly configurable, cryptographic signing machine. By default, each pairing (the persistent association between your app and a user's lattice) allows the app an ability to request signatures that the user must manually authorize. However, this SDK also gives the app an ability to establish "automated signatures", which conform to permissions established by the user. For more information on that functionality, please see the [Permissions section](#permissions). This section will focus on the more basic *manual signature request* functionality.

### Building a Transaction

For security reasons, transactions must be built according to pre-defined [schema](#schema-reference). Here we will use an ether transfer as an example, but several others are available (see [here](#schema-reference).

All supported schema are available in the SDK with a string representing its code:

```
const schemaCode = 'ETH';
const opts = {
    schemaCode,
    params: {
      nonce: null,          // This will be filled in by the SDK
      gasPrice: 1e9,
      gas: 30000,
      to: '0x123...ab',
      value: 1e18,          // atomic units: 10e18 per 1 ether
      data: ''
    },
    accountIndex: 0,        // Indicates we are using account index 0 to spend from (i.e. m/44/60'/0'/0/0 <-- the last 0)
    sender: myAddress,      // Full address of the associated account index 0
};
```

*Note that `accountIndex` and `sender` must associate to the same address! For example, you might request the first address (index 0) from the client ([see method](#addresses)) and then use that result in this call along with `accountIndex=0`*

### Requesting the Signature

Without a specified permission, an SDK user with a pairing can always request a signature that the Lattice user can manually accept on the device (similar to the experience of other hardware wallets). Note that if the user rejects the transaction, `signedTx=null` below.

Once your transaction has been built by the SDK, you can send it to the device, which checks the boundaries of your request in the secure compute module and, if it conforms to the desired schema, is passed to the secure enclave for signing (pending user authorization).

```
client.sign(opts, (err, signedTx) => {
    ...
})
```

### Broadcasting a Transaction

Once you have your transaction (`signedTx`, from the previous section) signed, you can use the `client` to *broadcast* that transaction on the appropriate network. Note that this requires you to have instantiated a [provider](#providers) properly and to know the [schema name](#schema-reference) of the network you are trying to use. Here is a simple example of broadcasting on Ethereum:

```
const schemaName = 'ETH';
client.broadcast(schemaName, signedTx, (err, txHash) => {
    ...
})
```

## Permissions

The Lattice1 offers an extended API which enables "automated" signatures, which are based on user-authorized *permissions*.

#### Requesting a Permission

Before requesting automated signatures, the paired application or service must create a permission. For example, your service can establish a permission with a particular Lattice that will enable automated signatures on up to 0.1 ETH per 24 hours. Such a request would look like this:

```
const permission = {
    schemaCode = 'ETH',
    params: {
        gasPrice: {
            gte: 1*(10e8),
            lte: 1*(10e9),
        },
        value: {
            lte: 1*(10e17),
        }
    },
    timeLimit: 86400
}
client.requestPermission(permission, (err, res) => {
    ...
})
```

Let's walk through this request. Again we are using a `schemaCode` identical to the one in the [Building a Transaction](#building-a-transaction) section. We are also defining a series of parameters that set boundaries on the transaction. In this example, we are saying that `gasPrice` must be between 10^8 and 10^9 (`gte` stands for greater than or equal, `lte` stands for less than or equal). Similarly, the `value` must be less than or equal to 0.1 ETH. Finally, the `timeLimit` shows that this permission resets every 86,400 seconds, or 24 hours.

Available range options include:

* `gte`: greater than or equal
* `lte`: less than or equal
* `eq`: equal
* `gt`: greater than
* `lt`: less than

*Note: The `params` fields depend on the schema (see [Schema Reference](#schema-reference)), but `schemaCode` must be a string and `timeLimit` must be an integer (in seconds). These three first-level fields are **required***.

Once we send this request, the user will be shown a screen on her Lattice which parses the request and awaits her confirmation. Once confirmed, the permission will be created and associated with the pairing of the requested it.

Since we do not require tracking of individual permissions (the next section will make this obvious), it is not possible to establish two permission whose ranges on any given paramter overlap. For example, the following two permissions would **NOT** be allowed to simultaneously exist for a given paired app for a given Lattice:

```
params: {
    gasPrice: {
        gte: 1*(10e8),
        lte: 1*(10e9),
    },
    value: {
        lte: 1*(10e17),
    }
}

params: {
    gasPrice: {
        gte: 1*(10e9), // overlaps with upper bound of previous permission
        lte: 1*(10e10),
    },
    value: {
        lte: 1*(10e17),
    }
}
```

### Requesting an Automated Signature

With a permission in hand, an app can make a request in exactly the same way as before.

```
const schemaCode = 'ETH';
const opts = {
    schemaCode,
    params: {
      nonce: null,          // This will be filled in by the SDK
      gasPrice: 1e9,
      gas: 30000,
      to: '0x123...ab',
      value: 1e18,          // atomic units: 10e18 per 1 ether
      data: ''
    },
    accountIndex: 0,        // Indicates we are using account index 0 to spend from (i.e. m/44/60'/0'/0/0 <-- the last 0)
    sender: myAddress,      // Full address of the associated account index 0
};
client.sign(opts, (err, res) => {
    ...
})
```


Notice how this process is nearly identical to requesting a manual signature. If the request does not conform to an established permission associated with your app, it will be converted to a manual signature request, which times out after a period of time.

# Providers

The Lattice is designed to compartmentalize security and delegate logic to the appropriate level of security. As such, it is by default stateless, in the sense that it does not know the state of any blockchain network. Rather, it securely holds the entropy, which determines the cryptocurrency wallets according to BIP39/44 standards.

As such, network providers must be utilized at the application level by default. Providers are available through the SDK, though you are also able to import your own so long as it conforms to the same API.

## Importing and Using a Provider

Providers may be imported from this module separately from the `client`. Currently, the following provider *types* are supported

* `Bitcoin`
* `Ethereum`

These are imported like so:

```
import { providers } from 'gridplus-sdk';
const { Bitcoin, Ethereum } = providers;
```

To use a particular provider, you must pass an object configuring the provider type. Here are some exxamples:

```
// Use a BlockCypher provider for testnet3
const btcProvider = new Bitcoin({ network: 'test3', blockcypher: true, coin: 'btc', apiKey });

// Use an Etherscan provider for Rinkeby
const ethPRovider = new Ethereum({ network: 'rinkeby', etherscan: true, apiKey });
```

Once imported, you can use this provider to instantiate your `client`:

```
const client = new Client({
    clientConfig: {
        name: 'MyAppName',
        privKey: crypto.randomBytes(32).toString('hex'),
    },
    providers: [ btcProvider, ethProvider ]
});
```

A few notes:

* Your `apiKey` should be passed in for Etherscan and BlockCypher (i.e. cloud node providers). This does not need to be passed if you specify a custom node.
* `clientConfig` must be passed as an object. `name` and `privKey` are required fields.
* `providers` must be passed as an array of instantiated provider objects. Order does not matter here, as the client will automatically detect which provider corresponds to which currency (so long as the provider was intantiated properly).

## List of Built-In Providers

The following section outlines options related to built-in providers.

### Bitcoin

The built-in Bitcoin provider allows you to connect either to [blockcypher](https://blockcypher.com) or to a custom node that you define.

```
import { providers } from 'gridplus-sdk'
const Bitcoin = providers.Bitcoin;
const btc = new Bitcoin(params);
```

#### API Options

|  Param       |   Type   | Description                   |   Options        | Default    |
|:-------------|:---------|:------------------------------|:-----------------|:-----------|
| `network`    | string   | Name of the network to which<br> you wish to connect      | `test3` (Testnet3)<br>`mainnet`<br>`test` (BCY testnet)<br>`regtest` (local dev)<br>| `regtest` |
| `blockcypher`| bool     | Use blockcypher provider     | `true`<br>`false` | `false` |
| `apiKey`     | string   | API key of blockcypher       | Any               | None    |
| `host`       | string   | Hostname of custom node      | Any               | None    |
| `port`       | int      | Port of custom node          | Any               | None    |

### Ethereum

The built-in Ethereum provider allows you to connect either to [etherscan](https://etherscan.io) or to a custom node that you define.

```
import { providers } from 'gridplus-sdk';
const Ethereum = providers.Ethereum;
const eth = new Ethereum(paramss);
```

#### API Options

|  Param       |   Type   | Description                   |   Options        | Default    |
|:-------------|:---------|:------------------------------|:-----------------|:-----------|
| `network`    | string   | Name of the network to which<br> you wish to connect      | `rinkeby`<br>`homestead` (mainnet)<br>`kovan`<br>`ropsten`        | `homestead` |
| `etherscan`  | bool     | Use etherscan provider       | `true`<br>`false` | `false` |
| `apiKey`     | string   | API key for etherscan        | Any               | None    |
| `host`       | string   | Hostname of custom node      | Any               | None    |
| `port`       | int      | Port of custom node          | Any               | None    |

# Schema Reference

This section outlines the schema types, param names, and restrictions for the accepted `schemaCodes`:

* **Types** show the data types expected for the relevant schema
* **ParamNames** show the naems of the parameters that will go into building a schema
* **Restrictions** show required param values, if applicable

### Ethereum

#### 'ETH': Ether Transfers

* Types: `[ "number", "number", "number", "string", "number", "string" ]`
* ParamNames: `[ "nonce", "gasPrice", "gas", "to", "value", "data" ]`
* Restrictions: `data=''`

#### 'ETH-ERC20': ERC20 Transfers

* Types: `[ "number", "number", "number", "string", "number", "object" ]`
* ParamNames: `[ "nonce", "gasPrice", "gas", "to", "value", "data" ]`
* Restrictions: `data` must be of form `{ to: <string>, value: <integer> }` where `to` is the recipient of the tokens and `value` is the number of tokens (atomic units) to send.

**Note: ERC20 transfers require the `to` value in the `param` array to be the address of the token contract!**

#### 'ETH-Unstructured': Unstructured Ethereum Contract Calls

* Types: `[ "number", "number", "number", "string", "number", "string" ]`
* ParamNames: `[ "nonce", "gasPrice", "gas", "to", "value", "data" ]`
* Restrictions: No permissions allowed.


*Bitcoin*

#### 'BTC': Bitcoin Transfers

* Types: `[ "number", "number", "string", "number", "number", "number" ]`
* ParamNames: `[ "version", "lockTime", "recipient", "value", "change", "changeAccountIndex" ]`
* Restrictions: `version=1`, `lockTime=0`


# API Reference

This section includes a full reference for the `client` API.

## addresses
### Params: (param, cb)

Retrieve one or more addresses from a paired device.

#### param [object], required

|  Param       |   Type   | Default         | Required | Description                 |
|:-------------|:---------|:----------------|:---------|:----------------------------|
| `permissionIndex` | int | None            | Yes      | **Will be deprecated soon.**<br>Refers to specific index of permission<br>we are requesting addresses against |
| `start`      | int      | `0`             | No       | Starting index of account to scan<br>(`m/44'/x/0'/0/start`) |
| `total`      | int      | `1`             | No       | Number of addresses to return.<br>They will be in sequential order<br>starting at `start` |
| `coin_type`  | string   | `0'`            | No       | `0'` for Bitcoin, `60'` for Ethereum |
| `network`    | stirng   | `bitcoin`       | No       | Only used for Bitcoin `coin_type`.<br>Options in previous section. |
| `segwit`     | bool     | `true`          | No       | Only used for Bitcoin `coin_type`


#### cb(err, addresses)

* `err`: string or `null`
* `addresses`: array of strings (if multiple) or a string (if one).


## addPermission
### (param, cb)

Request a new permission based on a rule set you provide.

#### param [object], required

|  Param       |   Type   | Default         | Required | Description                 |
|:-------------|:---------|:----------------|:---------|:----------------------------|
| `schemaCode` | string   | None            | Yes      | Structure of permission.<br>`ETH`, `BTC`, or `ETH-ERC20` |
| `timeLimit`  | int      | None            | Yes      | Seconds after which permission window resets. |
| `params`     | object   | None            | Yes      | Parameters of permission. See Permissions section for examples. |

#### cb(err, success)

* `err`: string or `null`.
* `success`: boolean indicating whether the user accepted the request

## broadcast
### (shortcode, payload, cb)

Given a signed transaction from `sign`, broadcast to the desired network using the specified provider.

#### shortcode [string], required

Provider code you want to broadcast to (e.g. ETH, BTC)

#### payload [object], required

Object of form:
```
{
    tx: <string>
}
```

Where `tx` is the encoded transaction payload specific to the network being used.

#### cb(err, res)

* `err` string or `null`
* `txHash` string, transaction hash

## connect
### (serial, cb)

Reach out to a Lattice device using a `serial`. This will attempt to make a brief connection to retrieve the first encryption key needed for pairing.

#### serial [string], required

Serial of the Lattice. This is device-specific.

#### cb(err)

* `err` - string representing the error message (or `null`)

## deletePairing
### (cb)

Delete your pairing with the connected Lattice. You will not be able to make any more requests after you do this. *This also deletes all of your permissions, meaning they will not be recovered if you re-pair later!*

#### cb(err)

* `err` - string representing the error message (or `null`)

## deletePermission
### (index, cb)

Delete a given permission based on an index, which can be found via [permissions](#permissions).

#### index [integer], required

The index of the permission, based on the array returned from [permissions](#permissions).

#### cb(err)

* `err` - string representing the error message (or `null`)

## getBalance
### (shortcode, opts, cb)

Use a provider to get the balance of a particular account for a particular network.

#### shortcode [string], required

Provider code you want to broadcast to (e.g. ETH, BTC)

#### opts [object]

|  Param       |   Type   | Default         | Required | Description                 |
|:-------------|:---------|:----------------|:---------|:----------------------------|
| `address`    | string/array | None        | Yes      | One or more addresses to query.<br>*This Must be a single address for<br>Ethereum requests!* |
| `sat`        | bool     | `true`          | No       | Bitcoin only: Get balances in satoshis |


#### cb(err, res)

* `err` - string representing the error message (or `null`)
* `res` - object of form:

*Ethereum*:
```
{
    balance: <integer>,  // balance in wei
    transfers: <object>, // ether transfers. Will only be non-empty if etherscan=true
    nonce: <integer>     // account nonce
}
```

*Bitcoin*:
```
{
    balance: <integer> // Balance in the specified unit (satoshis by default)
    utxos: <array>     // Array of UTXO objects
}
```


## getTokenBalance [Ethereum only]
### (opts, cb)

Use a provider to get the ERC20 balance for one or more tokens, for one or more addresses.

#### opts [object]

|  Param       |   Type   | Default         | Required | Description                 |
|:-------------|:---------|:----------------|:---------|:----------------------------|
| `address`    | string   | None            | Yes      | Address to scan             |
| `tokens`     | string/array | None        | Yes      | Token contract address(es) to scan |

#### cb(err, res)

* `err` - string representing the error message (or `null`)
* `res` - object of form:

```
{
    <tokenAddress>: <int>  // Balance in atomic units of token
}
```

## getTxHistory
### (shortcode, opts)

Get transaction history for a given address or addresses.

#### shortcode [string], required

Provider code you want to broadcast to (e.g. ETH, BTC)

#### opts [object], required

|  Param       |   Type   | Default         | Required | Description                 |
|:-------------|:---------|:----------------|:---------|:----------------------------|
| `address`    | string/array | None        | Yes      | Address(es) to scan         |
| `ERC20Token` | string/array | None        | No       | *ETH only*: Token contract(s) to scan |

#### cb(err, res)

* `err` - string representing the error message (or `null`)
* `res` - array of form:


*Etheruem*:
```
[
    { 
        currency: 'ETH',                  // indicates ETH or BTC (ERC20 transfers are ETH)
        hash: <string>,                   // transaction hash
        height: <integer>,                // block the transaction was included in
        in: <tinyint>,                    // 1 if the address being scanned received these coins, 0 otherwise
        contractAddress: <string>,        // token contract, if applicable (null for ether transfers)
        from: <string>,
        to: <string>,
        value: <number>,                  // value being transacted, in tokens (atomic units) or ether (NOT wei)
        timestamp: <number>               // UNIX timestamp of mined transaction/block
        fee: <number>                     // mining fee in units of ether
        data: <object>                    // Full transaction object. May differ depending on provider.
    }    
]
```

*Bitcoin*:
```
{
    <address0>: [
        { 
            to: <string>,            // Address of recipient of the *first* output 
            from: <string>,          // Address of spender of the *first* UTXO input 
            fee: <number>,           // Total transaction fee in units of BTC or satoshis, depending on your request params
            in: <tinyint>,           // 0 for outgoing transactions, 1 for incoming
            hash: <string>,          // Transaction hash
            currency: 'BTC',
            height: <integer>,       // Block number in which this transaction was included
            timestamp: <integer>,    // UNIX timestamp of mined transaction/block
            value: <number>,         // Value of transaction (negative if outgoing). May be in BTC or satoshis, depending on your request params
            data: <object>           // Full transaction object. May differ depending on provider
        },
    ]
}
```

*Note that if only one address is sent, the return object will be a single array, rather than an object indexed by address.*

## getTx
### (shortcode, hashes, opts, cb)

Get the full transaction object(s) using one (or more) transaction hashes.

*Warning: This function is not well tested and may be deprecated. It is not supported with all providers.*

#### shortcode [string], required

Provider code you want to broadcast to (e.g. ETH, BTC)

#### hashes [string or array], required

Single hash (string) or array of hashes to look up.

##### opts [object]

This option may be deprecated. It currently only allows the user to pass `addresses` to filter out txs that don't involve those addresses.

#### cb(err, txs)

* `err` - string representing the error message (or `null`)
* `res` - array of transaction objects (see `getTxHistory`)

## pair
### (appSecret, cb)

Establish a secure connection with the desired device.

#### appSecret [string], required

String representation of the entropy you have generated. **Must be 6 characters (TODO: specify alphabet - use hex for now)**

#### cb(err)

* `err` - string representing the error message (or `null`)


## permissions
### (cb)

Get a list of permissions associated with your permission.

#### cb(err, permissions)

* `err` - string representing the error message (or `null`)
* `permissions` - array of permissions of form:

```
[{
    schemaCode: <string>,
    timeLimit: <int>,
    params: <object>,
}]
```

*Note that the params will be the same format that you specified when you created the permission via [addPermission](#add-permission).*


## sign
### (options, cb)

Request a signature to be returned automatically (i.e. *without* user authorization). This must be requested within constraints of a pre-established permission.

#### options [object], required

Required options:

```
{
    schemaCode: <string>,     // The schema code (e.g. ETH, ETH-ERC20, BTC)
    params: {
        ... // Set of parameters based on the type of request
    },
    network: <string>,         // Required only for Bitcoin non-mainnet txs. See options in `List of Built-In Providers` section above
}
```

Notes about `options.params`:
* **All values are required!**
* The values will depend on the schema being used. For a full list of specific schema params, see the [Schema Reference](#schema-reference) section.

Optional options:
```
{
    ...,                                // required params specified above
    accountIndex: <integer> or array,   // [Default 0] index of the requested signing account (e.g. 0 indicates m/44/*/*/0)
    sender: <string> or <array>,        // Address (or addresses) to send from (or check UTXOs received by). Ethereum should only have one address - it is used to look up a nonce. Bitcoin can have one or several - they are used to look up UTXOs 
    inputs: <array>,                    // Bitcoin only. UTXO(s) to spend.
    perByteFee: <integer>,              // Default 3, Bitcoin only. Satoshis per byte for the mining fee
    multisig: <bool>                    // Default false, Bitcoin only. If true, a p2sh locking script will be interpreted as multisig (instead of single segwit)
}
```

*NOTE: `multisig` is not functional yet, but in the future it will be used to distinguish between p2sh and p2sh(p2pwh) spends. Right now we assume the latter.*

**Notes**:

* `accountIndex` must correspond to `sender`. For example, if you want to send from account 0, you need to get the corresponding address and you would use those as a single int/string combination. If you want to potentially spend from multiple addresses, you would need to get the addresses and corresponding indices. Also note that for Ethereum, the SDK will only use the first address/index combination if you pass it arrays.
* `inputs` above may be explicitly specified by the user, but by default a signature request will find UTXOs to spend and construct the inputs automatically. Just in case you want to define your own inputs, they are formatted as:

```
{
    hash: <string>,                 // Hash of the transaction that produced the UTXO that is being consumed
    outIndex: <integer>,            // Index of the consumed UTXO in the transaction
    scriptType: <string>,           // Type of spend script: p2pkh, p2sh, p2sh(p2pwh)
    spendAccountIndex: <integer>,   // Index of the Lattice account associated with the address which can spend this UTXO
    inputValue: <integer>           // Value of the UTXO being spent (in units of satoshi)
}
```

*NOTE: including your own inputs is not yet supported.*

#### cb(err, sigData)

* `err` - string representing the error message (or `null`)
* `sigData` - object (or `null`, if the request has no matching permission and the user rejects it) containing signature data which can be broadcast with `client.broadcast()`. Format depends on the network used:

*Bitcoin*:
```
{ 
    tx: <string>,       // Full transaction payload which can be broadcast
    txHash: <string>,   // Transaction hash (non-segwit)
    stxHash: <string>   // Segwit-based transaction hash. If your tx is segwit, you should use this to look up the transaction in a block explorer
}
```

*Ethereum*:
```
{
    sig: <string>,          // Concatenated signature (v,r,s)
    vrs: <array>,           // Broken up v,r,s signature: [ v <integer>, r <string>, s <string> ],
    to: <string>,           // Recipient
    value: <integer>,       // Value (in wei) of transaction (0 for ERC20 transfers)
    height: <integer>,      // Block in which this transaction was included. This should be -1 unless the same tx has already been signed and mined
    tx: <string>,           // Full ABI encoded, signed transaction payload (hex string)
    txHash: <string>,       // Transaction hash (may be null)
    unsignedTx: <string>    // ABI encoded transaction payload without the signature
}
```

*Note: This returns more data than we **need** to pass to `broadcast`. The extra data can be helpful for debug and testing, but will not impact the `broadcast` call if it is included.*