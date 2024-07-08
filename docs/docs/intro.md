---
id: 'index'
title: '👋 Getting Started'
slug: '/'
sidebar_position: 0
custom_edit_url: null
---

# GridPlus SDK

The [GridPlus SDK](https://github.com/GridPlus/gridplus-sdk) is the bridge between software wallets, like MetaMask or Frame, and the [Lattice1 hardware wallet](https://gridplus.io/lattice).

:::note
The [Lattice1](https://gridplus.io/lattice) is an Internet-connected device which listens for end-to-end encrypted requests. HTTPS requests originate from this SDK and responses are returned **asynchronously**. Some requests require user authorization and will time out if the user does not approve them.
:::

## Getting Started

### Installation

Install the package with your package manager. For example, with npm:

```sh
npm install --save gridplus-sdk
```

### Connecting to a Lattice

To initiate the connection, you'll call `setup`. This function takes an object with the following properties:

- `name` - the name of the wallet or app you're connecting from, e.g. `MetaMask`
- `deviceId` - the device ID of the Lattice you're connecting to
- `password` - an arbitrary string that is used to encrypt/decrypt data for transport
- `getStoredClient` - a function that returns the stored client data
- `setStoredClient` - a function that stores the client data

#### Setup Example

`setup()` will return a `boolean` that tells you whether the device has already been paired. If it has not, you will need to pair the device by calling `pair()`.

```ts
import { setup } from 'gridplus-sdk';

const isPaired = await setup({
  name: 'My Wallet',
  deviceId: 'XXXXXX',
  password: 'password',
  getStoredClient: () => localStorage.getItem('client'),
  setStoredClient: (client) => localStorage.setItem('client', client),
});
```

### Pairing

To pair the device with your application, you'll call `pair` with the pairing code displayed on the Lattice screen. This code is a 6-digit number that is displayed on the Lattice screen when you attempt to connect to it.

#### Pairing Example

`pair()` also returns a `boolean` that tells you whether the pairing was successful.

```ts
import { pair } from 'gridplus-sdk';

const isPaired = await pair('123456');
```

### Fetching Addresses

Once you're connected to the Lattice, you can fetch addresses from it. This is done by calling `fetchAddresses()`.

#### Fetch Addresses Example

`fetchAddresses()` returns an array of addresses.

```ts
import { fetchAddresses } from 'gridplus-sdk';

const addresses = await fetchAddresses();
```

By default, this function returns the first 10 addresses at the standard EVM derivation path. You can specify the number of addresses you want to fetch by passing a number as an argument to `fetchAddresses()`.

```ts
const addresses = await fetchAddresses(5);
```

If you're working with another blockchain, you can specify the derivation path by passing an object as an argument to `fetchAddresses()` that has the key of `startPath` which is an array that represents the derivation path.

:::note
The derivation path is an array of integers that represents the path to the address you want to fetch. The first element of the array is the purpose, the second is the coin type, the third is the account index, the fourth is the change index, and the fifth is the address index.

Also, some values will need to be "hardened" by adding 0x80000000 to them. For example, the purpose for Ethereum is `44`, so the hardened value would be `44 + 0x80000000 = 2147483692`. This library exports a constant of `HARDENED_OFFSET` which is `0x80000000` for your convenience.
:::

```ts
// default EVM
const addresses = await fetchAddresses({
  startPath: [
    HARDENED_OFFSET + 44,
    HARDENED_OFFSET + 60,
    HARDENED_OFFSET,
    0,
    0,
  ],
});

// Legacy BTC
const addresses = await fetchAddresses({
  startPath: [HARDENED_OFFSET + 44, HARDENED_OFFSET + 0, HARDENED_OFFSET, 0, 0],
});

// Segwit BTC
const addresses = await fetchAddresses({
  startPath: [HARDENED_OFFSET + 84, HARDENED_OFFSET, HARDENED_OFFSET, 0, 0],
});
```

The library also exports convenience functions for fetching addresses for specific derivation paths:

```ts
import {
  fetchBtcLegacyAddresses,
  fetchBtcSegwitAddresses,
  fetchBtcWrappedSegwitAddresses,
  fetchSolanaAddresses,
} from 'gridplus-sdk';

const btcLegacyAddresses = await fetchBtcLegacyAddresses();
const btcSegwitAddresses = await fetchBtcSegwitAddresses();
const btcWrappedSegwitAddresses = await fetchBtcWrappedSegwitAddresses();
const solanaAddresses = await fetchSolanaAddresses();
```

### Signing Transactions

To sign a transaction, you'll call `sign` with the transaction data with the chain information and signing scheme. This function returns the signed transaction data.

#### Signing Example

For an Ethereum transaction, sing the `ethers.js` library, version 5, to build the transaction data and sign with the `gridplus-sdk` would look like this:

```ts
import { sign } from 'gridplus-sdk';

const txData = {
  type: 1,
  maxFeePerGas: 1200000000,
  maxPriorityFeePerGas: 1200000000,
  nonce: 0,
  gasLimit: 50000,
  to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
  value: 1000000000000,
  data: '0x17e914679b7e160613be4f8c2d3203d236286d74eb9192f6d6f71b9118a42bb033ccd8e8',
  gasPrice: 1200000000,
};

const common = new Common({
  chain: Chain.Mainnet,
  hardfork: Hardfork.London,
});
const tx = TransactionFactory.fromTxData(txData, { common });
const payload = tx.getMessageToSign(false);

const signedTx = await sign(reqData);
```

For more complex signing examples or signing for other chains, please refer to the [Signing](/signing.md) page.
