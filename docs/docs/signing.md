---
id: "signing"
sidebar_position: 3
---

# 🧾 Signing Messages

The Lattice1 is capable of signing messages (e.g. Ethereum transactions) on supported elliptic curves. For certain message types, Lattice firmware is capable of decoding and displaying the requests in more readable ways. All requests must include a **derivation path** and must be made against the **current active wallet** on the target Lattice; if a [SafeCard](https://gridplus.io/safe-cards) is inserted and unlocked, it is considered the active wallet.

# ✍️ General Signing

:::info
General signing was introduced Lattice firmare `v0.14.0`. GridPlus plans on deprecating the legacy signing mode and replacing it with corresponding [Encoding Types](#encoding-types). This document will be updated as that happens.
:::

General signing allows you to request a signature on **any message** from a private key derived on **any supported curve**. You will need to specify, at a minimum, a `Curve` and a `Hash` for your signing request. Options can be found in [`Constants`](./api/modules/constants#external):

```ts
import { Constants } from `gridplus-sdk`
```

:::note
Some curves (e.g. `SECP256K1`) require a hashing algorithm to be specified so that Lattice firmware can hash the message before signing. Other curves (e.g. `ED25519`, `BLS12_381_G2`) hash the message as part of the signing process and require `curveType=NONE`.
:::

| Param | Location in `Constants` | Options | Description |
|:------|:------------------------|:--------|:------------|
| Curve | `Constants.SIGNING.CURVES` | `SECP256K1`, `ED25519`, `BLS12_381_G2` | Curve on which to derive the signer's private key |
| Hash | `Constants.SIGNING.HASHES` | `KECCAK256`, `SHA256`, `NONE` | Hash to use prior to signing. Note that `ED25519` and `BLS12_381_G2` require `NONE` as messages cannot be prehashed. |

### Example: General Signing

```ts
const msg = "I am the captain now"
const req = {
  signerPath: [ 0x80000000 + 44, 0x80000000 + 60, 0x80000000, ];
  curveType: Constants.SIGNING.CURVES.SECP256K1,
  hashType: Constants.SIGNING.HASHES.KECCAK256,
  payload: msg
};
const sig = await client.sign(req)
```


## 📃 Encoding Types

You may specify an **Encoding Type** in your signing request if you want the message to render in a **formatted** way, such as for an EVM transaction. If no Message Decoder is specified, the message will be displayed on the Lattice in full as either a hex or ASCII string, depending on the contents of the message. If you do specify an `encodingType`, the message **must** conform to its format (e.g. EVM transaction) or else Lattice firmware will reject the request. 

Encoding Types can be accessed inside of `Constants`:

```ts
const encodings = Constants.SIGNING.ENCODINGS;
```

| Encoding | Description |
|:---------|:------------|
| `NONE` | Can also use `null` or not specify the `encodingType`. Lattice will display either an ASCII or a hex string depending on the payload. |
| `EVM` | Used to decode an EVM contract function call. To deploy a contract, set `to` as `null`. |
| `SOLANA` | Used to decode a Solana transaction. Transactions that cannot be decoded will be rejected. |

### Example: EVM Encoding

```ts
// Create an `@ethereumjs/tx` object. Contents of `txData` are out of scope
// for this example.
import { TransactionFactory } from '@ethereumjs/tx';
const tx = TransactionFactory.fromTxData(txData, { common: req.common });
// Full, serialized EVM transaction
const msg = tx.getMessageToSign(false);

// Build the request with the EVM encoding
const req = {
  signerPath: [0x80000000 + 44, 0x80000000 + 60, 0x80000000, 0, 0],
  curveType: Constants.SIGNING.CURVES.SECP256K1,
  hashType: Constants.SIGNING.HASHES.KECCAK256,
  encodingType: Constants.SIGNING.ENCODINGS.EVM,
  payload: msg,
};
const sig = await client.sign(req)
```

### Example: SOLANA Encoding

```ts
// Setup the Solana transaction using `@solana/web3.js`.
// The specifics are out of scope for this example.
import { Transaction, SystemProgram } from '@solana/web3.js';
const transfer = SystemProgram.transfer({
  fromPubkey: "...",
  toPubkey: "...",
  lamports: 1234,
})
const recentBlockhash = "...";
const tx = new Transaction({ recentBlockhash }).add(transfer);
// Full, serialized Solana transaction
const msg = tx.compileMessage().serialize();

// Build the request with the SOLANA encoding
const req = {
  signerPath: [0x80000000 + 44, 0x80000000 + 60, 0x80000000],
  curveType: Constants.SIGNING.CURVES.ED25519,
  hashType: Constants.SIGNING.HASHES.NONE,
  encodingType: Constants.SIGNING.ENCODINGS.SOLANA,
  payload: msg
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
    signerPath: [0x80000000 + 44, 0x80000000 + 60, 0x80000000, 0, 0],
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
    signerPath: [0x80000000 + 44, 0x80000000 + 60, 0x80000000, 0, 0],
    protocol: 'signPersonal' // You must use this string to specify this protocol
    payload: 'my message to sign'
  }
}

const sig = await client.sign(reqData)
```

### `sign_typed_data`

This is used in protocols such as [EIP712](https://eips.ethereum.org/EIPS/eip-712). It is meant to be an encoding for JSON-like data that can be more human readable.

:::note
Only `sign_typed_data` V3 and V4 are supported.
:::

**`protocol` must be specified as `"eip712"`**.

```ts
const message = {
  hello: 'i am a message',
  goodbye: 1
}
const reqData = {
  currency: 'ETH_MSG',
  data: {
    signerPath: [0x80000000 + 44, 0x80000000 + 60, 0x80000000, 0, 0],
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
    signerPath: [0x80000000 + 84, 0x80000000, 0x80000000, 0, 12],
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
    changePath: [0x80000000 + 84, 0x80000000, 0x80000000, 1, 0],
  }
}

const sig = await client.sign(reqData)
```
