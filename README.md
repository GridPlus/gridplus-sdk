# GridPlusSDK

A SDK for managing connections to GridPlus Agent devices, permissions, and remote signing requests.

### Basic Usage

```
const crypto = require('crypto');
const GridPlusSDK = require('GridPlusSDK').default;

// Create a key
const privateKey = crypto.randombytes(32);

// Initialize
const opts = { key: privateKey };  
const sdk = new GridPlusSDK(opts);

// Lookup an ETH balance
sdk.getBalance('ETH', myAddress)
  .then((balance) => {
    // Lookup token transfer logs
    return sdk.getTransactionHistory('ERC20', myAddress, ERC20_Token_Address)
  })
  .then((history) => {})
  .catch((err) => {})
```

# Background

This SDK utilizes the GridPlus Agent's remote signing capabilities to form automated signature requests.

## What is remote signing?

Because the agent can function as an always-online hardware device, we can leverage its availability to request automated signatures for any type of application. Broadly, each application defines one or more signature schema and passes those to the agent. The user must pin into the physical device and allow the automated schema (the user may configure a max number of signatures and/or a rate limit), after which the application may request signatures on the allowed schema and receive automated signatures.

# API

TODO

# Testing
You can run the test suite with:

```
npm run test
```

This requires you to have access to an Ethereum and Bitcoin node. For testing purposes, these should be running testnets locally.

#### Ethereum Nodes
We recommend using a lightweight node such as [Ganache](http://truffleframework.com/ganache/)
and copying the first account's address and private key in `config.testing.ethHolder` (in `src/config.js`). 
We need one hot account for testing purposes, but it will not be used in the SDK itself. This is because the SDK only displays static data and makes requests to external wallets.

#### Bitcoin Nodes
We recommend using `bitcoind`, which can be installed on OSX with:

```
brew install bitcoin
```

This installs a series of tools, including `bitcoind`. Once installed, please connect and sync to the test network with the following:

```
bitcoind -testnet -server
```

If you would like to view the console output (recommended), you can stream the logs with:

```
tail -f ~/Library/Application Support/Bitcoin/testnet3/debug.log
```

# OLD reference
**Please ignore while ths functionality is added back in. The below reference is not currently usable.**

## Pairing with a Device

Before setting up a remote signing permission, an app (or other agent device) must be *paired* to the user's device. This involves an out of band communication.

1. Device creates a salt and the user enters it into the app.
2. App creates a random seed, hashes it with the device's salt, and sends the resulting EC signature to the device.
3. User manually enters the random seed displayed on the app screen into the device, which can now recreate the hash and recover the app's public key.
4. App is now paired via the public key.

## Synchronous Requests

Non-critical requests can be made synchronously, meaning a response is issued at the time of the request. There are several synchronous requests that are needed for making asynchronous requests - see the API section for the specific endpoints.

## Asynchronous Requests

Asynchronous requests are doubly encrypted (don't worry - the SDK does this automatically) and are associated with a unique access token. This means that the requester needs three pieces of data first:

1. `id`: the hash of the encrypted token payload. This is saved to the `GridPlusSDK` object automatically when you call `getToken()`
2. `token`: a public key for this request, used to encrypt the payload. This is saved to the `GridPlusSDK` object automatically when you call `getToken()`
3. `headerKey`: the public key used to encrypt the outer envelope. You only need to request this once with `getHeaderKey()` and it is saved in the `GridPlusSDK` object.

## Access Tokens

All asynchronous requests require an access token to process. This is delivered via `getToken()` and is valid for one request. Once a request is processed, a new token is generated (retrievable by another call to `getToken()`). Each token is associated only with a single paired public key - the first token is generated when the pairing is added.

## Permissions
A permission is a specific rule set corresponding to a known schema. Permissions may only be added by an public key (e.g. web app) that is paired with the device and always require manual authorization.

A pre-determined set of schema will be made available publicly. These will correspond to common functions that a customer might like to use with remote signing (e.g. bitcoin transfer, ether transfer, Ethereum token transfer). More schema may be made available as time goes on and we are open to requests!

Permissions have three parts:

1. Schema type (e.g. ether transfer)
2. Rules (e.g. amount must be 0.001 ether, recipient must be `0x12...ab`)
3. Time limit, in seconds (e.g. 10000 seconds minimum required between remote signing requests)

If the remote signing request does not adhere to the correct schema, breaks any of the rules, or is sent too quickly after the previous one, it will be rejected with a corresponding error message.

Because permissions belong to pairings, they must not collide. This means the set of all rules, schema, and time limit may overlap, but may not intersect completely.

## Remote Signing Requests

Once a permission is setup by a pairing, that pairing may send signature requests, which are matched against the relevant permission. Apps may also request a *manual signature request*, by indicating the request does not correspond to any established permissions. In the case of a permissioned request failure, the request is rejected all together. However, a manual request is queued for the user to sign on the device. Note that only paired apps may make manual signature requests.

# API

## Synchronous Requests
The following requests can be made without an access token and return a response at the time of the request (via the callback).

#### getHeaderKey(cb)
*Get the public key with which to encrypt header data for requests to the agent device.*

**cb** `([Error], [String])`: Returns public key as a hex string

#### getToken(device, cb)

*Get a token corresponding to the public key provided. This token can be used to make a call to the k81. It is encrypted with the key provided. It is only valid for one successful call.*

**device** `[String]`: identifier for the device (only used locally)

**cb** `([Error], [object])`:
```
{
  token: <string>    // Token to use with request, encrypted with pubKey provided
}
```

#### getResponse(id, device, cb)
*Get the response of a pending request, identified by id*

**id** `[String]`: The id of the request. This is the keccak256 hash of the encrypted token payload (see: `getToken()`)

**device** `[String]`: identifier for the device (only used locally)

**cb** `([Error], [object])`:
```
{
  status: <number>,     // Status code of the response, 0 if pending
  message: <string>,    // Status message, null if pending
  data: <object>        // Data, if applicable, formatted based on the request type
}
```

## Asynchronous Requests

Most endpoints are asynchronous, meaning that the initial response only indicates that the request has been queued.

## Pairings

A pairing is comprised of a public key and some metadata (passed with the signature when the pairing is created), which is stored in the k81. A pairing can belong either to a remote web application or a friend with whom you regularly transact. Rule sets can be added on top of a pairing for remote signing, but the pairing itself comes with no permissions.

#### addPairing(opts, cb)

*Add a pairing to the k81 storage. User authorization required for success.*

**opts** `<object>`:
```
{
  name: <string>,           // utf8 name of pairing. Typically this is defined by the owner of the pubKey
  deviceSecret: <string>,   // utf8 secret typed into the app by the user
  appSecret: <string>,      // utf8 secret generated by the app
  device: <string>,         // unique identifier of the device (only used locally)
}
```

**cb**: returns `(err [Error])`

**response**:

## Requests

All requests are sent through the `request()` endpoint. They must be formatted according to the specification defined in `Sending a Request` above.

### request(req, cb)

Where `req` is an encrypted, stringified JSON object as specified above.

**cb** returns `(success [bool])` - true if the request was queued, false if the request was rejected


### Permissions

Permissions map pairings to wallets. They enable a paired app to send requests for remote signatures on a timed interval and return signed data if all checks are passed.


#### addPermission(opts, cb)

*Add a permission. Asynchronous call that will return a request id if the request was properly formatted and submitted for manual authorization.*

**opts** `<object>`:
```
{
  'schema': <string>    // official name of schema
  'type': <string>      // official name of the schema type
  'rules': <object>     // see below
  'timeLimit': <uint>   // minimum number of seconds between requests. Must be >=60
  'device': <string>    // unique identifier of the device (only used locally)
}
```

`rules` are defined based on the schema being used. For example, if an Ethereum standard transaction schema is used, `rules` might look like:
```
{
  to: [ 'equals', '0xe9cb37ae6b4ee62ac70d52b7d2a7e708360e358f' ],
  value: [ 'less than', 10000 ]
}
```

Each rule contains 3 fields: `[ruleName, param1, param2]`. Note that `param2` may be null if only one param is needed (e.g. in the case of `equals`).

**cb** `(<Error>)`

**response**: