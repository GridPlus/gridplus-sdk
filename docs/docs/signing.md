---
id: "signing"
sidebar_position: 3
---

# 🧾 Signing Transactions and Messages

The Lattice1 is capable of signing messages on supported curves. For certain message types, it is capable of decoding and displaying the requests in more readable ways.

# ✍️ General Signing

***This new signing mode was introduced Lattice firmare `v0.14.0`. GridPlus plans on deprecating the legacy signing mode and replacing it with general signing decoders. This document will be updated as that happens.***

You should import `Constants` when using general signing:

```ts
import { Constants } from `gridplus-sdk`
```

## 🖊️ Requesting Signatures

General signing allows you to request a signature on any message from a private key derived on any supported curve. Some curves (e.g. `secp256k1`) require a hashing algorithm to be specified in order to hash the message before signing. Other curves (e.g. `ed25519`) do not expect hashed messages prior to signing.

| Param | Location in `Constants` | Options | Description |
|:------|:------------------------|:--------|:------------|
| Curve | `Constants.SIGNING.CURVES` | `SECP256K1`, `ED25519` | Curve on which to derive the signer's private key |
| Hash | `Constants.SIGNING.HASHES` | `KECCAK256`, `SHA256`, `NONE` | Hash to use prior to signing. Note that `ED25519` requires `NONE` as messages are not prehashed. |

### Example: using generic signing

```ts
const msg = "I am the message to sign"
const req = {
  signerPath: [
    0x80000000 + 44,
    0x80000000 + 60,
    0x80000000,
  ]
  curveType: Constants.SIGNING.CURVES.SECP256K1,
  hashType: Constants.SIGNING.HASHES.KECCAK256,
  payload: msg
};

const sig = await client.sign(req)
```

## 📃 Message Decoders

By default, the message will be displayed on the Lattice's screen in either ASCII or hex -- if the message contains only ASCII, it will be displayed as such; otherwise it will get printed as a hex string. This means the Lattice can produce a signature for any message you like. However, there are additional decoders that make the request more readable on the Lattice. These decoders can be accessed inside of `Constants`:

```ts
const encodings = Constants.SIGNING.ENCODINGS
```

| Encoding | Description |
|:---------|:------------|
| `NONE` | Can also use `null` or not specify the `encodingType`. Lattice will display either an ASCII or a hex string depending on the payload. |
| `SOLANA` | Used to decode a Solana transaction. Transactions that cannot be decoded will be rejected. |
| `EVM` | Used to decode an EVM contract function call. May also be combined with ABI encoding data. To deploy a contract, set `to` as `null`. |

If you do not wish to specify a decoder, you can leave this field empty and the message will display either as ASCII or a hex string on the device.

### Example: Using the EVM Decoder
```ts
const tx = EthTxFactory.fromTxData(txData, { common: req.common });
const req = {
  signerPath: [   // Derivation path of the first requested pubkey
    0x80000000 + 44,
    0x80000000 + 60,
    0x80000000,
    0,
    0
  ]
  curveType: Constants.SIGNING.CURVES.SECP256K1,
  hashType: Constants.SIGNING.HASHES.KECCAK256,
  encodingType: Constants.SIGNING.ENCODINGS.EVM,
  payload: tx.getMessageToSign(false), // Pass serialized transaction
};

const sig = await client.sign(req)
```

### Example: Using the Solana Decoder

```ts
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

## 💾 Calldata Decoding

> NOTE: All available calldata decoding options will be documented in this section. More may be added as time goes on.

Certain transaction decoder types may support calldata decoding for request data. You can use this feature by including "calldata decoder data" (explained shortly) in a general signing request using the `decoder` request param:

```ts
req.data = {
  payload: <Raw message to be signed, e.g. serialized transaction>,
  decoder: <Optional serialized information about decoding the payload>
}
await client.sign(req);
```

If you include a valid calldata decoder, the appearance of the transaction's data on the user's Lattice should transform from a raw hex string to a markdown-style version which displays the function name, parameter names, and values.

### 1️⃣ EVM Calldata Decoding

EVM transactions serialize calldata according to the [Ethereum ABI specification](https://docs.soliditylang.org/en/latest/abi-spec.html). The first four bytes of a transaction's `data` represent the "function selector", which is (sort of) a unique identifier for a given function. 

> NOTE: We do not support 100% of all edge cases in the ABI specification, but we do support the vast majority of types.  Please open a pull request or an issue if your request fails to decode on a Lattice.

We expose a method `Utils.fetchCalldataDecoder`, which will attempt to search [Etherscan](https://etherscan.io) (or the relevant clone, depending on `chainId`) for the function definition. If none is found it will try [4byte](https://4byte.directory) instead. If a function definition is found, `fetchCalldataDecoder` will parse and serialize it for the Lattice. `fetchCalldataDecoder` will return `{ abi, def }` and you will need to pass `def` into the signing request.

> NOTE: `fetchCalldataDecoder` takes in params `(tx.input, tx.to, tx.chainId, shouldRecurse)`. The first 3 come from the transaction object (note that `chainId` must be a regular integer), while `shouldRecurse` is used to flag whether to look up nested definitions, as is typical with contract patterns like `multicall`. You can only use `shouldRecurse` with Lattice firmware v0.16.0 and above.

#### Example Usage (see `test/signing/evm-abi.ts` for more examples)

```ts
import { Calldata, Utils } from 'gridplus-sdk';
const EVMCalldata = Calldata.EVM;
const tx = {an @ethereumjs/tx object}

// Get the decoder data. This will attempt to look up an ABI using Etherscan
// and, if that fails, 4byte.directory.
// Arguments are: [`data`, `to`, `chainId`, recurse]
// NOTE: Setting `recurse = true` may result in additional requests. It is 
// used for nested contract patterns such as `multicall`. It is only suppored
// by Lattice firmware v0.16.0 and up.
const { def } = await Utils.fetchCalldataDecoder(tx.input, tx.to, tx.chainId, true);
// Add the decoder to the request and the transaction should get marked down
const req = {
  signerPath,
  curveType: Constants.SIGNING.CURVES.SECP256K1,
  hashType: Constants.SIGNING.HASHES.KECCAK256,
  encodingType: Constants.SIGNING.ENCODINGS.EVM,
  payload: tx.getMessageToSign(false), // will serialize the transaction
  decoder: def
};
const sig = await client.sign(req)
```

# 📜 Legacy Signing

Prior to general signing, request data was sent to the Lattice in preformatted ways and was used to build the transaction in firmware. We are phasing out this mechanism, but for now it is how you request Ethereum, Bitcoin, and Ethereum-Message signatures. These signing methods are accessed using the `currency` flag in the request data.

## Ξ Ethereum (Transaction)

All six Ethereum transactions must be specified in the request data along with a signer path.

*Example: requesting signature on Ethereum transaction*

```ts
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

## Ξ Ethereum (Message)

Two message protocols are supported for Ethereum: `personal_sign` and `sign_typed_data`.

#### `personal_sign`

This is a protocol to display a simple, human readable message. It includes a prefix to avoid accidentally signing sensitive data. The message included should be a string.

**`protocol` must be specified as `"signPersonal"`**.

#### Example: requesting signature on Ethereum `personal_sign` message

```ts
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

### `sign_typed_data`

This is used in protocols such as EIP712. It is meant to be an encoding for JSON-like data that can be more human readable.

> NOTE: Only `sign_typed_data` V3 and V4 are supported.

**`protocol` must be specified as `"eip712"`**.

```ts
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

## ₿ Bitcoin

Bitcoin transactions can be requested by including a set of UTXOs, which include the signer derivation path and spend type. The same `purpose` values are used to determine how UTXOs should be signed:

* If `purpose = 44'`, the input will be signed with p2pkh
* If `purpose = 49'`, the input will signed with p2sh-p2wpkh
* If `purpose = 84'`, the input will be signed with p2wpkh

The `purpose` of the `signerPath` in the given previous output (a.k.a. UTXO) is used to make the above determination.

### Example: requesting BTC transactions

```ts
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
