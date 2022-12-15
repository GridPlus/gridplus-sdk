---
id: "addresses"
sidebar_position: 2
---

# 🔑 Addresses and Public Keys

Once your `Client` instance is connected, you can request a few different addresses and key types from the Lattice.

:::note

This section uses the following notation when discussing BIP32 derivation paths: `[ purpose, coin_type, account, change, address ]`. It also uses `'` to represent a "hardened", index, which is just `0x80000000 + index`.

:::

## Ξ Ethereum-type addresses

These addresses are 20-byte hex strings prefixed with `0x`. Lattice firmware places some restrictions based on derivation path, specifically that the `coin_type` must be supported (Ethereum uses coin type `60'`).

In practice, most apps just use the standard Ethereum `coin_type` (`60'`) when requesting addresses for other networks, but we do support some others (a vestige of an integration -- you probably won't ever need to use these): 

> `966', 700', 9006', 9005', 1007', 178', 137', 3731', 1010', 61', 108', 40', 889', 1987', 820', 6060', 1620', 1313114', 76', 246529', 246785', 1001', 227', 916', 464', 2221', 344', 73799', 246'`

Keep in mind that changing the `coin_type` will change all the requested addresses relative to Ethereum. This is why, in practice, most apps just use the Ethereum path.

### Example: requesting Ethereum addresses

```ts
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

## ₿ Bitcoin addresses

The Lattice can also export Bitcoin formatted addresses. There are three types of addresses that can be fetched and the type is determined by the `purpose` index of the BIP32 derivation path.

* If `purpose = 44'`, *legacy* addresses (beginning with `1`) will be returned
* If `purpose = 49'`, *wrapped segwit* addresses (beginning with `3`) will be returned
* If `purpose = 84'`, *segwit v1* addresses (beginning with `bc1`) will be returned

Keep in mind that `coin_type` `0'` is required when requesting BTC addresses.

### Example: requesting BTC segwit addresses

```ts
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

## 🗝️ Public Keys

In addition to formatted addresses, the Lattice can return public keys on any supported curve for any BIP32 derivation path.

:::note
Currently the derivation path must be at least 2 indices deep, but this restriction may be removed in the future.
:::

For requesting public keys it is best to import `Constants` with:

```ts
import { Client, Constants } from 'gridplus-sdk'
```

### 1️⃣ `secp256k1` curve

Used by Bitcoin, Ethereum, and most blockchains.

**Pubkey size: 65 bytes**

The public key has two 32 byte components and is of format: `04{X}{Y}`, meaning every public key is prefixed with a `04` byte.

#### Example: requesting secp256k1 public key

```ts
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

:::note
Since `startPath` is the same, this example returns public keys which can be converted to Ethereum addresses to yield the same result as the above request to fetch Ethereum addresses.
:::

### 2️⃣ `ed25519` curve

Used by Solana and a few others. ***Ed25519 requires all derivation path indices be hardened.***

**Pubkey size: 32 bytes**

:::note
Some libraries prefix these keys with a `00` byte (making them 33 bytes), but we do **not** return keys with this prefix.
:::

```ts
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
