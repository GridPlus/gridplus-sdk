# GridPlusSDK

A SDK for managing connections to GridPlus Agent devices, permissions, and remote signing requests.

# Background

This SDK utilizes the GridPlus Agent's remote signing capabilities to form automated signature requests.

## What is remote signing?

Because the agent can function as an always-online hardware device, we can leverage its availability to request automated signatures for any type of application. Broadly, each application defines one or more signature schema and passes those to the agent. The user must pin into the physical device and allow the automated schema (the user may configure a max number of signatures and/or a rate limit), after which the application may request signatures on the allowed schema and receive automated signatures.


## Pairing with a Device

Before setting up a remote signing permission, an app (or other agent device) must be *paired* to the user's device. This involves an out of band communication.

1. Device creates a salt and the user enters it into the app.
2. App creates a random seed, hashes it with the device's salt, and sends the resulting EC signature to the device.
3. User manually enters the random seed displayed on the app screen into the device, which can now recreate the hash and recover the app's public key.
4. App is now paired via the public key.

## Synchronous Requests

Non-critical requests can be made synchronously, meaning a response is issued at the time of the request. There are several synchronous requests that are needed for making asynchronous requests - see the API section for the specific endpoints.

## Asynchronous Requests

Asynchronous requests are doubly encrypted and are associated with a unique id. Once the request is made, the requester is responsible for retrieving the response at a later moment (this can be done with `getResponse()`). The initial request looks like this:

```
{
  headers: {
    id: <string>,     // Unique request id, provided with the token
    priority: <int>,  // 1 for non-interactive requests, 2 otherwise
  },
  body: <string>      // Formatted request (formatting done via SDK)      
}
```

Before sending the request, the `body` key should be used to encrypt the `body` and the `header` key should be used to encrypt the entire, stringified JSON object. The header key is retrievable with `getHeaderKey()` and the body key is the unencrypted payload from `getToken()` (i.e. it is the access token).

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

#### getToken(pubKey, cb)

*Get a token corresponding to the public key provided. This token can be used to make a call to the k81. It is encrypted with the key provided. It is only valid for one successful call.*

**cb** `([Error], [object])`:
```
{
  id: <string>,      // Unique id mapping to the token, not encrypted
  token: <string>    // Token to use with request, encrypted with pubKey provided
}
```

#### getResponse(id, cb)
*Get the response of a pending request, identified by id*

**id** `[String]`: The id of the request. This is the keccak256 hash of the encrypted token payload (see: `getToken()`)

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
}
```

**cb**: returns `(err [Error])`

**response**:

## Requests

All requests are sent through the `request()` endpoint. They must be formatted according to the specification defined in `Sending a Request` above.

### request(req, cb)

Where `req` is an encrypted, stringified JSON object as specified above.

**cb** returns `(success [bool])` - true if the request was queued, false if the request was rejected

#### checkRequest(opts, cb)

*Check on a pending request correpsonding to your public key.*

**NOTE**: if no id+sig is provided, the oldest pending request will be checked and the response returned, if available.
**NOTE**: a response is purged from the cache once it is returned, meaning you can only request it once!

**opts** `object`:

```
{
  pubKey: <string>,
  id: <string>,        // [optional] Unique id of request
  sig: {               // [optional] Signature of the id with your private key
    v: <int>,
    r: <string>,
    s: <string>
  }
}
```

**cb** `object`:

```
{
  id: <string>,                 // Same id as specified in the request
  status: <int>,                // Status of request
  statusMessage: <string>,      // Explanation of status, if applicable
  data: <string>                // Encrypted response data, if applicable
}
```

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




=============================================================================================================
OLD/REFERENCE

### removePairing(ts, sig, cb)

*An app may delete its pairing with a signature on a pre-determined piece of data.
This data will be publicly available, but for now it can be thought of as the
hash of `"delete"`.*

**ts** `<int>`:

UNIX timestamp (seconds since epoch), which must be <24 hours old. This is the data to be signed.

**sig** `<object>`:
```
{                    // signature on keccak256(ts)
  v: <uint>,         // 27 or 28
  r: <string>,
  s: <string>
}
```
**cb**: returns `(err <Error>, reqId <string>)`



### deletePermission(opts, cb)

*Delete a permission given an index for a specified pairing*

**opts** `<object>`:
```
{
  'index': <int>,     // index of permission for the pairing (see: getPermissions)
  'sig': {
    'v': <int>,       // 27 or 28
    'r': <string>,
    's': <string>
  }
}
```


### checkPairingRequest(id, cb)

*Check the status of a pairing request.*

**id** `<int>`: id of pairing request returned from `addPairing`

**cb** `(<Error>, <Status>)`

***Error codes:***

* `1` - no record of request id

***Status codes:***

* `1` - pairing successfully added
* `2` - pairing failed manual authorization
* `3` - pairing still pending manual authorization



## Signature requests

### requestPermissionedSig(opts, cb)

*Request a signature on a piece of data, referencing a particular permission.*

**opts** `<object>`:
```
{
  'permissionIndex': <bool>   // Index of relevant permission for requesting app
  'schema': <string>          // same as addPermission()
  'type': <string>            // same as addPermission()
  'data': <array>             // array of the parameters to be signed. All values must be filled in or an invalid signature may result.
  'sig': <object>             // v,r,s parameters of signature on concatenated schema+type+data
}
```

**cb** `(<Error>, <string>)`

Callback either an error or a `signatureRequestId` (64 byte hash, hex), which is valid for 48 hours.

***Error codes:***

* `1` - data did not conform to schema + type definition
* `2` - no corresponding permission (only occurs if `permissioned == true`)
* `3` - error recovering requester signature
* `4` - requester not paired
* `5` - rule violated
* `6` - time limit violated

## General Requests

### getResponse(opts, cb)

*Check the status of a signature request.*

**opts** `<object>`:
```
{
  'id': <string>        // Request id to check
  'sig': {              // Signature of keccak256(id)
    'v': <int>,
    'r': <string>,
    's': <string>
  }
}
```

**cb** `(<Error>, <Status>, sig <string>)`

***Error codes:***

* `1` - no record of request id

***Status codes:***

* `1` - request successfully made - signature attached
* `2` - request failed manual authorization
* `3` - request still pending manual authorization

***sig:***

The raw signature, encrypted in the paired requesters public key. This is only
included with signature request responses
