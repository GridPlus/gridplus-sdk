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
const opts = {
    amount: 1*(10e18), // atomic units: 10e18 per 1 ether
    to: '0x123...ab',
    gasPrice: 1*(10e9),
}
client.buildTx(schemaCode, opts, (err, tx) => {
    ...
})
```

### Requesting the Signature

Without a specified permission, an SDK user with a pairing can always request a signature that the Lattice user can manually accept on the device (similar to the experience of other hardware wallets).

Once your transaction has been built by the SDK, you can send it to the device, which checks the boundaries of your request in the secure compute module and, if it conforms to the desired schema, is passed to the secure enclave for signing (pending user authorization).

```
client.signManual(tx, (err, signedTx) => {
    ...
})
```

### Broadcasting a Transaction

Once you have your transaction (`signedTx`, from the previous section) signed, you can use the `client` to *broadcast* that transaction on the appropriate network. Note that this requires you to have instantiated a [provider](#Providers) properly and to know the [schema name](#Schema-Reference) of the network you are trying to use. Here is a simple example of broadcasting on Ethereum:

```
const schemaName = 'ETH';
client.broadcast(schemaName, signedTx, (err, res) => {
    ...
})
```

##<a name="Permissions">Permissions</a>

The Lattice1 offers an extended API which enables "automated" signatures, which are based on user-authorized *permissions*.

#### Requesitng a Permission

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

With a permission in hand, an app can make a request like this:

```
const schemaCode = 'ETH';
const req = {
    amount: 1*(10e17), // atomic units: 10e18 per 1 ether
    to: '0x123...ab',
    gasPrice: 1*(10e9),
}
client.buildTx(schemaCode, req, (err, tx) => {
    client.signAutomated(tx, (err, res) => {
        ...
    })
})
```

Notice how this process is nearly identical to requesting a manual signature. If the request does not conform to an established permission associated with your app, it will be converted to a manual signature request, which times out after a period of time.

#<a name="Providers">Providers</a>

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
const btcProvider = new Bitcoin({ network: 'test3', blockcypher: true, coin: 'btc' });

// Use an Etherscan provider for Rinkeby
const ethPRovider = new Ethereum({ network: 'rinkeby', etherscan: true });
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

* `clientConfig` must be passed as an object. `name` and `privKey` are required fields.
* `providers` must be passed as an array of instantiated provider objects. Order does not matter here, as the client will automatically detect which provider corresponds to which currency (so long as the provider was intantiated properly).

## List of Built-In Providers

The following section outlines options related to build-in providers.

### Bitcoin

The built-in Bitcoin provider allows you to connect either to [blockcypher](https://blockcypher.com) or to a custom node that you define.

```
import { providers } from 'gridplus-sdk'
const Bitcoin = providers.Bitcoin;
const btc = new Bitcoin(params);
```

####<a href="Bitcoin-Provider-Options"></a>API Options

<table>
    <tr>
        <td>Param</td>
        <td>Type</td>
        <td>Description</td>
        <td>Options</td>
        <td>Default</td>
    </tr>
    <tr>
        <td>network</td>
        <td>string</td>
        <td>Name of the network to which you wish to connect</td>
        <td>test3 (Testnet3), mainnet, test (BCY testnet), regtest (local development)</td>
        <td>regtest</td>
    </tr>
     <tr>
        <td>blockcypher</td>
        <td>bool</td>
        <td>True if you want to use blockcypher</td>
        <td>true, false</td>
        <td>false</td>
    </tr>
    <tr>
        <td>coin</td>
        <td>string</td>
        <td>The coin to use. Only needed when blockcypher=true</td>
        <td>BTC, BCY</td>
        <td>BTC</td>
    </tr>
    <tr>
        <td>host</td>
        <td>string</td>
        <td>Hostname of the node you wish to connect to. Only needed when blockcypher=false</td>
        <td>Any</td>
        <td>localhost<td>
    <tr>
    <tr>
        <td>port</td>
        <td>integer</td>
        <td>Port to connect to node. Only needed when blockcypher=false</td>
        <td>Any</td>
        <td>48332</td>
    </tr>
</table>

#### Network Options:

**TODO: Ensure these match with expectations**

* `test3`: Testnet3
* `bitcoin`: mainnet
* `test`: BCY (blockcypher) testnet
* `regtest`: local development network

### Ethereum

The built-in Ethereum provider allows you to connect either to [etherscan](https://etherscan.io) or to a custom node that you define.

```
import { providers } from 'gridplus-sdk';
const Ethereum = providers.Ethereum;
const eth = new Ethereum(paramss);
```

#### API Options

<table>
    <tr>
        <td>Param</td>
        <td>Type</td>
        <td>Description</td>
        <td>Options</td>
        <td>Default</td>
    </tr>
    <tr>
        <td>network</td>
        <td>string</td>
        <td>Name of the network to which you wish to connect. Only needs to be specified if etherscan=true; can be null if using custom node.</td>
        <td>rinkeby, kovan, ropsten, homestead (mainnet)</td>
        <td>regtest</td>
    </tr>
     <tr>
        <td>etherscan</td>
        <td>bool</td>
        <td>True if you want to use etherscan</td>
        <td>true, false</td>
        <td>false</td>
    </tr>
    <tr>
        <td>host</td>
        <td>string</td>
        <td>Hostname of the node you wish to connect to. Only needed when etherscan=false</td>
        <td>Any</td>
        <td>localhost<td>
    <tr>
    <tr>
        <td>port</td>
        <td>integer</td>
        <td>Port to connect to node. Only needed when etherscan=false</td>
        <td>Any</td>
        <td>8545</td>
    </tr>
</table>

#### Network Options:

* `rinkeby`
* `kovan`
* `ropsten`
* `homestead`: mainnet

#<a name="Schema-Reference">Schema Reference</a>

This section outlines the schema types, param names, and restrictions for the accepted `schemaCodes`:

* **Types** show the data types expected for the relevant schema
* **ParamNames** show the naems of the parameters that will go into building a schema
* **Restrictions** show required param values, if applicable

## Ethereum

#### 'ETH': Ether Transfers

* Types: `[ "number", "number", "number", "string", "number", "string" ]`
* ParamNames: `[ "nonce", "gasPrice", "gas", "to", "value", "data" ]`
* Restrictions: `data=''`

#### 'ETH-ERC20': ERC20 Transfers

* Types: `[ "number", "number", "number", "string", "number", "string" ]`
* ParamNames: `[ "nonce", "gasPrice", "gas", "to", "value", "data" ]`
* Restrictions: `data` must be of form ``0xa9059cbb${pad64(addr)}${pad64(value.toString(16))}`, where `pad64` indicates a 0-left-padded value of 64 characters. `addr` is the receiving address and `value` is the number of atomic units to send, in base-16 (i.e. a hex string)

## Bitcoin

#### 'BTC': Bitcoin Transfers

* Types: `[ "number", "number", "string", "number", "number", "number" ]`
* ParamNames: `[ "version", "lockTime", "recipient", "value", "change", "changeAccountIndex" ]`
* Restrictions: `version=1`, `lockTime=0`


#<a name="API-Reference">API Reference</a>

This section includes a full reference for the `client` API.

## addresses

Retrieve one or more addresses from a paired device.

Example call:

```
client.addresses(param, (err, addresses) => { })
```

#### param [object], required

<table>
    <tr>
        <td>Param</td>
        <td>Type</td>
        <td>Default</td>
        <td>Required</td>
        <td>Description</td>
    </tr>
    <tr>
        <td>permissionIndex</td>
        <td>integer</td>
        <td>None</td>
        <td>Yes</td>
        <td>Will be deprecated soon. Refers to specific index of permission we are requesting addresses against</td>
    </tr>
        <tr>
        <td>start</td>
        <td>integer</td>
        <td>0</td>
        <td>No</td>
        <td>Starting index of account to scan (m/44'/x/x/start)</td>
    </tr>    
    <tr>
        <td>total</td>
        <td>integer</td>
        <td>1</td>
        <td>No</td>
        <td>Number of addresses to return. These will be in sequential order starting at `start`.</td>
    </tr>    
    <tr>
        <td>coin_type</td>
        <td>string</td>
        <td>0'</td>
        <td>No</td>
        <td>BIP44 code for coin being requested. 0' for Bitcoin, 60' for Ethereum</td>
    </tr>
    <tr>
        <td>network</td>
        <td>string</td>
        <td>bitcoin</td>
        <td>No</td>
        <td>Name of network (see relevant provider options in previous section)</td>
    </tr>
    <tr>
        <td>segwit</td>
        <td>bool</td>
        <td>true</td>
        <td>No</td>
        <td>True if you want segwit addresses. Is only used for Bitcoin addresses</td>
    </tr>
</table>

#### cb [Function]

Returns `(err, addresses)`, where `err` is a string (or `null`) and `addresses` is an array of strings (if multiple) or a string (if one).


## addManualPermission

Will be deprecated soon

## addPermission

Request a new permission based on a rule set you provide.

Example call:

```
client.addPermission(param, (err) => { })
```

#### param [object], required

<table>
    <tr>
        <td>Param</td>
        <td>Type</td>
        <td>Default</td>
        <td>Required</td>
        <td>Description</td>
    </tr>
    <tr>
        <td>schemaCode</td>
        <td>string</td>
        <td>None</td>
        <td>Yes</td>
        <td>Schema code you want to create a permission for (e.g. ETH, ETH-ERC20, BTC)</td>
    </tr>
        <tr>
        <td>timeLimit</td>
        <td>integer</td>
        <td>None</td>
        <td>Yes</td>
        <td>Time (in seconds) constraining permission. For example, a permission might set a limit of 0.5 ETH to be auto-signed over a period of 60 seconds. This permission would reset every 60 seconds.</td>
    </tr>    
    <tr>
        <td>params</td>
        <td>object</td>
        <td>None</td>
        <td>Yes</td>
        <td>An object whose keys are named after schema param names. Sub-object keys are range options. See Permissions section for examples.</td>
    </tr>    
</table>

#### cb [Function]

Returns `(err)`, where `err` is a string or `null`.

## broadcast

Given a built transaction (see: `buildTx`), broadcast to the desired network using the specified provider.

Example call:

```
client.broadcast(shortcode, payload, (err, tx) => {});
```

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

#### cb [Function]

Returns `(err, res)`, where `err` is a string or `null` and `res` is an object whose form depends on the network/provider being used.

## buildTx

**I think this has been functionally deprecated. Our signature requests no longer need to be specially formatted, which I think was the whole point of this function.**

Build a transaction given network-specific options.

#### shortcode [string], required

Provider code you want to broadcast to (e.g. ETH, BTC)

#### opts [object], required

These will be different depending on the shortcode.

**Bitcoin**:

<table>
    <tr>
        <td>Param</td>
        <td>Type</td>
        <td>Default</td>
        <td>Required</td>
        <td>Description</td>
    </tr>
    <tr>
        <td>amount</td>
        <td>integer</td>
        <td>None</td>
        <td>Yes</td>
        <td>Number of satoshis (10e-8 BTC) to send.</td>
    </tr>
    <tr>
        <td>to</td>
        <td>string</td>
        <td>None</td>
        <td>Yes</td>
        <td>Address to receive bitcoins</td>
    </tr>
    <tr>
        <td>addresses</td>
        <td>array</td>
        <td>None</td>
        <td>Yes</td>
        <td>Addresses that the sender controls, which will be searched for any UTXOs.</td>
    </tr>
    <tr>
        <td>perByteFee</td>
        <td>integer</td>
        <td>3</td>
        <td>No</td>
        <td>Satoshis/byte for mining fee</td>
    </tr>
    <tr>
        <td>changeIndex</td>
        <td>integer</td>
        <td>0</td>
        <td>No</td>
        <td>Index of the account that will be receiving change. This is the last index of the BIP44 standard.</td>
    </tr>
    <tr>
        <td>network</td>
        <td>string</td>
        <td>regtest</td>
        <td>No</td>
        <td>Network to use (see Bitcoin provider network options)</td>
    </tr>
</table>

**Ethereum**:

<table>
    <tr>
        <td>Param</td>
        <td>Type</td>
        <td>Default</td>
        <td>Required</td>
        <td>Description</td>
    </tr>
    <tr>
        <td>from</td>
        <td>address</td>
        <td>None</td>
        <td>Yes</td>
        <td>Address the user is sending from.</td>
    </tr>
    <tr>
        <td>to</td>
        <td>string</td>
        <td>None</td>
        <td>Yes</td>
        <td>Address the user is sending to.</td>
    </tr>
    <tr>
        <td>value</td>
        <td>integer</td>
        <td>None</td>
        <td>Yes</td>
        <td>Number of wei (10e-18 ether) to send in transaction. Will be 0 for all contract calls, including ERC20 transfers.</td>
    </tr>
    <tr>
        <td>gasPrice</td>
        <td>integer</td>
        <td>1e9</td>
        <td>No</td>
        <td>Price (in wei) of gas</td>
    </tr>
    <tr>
        <td>gas</td>
        <td>integer</td>
        <td>100000</td>
        <td>No</td>
        <td>Gas limit of transaction. Any extra gas spent will be refunded.</td>
    </tr>
    <tr>
        <td>data</td>
        <td>string</td>
        <td>''</td>
        <td>No</td>
        <td>Hex string with ABI-encoded data. See restrictions on schema type.</td>
    </tr>
</table>

#### cb (err, tx)

* `err` - string representing the error message (or `null`)
* `tx` - string with the encoded transaction payload to broadcast


## connect

Reach out to a Lattice device using a `serial`. This will attempt to make a brief connection to retrieve the first encryption key needed for pairing.

#### serial [string], required

Serial of the Lattice. This is device-specific.

#### cb (err)

* `err` - string representing the error message (or `null`)


## deletePairing

Delete the pairing between this SDK and a device. Note that each SDK object instance maps 1:1 to a paired device, so no arguments are needed.

#### cb (err)

* `err` - string representing the error message (or `null`)

## getBalance

Use a provider to get the balance of a particular account for a particular network.

#### shortcode [string], required

Provider code you want to broadcast to (e.g. ETH, BTC)

#### opts [object]

<table>
    <tr>
        <td>Param</td>
        <td>Type</td>
        <td>Default</td>
        <td>Required</td>
        <td>Description</td>
    </tr>
    <tr>
        <td>address</td>
        <td>string or array</td>
        <td>None</td>
        <td>Yes</td>
        <td>One or more addresses to query the balance for. NOTE: This must be a single address for Ethereum requests!</td>
    </tr>
    <tr>
        <td>sat</td>
        <td>bool</td>
        <td>true</td>
        <td>No</td>
        <td>(Bitcoin only) Get balance in satoshis (rather than BTC).</td>
    </tr>
</table>

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

Use a provider to get the ERC20 balance for one or more tokens, for one or more addresses.

#### opts [object]

<table>
    <tr>
        <td>Param</td>
        <td>Type</td>
        <td>Default</td>
        <td>Required</td>
        <td>Description</td>
    </tr>
    <tr>
        <td>address</td>
        <td>string</td>
        <td>None</td>
        <td>Yes</td>
        <td>Address to scan balances for.</td>
    </tr>
    <tr>
        <td>tokens</td>
        <td>string or array</td>
        <td>None</td>
        <td>Yes</td>
        <td>One or more token contract addresses to scan over.</td>
    </tr>
</table>

#### cb(err, res)

* `err` - string representing the error message (or `null`)
* `res` - object of form:

```
{
    <tokenAddress>: <int>  // Balance in atomic units of token
}
```

## getTxHistory

Get transaction history for a given address or addresses.

#### shortcode [string], required

Provider code you want to broadcast to (e.g. ETH, BTC)

#### opts [object]

<table>
    <tr>
        <td>Param</td>
        <td>Type</td>
        <td>Default</td>
        <td>Required</td>
        <td>Description</td>
    </tr>
    <tr>
        <td>address</td>
        <td>string or array</td>
        <td>None</td>
        <td>Yes</td>
        <td>Address (or addresses) to scan history for.</td>
    </tr>
    <tr>
        <td>ERC20Token</td>
        <td>string or array</td>
        <td>None</td>
        <td>No</td>
        <td>[Ethereum only] One or more token contract addresses to scan over.</td>
    </tr>
</table>

#### cb(err, res)

* `err` - string representing the error message (or `null`)
* `res` - array of form:


*Etheruem*:
**TODO: Make sure JSON-RPC returns the fields marked "etherscan only" below**
```
[
    { 
        currency: <string>,               // indicates ETH or BTC (ERC20 transfers are ETH)
        hash: <string>,                   // transaction hash
        height: <integer>,                // block the transaction was included in
        in: <integer>,                    // true if the address being scanned received these coins
        contractAddress: <string>,        // token contract, if applicable (null for ether transfers)
        from: <string>,
        to: <string>,
        value: <number>,                  // value being transacted, in tokens (atomic units) or ether (NOT wei)
        timestamp: <number>               // [etherscan only] timestamp of mined block
        fee: <number>                     // [etherscan only] mining fee in units of ether
        data: <object>                    // [etherscan only] raw transaction payload
    }    
]
```





### Check out both blockcypher and local regtest responses. These need to be the same!
*Bitcoin*:
```
[
     { to: 'GfuN4XdR5jzHtJYQj8gFu4tBw9fjEC9meu',
       from: 'GJNT5W899xhAuaL3WnZEBPMPuhT1zTPXQP',
       fee: 0.00000522,
       in: 0,
       hash:
        '299c9858dea9545917a7f19cb2483a09cd1fad394d979d621ec12b9a1e0a4cfc',
       currency: 'BTC',
       height: 952,
       timestamp: 1541540917,
       value: -0.00009478,
       data: [Object] },
]
```