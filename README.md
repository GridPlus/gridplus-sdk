![image](https://user-images.githubusercontent.com/7378490/156425132-232af539-63d9-4dc5-8a6c-63c7bda20125.png)

# GridPlus Lattice1 SDK

* **For full API docs, see [this](https://gridplus.github.io/gridplus-sdk)**
* **For Lattice docs, see [this](https://docs.gridplus.io)**

This SDK is designed to facilitate communication with a user's [Lattice1 hardware wallet](https://gridplus.io/lattice). Once paired to a given Lattice, an instance of this SDK is used to make encrypted requests for things like getting addresses/public keys and making signatures.

The Lattice1 is an internet connected device which listens for requests and fills them in firmware. Web requests originate from this SDK and responses are returned asynchronously. Some requests require user authorization and may time out if the user does not approve them.

# 🎬 Getting Started

First install this SDK with:

```
npm install --save gridplus-sdk
```

To connect to a Lattice, you need to create an instance of `Client`:

```
import { Client } from 'gridplus-sdk'
```

You can use the following options:

| Param | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `name` | string | Y | A human readable name for your app. This will be displayed with your app's pairing on the user's Lattice. |
| `privKey` | `Buffer` | N | 32-byte buffer, not required but highly recommended. If none is specified, a random one will be created at initialization. This is used to build the encrypted channel. If you want to manually restart a connection with a new `Client` instance, you will need to use the same `privKey` in the constructor. |
| `retryCount` | number | N | Default is 3. Number of automatic retries allowed per request. Covers timeouts and certain device errors. |
| `timeout` | number | N | Milliseconds to timeout HTTP request. Defaults to 60s. |
| `stateData` | string | N | Used to rehydrate a session without other params. Result of call to `getStateData()`. |

## 🔗 Connecting to a Lattice

Once `Client` is initialized, you need to connect to the target Lattice. This can happen one of three ways:

#### 1️⃣ Pairing with a new Lattice

If you have not setup a pairing with the Lattice in question, you will need to do that first.

1. Call `connect` with the `deviceId` of the target Lattice
2. The Lattice should generate and display a pairing code, valid for 60 seconds. Call `pair` with this code.
3. If successful, you should now have a pairing between the SDK and the Lattice. This pairing maintains an encrypted channel. If that ever gets out of sync, it should repair automatically with a retry.

*Example: pairing with a Lattice*
```
const isPaired = await client.connect(deviceID)
if (!isPaired) {
  // Wait for the user to enter the pairing secret displayed on the device  
  const secret = await question('Enter pairing secret: ')
  await client.pair(secret)
}
```

#### 2️⃣ Connecting to a known Lattice

If the Lattice in question already has a pairing with your app (and therefore a recoverable encrypted channel), the connection process is easy.

1. Call `connect` with the `deviceId` of the target Lattice

*Example: connecting to a known Lattice*
```
const isPaired = await client.connect(deviceID)

expect(isPaired).to.equal(true)
```

#### 3️⃣ Rehydrating an SDK session

You can always start a new SDK session with the same `privKey` in the constructor, which will always build an encrypted channel when you call `connect` on a paired Lattice. However, you can skip this step by exporting state data and then using that in the constructor. First you need to get the state data before you stop using the connection.

*Example: drying and rehydrating a client session*
```
// Fetch some addresses from existing client
const addrs1 = await client.getAddresses(addrReqData)

// Capture the state data from that client
const stateData = client.getStateData()

// Create a new client with the state data
const clientDos = new Client({ stateData })

// You can now call this without connecting
const addrs2 = await clientDos.getAddresses(addrReqData)

// The addresses should match and there should be no errors
expect(addrs1).to.equal(addrs2)
```

# 🔑 Addresses and Public Keys

Once your `Client` instance is connected, you can request a few different address and key types from the Lattice.

> Note: this section uses the following notation when discussing BIP32 derivation paths: `[ purpose, coin_type, account, change, address ]`. It also uses `'` to represent a "hardened", index, which is just `0x80000000 + index`.

### Ξ Ethereum-type addresses

These addresses are 20-byte hex strings prefixed with `0x`. Lattice firmware places some restrictions based on derivation path, specifically that the `coin_type` must be supported (Ethereum uses coin type `60'`).

In practice, most apps just use the standard Ethereum `coin_type` (`60'`) when requesting addresses for other networks, but we do support some others (a vestige of an integration -- you probably won't ever need to use these): 

> `966', 700', 9006', 9005', 1007', 178', 137', 3731', 1010', 61', 108', 40', 889', 1987', 820', 6060', 1620', 1313114', 76', 246529', 246785', 1001', 227', 916', 464', 2221', 344', 73799', 246'`

Keep in mind that changing the `coin_type` will change all the requested addresses relative to Ethereum. This is why, in practice, most apps just use the Ethereum path.

*Example: requesting Ethereum addresses*

```
const reqData = {
 startPath: [   // Derivation path of the first requested address
   0x80000000 + 44,
   0x80000000 + 60,
   0x80000000,
   0,
   0,
 ],
 n: 5,          // Number of sequential addresses on specified path to return (max 10)
};

const addrs = await client.getAddresses(reqData);
```

### ₿ Bitcoin addresses

The Lattice can also export Bitcoin formatted addresses. There are three types of addresses that can be fetched and the type is determined by the `purpose` index of the BIP32 derivation path.

* If `purpose = 44'`, *legacy* addresses (beginning with `1`) will be returned
* If `purpose = 49'`, *wrapped segwit* addresses (beginning with `3`) will be returned
* If `purpose = 84'`, *segwit v1* addresses (beginning with `bc1`) will be returned

Keep in mind that `coin_type` `0'` is required when requesting BTC addresses.

*Example: requesting BTC segwit addresse*

```
const reqData = {
 startPath: [   // Derivation path of the first requested address
   0x80000000 + 84,
   0x80000000,
   0x80000000,
   0,
   0,
 ]
};

// `n` will be set to 1 if not specified -> 1 address returned
const addr0 = await client.getAddresses(reqData);
```

### 🗝️ Public Keys

In addition to formatted addresses, the Lattice can return public keys on any supported curve for any BIP32 derivation path.

> Note: Currently the derivation path must be at least 2 indices deep, but this restriction may be removed in the future.

For requesting public keys it is best to import `Constants` with:

```
import { Client, Constants } from 'gridplus-sdk'
```

#### 1️⃣ `secp256k1` curve

Used by Bitcoin, Ethereum, and most blockchains.

**Pubkey size: 65 bytes**

The public key has two 32 byte components and is of format: `04{X}{Y}`, meaning every public key is prefixed with a `04` byte.

*Example: requesting secp256k1 public key*

```
const req = {
  startPath: [   // Derivation path of the first requested pubkey
    0x80000000 + 44,
    0x80000000 + 60,
    0x80000000,
    0,
    0,
  ],
  n: 3,
  flag: Constants.GET_ADDR_FLAGS.SECP256K1_PUB,
};

const pubkeys = await client.getAddresses(req);
```

> NOTE: since `startPath` is the same, this example returns public keys which can be converted to Ethereum addresses to yield the same result as the above request to fetch Ethereum addresses.

#### 2️⃣ `ed25519` curve

Used by Solana and a few others. ***Ed25519 requires all derivation path indices be hardened.***

**Pubkey size: 32 bytes**

> NOTE: Some libraries prefix these keys with a `00` byte (making them 33 bytes), but we do **not** return keys with this prefix.

```
const req = {
  startPath: [   // Derivation path of the first requested pubkey
    0x80000000 + 44,
    0x80000000 + 60,
    0x80000000,
  ],
  n: 3,
  flag: Constants.GET_ADDR_FLAGS.ED25519_PUB,
};

const pubkeys = await client.getAddresses(req);
```

# 🧾 Signing Transactions and Messages

The Lattice1 is capable of signing messages on supported curves. For certain message types, it is capable of decoding and displaying the requests in more readable ways.

## ✍️ General Signing

***This new signing mode was introduced Lattice firmare `v0.14.0`. GridPlus plans on deprecating the legacy signing mode and replacing it with general signing decoders. This document will be updated as that happens.***

You should import `Constants` when using general signing:

```
import { Constants } from `gridplus-sdk`
```

### 🖊️ Requesting Signatures

General signing allows you to request a signature on any message from a private key derived on any supported curve. Some curves (e.g. `secp256k1`) require a hashing algorithm to be specified in order to hash the message before signing. Other curves (e.g. `ed25519`) do not expect hashed messages prior to signing.

| Param | Location in `Constants` | Options | Description |
|:------|:------------------------|:--------|:------------|
| Curve | `Constants.SIGNING.CURVES` | `SECP256K1`, `ED25519` | Curve on which to derive the signer's private key |
| Hash | `Constants.SIGNING.HASHES` | `KECCAK256`, `SHA256`, `NONE` | Hash to use prior to signing. Note that `ED25519` requires `NONE` as messages are not prehashed. |

*Example: using generic signing*

```
const msg = "I am the message to sign"
const req = {
  signerPath: [
    0x80000000 + 44,
    0x80000000 + 60,
    0x80000000,
  ]
  curveType: Constants.SIGNING.CURVES.ED25519,
  hashType: Constants.SIGNING.HASHES.NONE,
  payload: msg
};

const sig = await client.sign(req)
```

### 📃 Message Decoders

By default, the message will be displayed on the Lattice's screen in either ASCII or hex -- if the message contains only ASCII, it will be displayed as such; otherwise it will get printed as a hex string. This means the Lattice can produce a signature for any message you like. However, there are additional decoders that make the request more readable on the Lattice. These decoders can be accessed inside of `Constants`:

```
const encodings = Constants.SIGNING.ENCODINGS
```

| Encoding | Description |
|:---------|:------------|
| `NONE` | Can also use `null` or not specify the `encodingType`. Lattice will display either an ASCII or a hex string depending on the payload. |
| `SOLANA` | Used to decode a Solana transaction. Transactions that cannot be decoded will be rejected. See `test/testGeneric.ts` for an example. |
| `TERRA` | Used to decode a Terra transaction. Only `MsgSend`, `MsgMultiSend`, and `MsgExecuteContract` are supported, but any transaction with unsupported message types will still decode -- the message type and calldata will be displayed raw. |

If you do not wish to specify a decoder, you can leave this field empty and the message will display either as ASCII or a hex string on the device.

*Example: using the Solana decoder*

```
const msg = solTx.compileMessage().serialize()
const req = {
  signerPath: [   // Derivation path of the first requested pubkey
    0x80000000 + 44,
    0x80000000 + 60,
    0x80000000,
  ]
  curveType: Constants.SIGNING.CURVES.ED25519,
  hashType: Constants.SIGNING.HASHES.NONE,
  encodingType: Constants.SIGNING.ENCODINGS.SOLANA,
  payload: msg
};

const sig = await client.sign(req)
```

### 💾 Calldata Decoding

> NOTE: all available calldata decoding options will be documented in this section. More may be added as time goes on.

Certain transaction decoder types may support calldata decoding for request data. You can use this feature by including "calldata decoder data" (explained shortly) in a general signing request using the `decoder` request param:

```
req.decoder = <calldata decoder data>
await client.sign(req);
```

If you include a valid calldata decoder, the appearance of the transaction's data on the user's Lattice should transform from a raw hex string to a markdown-style version which displays the function name, parameter names, and values.

**Storing Calldata Decoders**

Although not necessary, in certain situations it may be advantageous to pre-save decoders to the Lattice. One advantage is that if the decoder is saved, you do not need to include it in the transaction request, which frees up some space. Additionally, pre-saving data may unlock certain security features depending on the decoder type.

You can use the following API:

> Please see API docs for all options. Also see tests in `test/signing/evm.ts` for examples on usage.

* `addDecoders`: Allows the user to add a series of calldata decoders for a specific decoder type (e.g. EVM). This will prompt the user to approve these decoders on the target Lattice before returning success.
* `getDecoders`: Fetch `n` consecutive decoders for a specific type, starting a specific index.
* `removeDecoders`: Remove a set of included decoders for a specific type. You can also set a flag to remove all decoders for a specific type.

#### 1️⃣  EVM

EVM transactions serialize calldata according to the [Ethereum ABI specification](https://docs.soliditylang.org/en/latest/abi-spec.html). The first four bytes of a transaction's `data` represent the "function selector", which is (sort of) a unique identifier for a given function. You can build the calldata decoder data by either parsing a [Solidity JSON ABI](https://docs.ethers.io/v5/api/utils/abi/formats/#abi-formats--solidity) object (which you can fetch from [Etherscan](https://etherscan.io)) or by parsing an ABI canonical name (you can get this from [4byte](https://www.4byte.directory)). *Using the Solidity JSON ABI is recommended*.

> Note: We do not support 100% of all edge cases in the ABI specification, but we do support the vast majority of types.  Please open a pull request or an issue if your request fails to decode on a Lattice.

Example Usage (see `test/signing/evm.ts` for more examples):

```
import { Calldata } from 'gridplus-sdk';
const EVMCalldata = Calldata.EVM;

const tx = {an @ethereumjs/tx object}
const selector = tx.data.slice(0, 4).toString('hex'); // must be a hex string

// 1. Test JSON ABI object

// First get the decoder data
const abi = {a Solidity JSON ABI object fetched from Etherscan}
// Add the decoder to the request and the transaction should get marked down
const req = {
  signerPath,
  curveType: Constants.SIGNING.CURVES.SECP256K1,
  hashType: Constants.SIGNING.HASHES.KECCAK256,
  encodingType: Constants.SIGNING.ENCODINGS.EVM,
  payload: tx.getMessageToSign(false), // will serialize the transaction
  decoder: EVMCalldata.parsers.parseSolidityJSONABI(selector, abi)
};
const sig = await client.sign(req)

// 2. Test canonical name type

const canonicalName = 'myFunction(bytes,uint256)'; // assume this is the function being used
req.decoder = EVMCalldata.parsers.parseCanonicalName(selector, canonicalName);
const sig = await client.sign(req)
```

**Param Names**

There are two things to note about parameter names in EVM calldata decoding:

* The canonical name alone validates the function name and the parameter types, but it does *not* validate the parameter names (look at any canonical name and you will not find parameter names defined). This means that while we can send calldata decoder info in a request, a user cannot validate the *parameter* names unless the decoder has been pre-saved to the device. If a decoder was pre-saved, its param names will show a ✔️ icon on the decoder screen.
* Using `parseCanonicalName` will result in your decoder's param names being numerical values (#1, #2, etc) instead of the parameter names. This is because, again, the canonical name does not include parameter names. Therefore we do not recommend using `parseCanonicalName` if you have a Solidity JSON ABI object available and we definitely do not recommend *saving* decoders parsed from canonical names.




## 📜 Legacy Signing

Prior to general signing, request data was sent to the Lattice in preformatted ways and was used to build the transaction in firmware. We are phasing out this mechanism, but for now it is how you request Ethereum, Bitcoin, and Ethereum-Message signatures. These signing methods are accessed using the `currency` flag in the request data.

### Ξ Ethereum (Transaction)

All six Ethereum transactions must be specified in the request data along with a signer path.

*Example: requesting signature on Ethereum transaction*
```
const txData = {
  nonce: '0x02',
  gasPrice: '0x1fe5d61a00',
  gasLimit: '0x034e97',
  to: '0x1af768c0a217804cfe1a0fb739230b546a566cd6',
  value: '0x01cba1761f7ab9870c',
  data: '0x17e914679b7e160613be4f8c2d3203d236286d74eb9192f6d6f71b9118a42bb033ccd8e8',
}

const reqData = {
  currency: 'ETH',
  data: {
    signerPath: [
      0x80000000 + 44,
      0x80000000 + 60,
      0x80000000,
      0,
      0,
    ],
    ...txData,
    chain: 5, // Defaults to 1 (i.e. mainnet)
  }
}

const sig = await client.sign(reqData)
```

### Ξ Ethereum (Message)

Two message protocols are supported for Ethereum: `personal_sign` and `sign_typed_data`.

#### `personal_sign`

This is a protocol to display a simple, human readable message. It includes a prefix to avoid accidentally signing sensitive data. The message included should be a string.

**`protocol` must be specified as `"signPersonal"`**.

*Example: requesting signature on Ethereum `personal_sign` message*
```
const reqData = {
  currency: 'ETH_MSG',
  data: {
    signerPath: [
      0x80000000 + 44,
      0x80000000 + 60,
      0x80000000,
      0,
      0,
    ],
    protocol: 'signPersonal' // You must use this string to specify this protocol
    payload: 'my message to sign'
  }
}

const sig = await client.sign(reqData)
```

#### `sign_typed_data`

This is used in protocols such as EIP712. It is meant to be an encoding for JSON-like data that can be more human readable.

> NOTE: Only `sign_typed_data` V3 and V4 are supported.

**`protocol` must be specified as `"eip712"`**.

```
const message = {
  hello: 'i am a message',
  goodbye: 1
}
const reqData = {
  currency: 'ETH_MSG',
  data: {
    signerPath: [
      0x80000000 + 44,
      0x80000000 + 60,
      0x80000000,
      0,
      0,
    ],
    protocol: 'eip712' // You must use this string to specify this protocol
    payload: message
  }
}

const sig = await client.sign(reqData)
```

### ₿ Bitcoin

Bitcoin transactions can be requested by including a set of UTXOs, which include the signer derivation path and spend type. The same `purpose` values are used to determine how UTXOs should be signed:

* If `purpose = 44'`, the input will be signed with p2pkh
* If `purpose = 49'`, the input will signed with p2sh-p2wpkh
* If `purpose = 84'`, the input will be signed with p2wpkh

The `purpose` of the `signerPath` in the given previous output (a.k.a. UTXO) is used to make the above determination.

*Example: requesting BTC transactions*
```
const p2wpkhInputs = [
  {
    // Hash of transaction that produced this UTXO
    txHash: "2aba3db3dc5b1b3ded7231d90fe333e184d24672eb0b6466dbc86228b8996112",
    // Value of this UTXO in satoshis (1e8 sat = 1 BTC)
    value: 100000,
    // Index of this UTXO in the set of outputs in this transaction
    index: 3,
    // Owner of this UTXO. Since `purpose` is 84' this will be spent with p2wpkh,
    // meaning this is assumed to be a segwit address (starting with bc1)
    signerPath: [
      0x80000000 + 84,
      0x80000000,
      0x80000000,
      0,
      12
    ]
  }
]

const reqData = {
  currency: "BTC",
  data: {
    prevOuts: p2wpkhInputs,
    // Recipient can be any legacy, wrapped segwit, or segwit address
    recipient: "1FKpGnhtR3ZrVcU8hfEdMe8NpweFb2sj5F",
    // Value (in sats) must be <= (SUM(prevOuts) - fee)
    value: 50000,
    // Fee (in sats) goes to the miner
    fee: 20000,
    // SUM(prevOuts) - fee goes to the change recipient, which is an
    // address derived in the same wallet. Again, the `purpose` in this path 
    // determines what address the BTC will be sent to, or more accurately how 
    // the UTXO is locked -- e.g., p2wpkh unlocks differently than p2sh-p2wpkh
    changePath: [
      0x80000000 + 84,
      0x80000000,
      0x80000000,
      1, // Typically the change path includes a `1` here
      0
    ]
  }
}

const sig = await client.sign(reqData)
```

# 🧪 Testing

> All functionality is tested in some script in `/test`. Please see those scripts for examples on functionality not documented in ths README.

**Testing is only possible with a development Lattice, which GridPlus does not distribute publicly. Therefore, if you do not have a development Lattice, you will not be able to run many of these tests.**

### Setting up a test connection

Only one test can be run against an unpaired Lattice: `npm run test`. Therefore this must be run before running any other tests. If you wish to run additional tests, you need to specify the following:

```
env REUSE_KEY=1 npm run test
```

The `REUSE_KEY` will save the connection locally so you can run future tests. Running this test will ask for your device ID and will go through the pairing process. After pairing, the rest of the script will test a broad range of SDK functionality.

To use the connection you've established with any test (including this initial one), you need to include your `DEVICE_ID` as an env argument:

```
env DEVICE_ID='mydeviceid' npm run test
```

### Global `env` Options

The following options can be used after `env` with any test.

| Param | Options | Description |
|:------|:--------|:------------|
| `REUSE_KEY` | Must be `1` | Indicates we will be creating a new pairing with a Lattice and stashing that connection |
| `DEVICE_ID` | A six character string | The device ID of the target Lattice |
| `name` | Any 5-25 character string (default="SDK Test") | The name of the pairing you will create |
| `baseUrl` | Any URL (default="https://signing.gridplus.io") | URL describing where to send HTTP requests. Should be changed if your Lattice is on non-default message routing infrastructure. |

### Firmware Test Runner

Several tests require dev Lattice firmware with the following flag in the root `CMakeLists.txt`:

```
FEATURE_TEST_RUNNER=1
```

See table in the next section.

### Reference: Tests and Options

This section gives an overview of each test and which options can be passed for the specific test (in addition to global options)

| Test | Description | Uses Test Runner | Additional `env` Options |
|:-----|:------------|:-----------------|:--------------|
| `npm run test` | Sets up test connection and tests basic functionality like `getAddresses` and `sign`. You need to run this with `REUSE_KEY=1` and pair before running any other tests. | No | N/A |
| `npm run test-signing` | Tests various aspects of the message signing path as well as all known decoders. | Yes | `SEED` (random string to seed a random number generator)<br/>`ETHERSCAN_KEY` (API key for making Etherscan requests. Used in EVM tests.) |
| `npm run test-btc` | *(Legacy pathway)* Tests spending different types of BTC inputs. Signatures validated against `bitcoinjs-lib` using seed exported by test harness. | Yes | `N` (number of random vectors to populate)<br/>`SEED` (random string to seed a random number generator)<br/>`testnet` (if true, testnet addresses and transactions will also be tested) |
| `npm run test-eth-msg` | *(Legacy pathway)* Tests Ethereum message requests `signPersonal` and `signTypedData`. Tests boundary conditions of EIP712 messages. | No | `N` (number of random vectors to populate)<br/>`SEED` (random string to seed a random number generator) |
| `npm run test-kv` | Tests loading and using kv (key-value) files. These are used for address tags. | No | N/A |
| `npm run test-non-exportable` | Tests to validate signatures from a SafeCards with a non-exportable seed (legacy) | No | N/A |
| `npm run test-wallet-jobs` | Tests exported addresses and public keys against those from reference libraries using seed exported by test harness. | Yes | N/A |
