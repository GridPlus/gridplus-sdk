---
id: 'index'
title: '👋 Getting Started'
slug: '/'
sidebar_position: 0
custom_edit_url: null
---

# GridPlus SDK

The [GridPlus SDK](https://github.com/GridPlus/gridplus-sdk) is the official TypeScript/JavaScript library for interacting with the [Lattice1 hardware wallet](https://gridplus.io/lattice). It provides a secure communication layer between your application and the Lattice1 device.

:::warning v4.0.0 Breaking Changes
**You're viewing documentation for v4.0.0**, which introduces significant breaking changes from v3.x:

- **New dependency**: Now uses `viem` instead of `ethers.js`
- **Transaction format**: Different object structure for signing
- **EIP-7702 support**: New account abstraction features
- **Bitcoin helpers**: New XPUB/YPUB/ZPUB functions

**Upgrading from v3.x?** See the [Migration Guide](./migration-v3-to-v4) for step-by-step upgrade instructions.
:::

## How It Works

### Architecture Overview

1. **Your Application** → Creates signing requests using the SDK
2. **GridPlus SDK** → Encrypts and formats requests for the Lattice1
3. **GridPlus Relay** → Routes encrypted messages between your app and the device
4. **Lattice1 Device** → Displays transaction details and waits for user approval
5. **User Approval** → User reviews and approves/rejects on the device screen
6. **Response** → Signed data is returned through the same encrypted channel

### Key Concepts

- **End-to-End Encryption**: All communication is encrypted using a shared secret established during pairing
- **Device ID**: Each Lattice1 has a unique 6-character identifier used for routing messages
- **Pairing**: One-time process to establish trust between your app and the device
- **Active Wallet**: The currently unlocked wallet on the device (internal or SafeCard)
- **Request Timeout**: User approval requests expire after 2 minutes if not acted upon

:::info
The Lattice1 is always connected to the internet and listens for encrypted requests. Only paired applications can communicate with the device, and all sensitive operations require physical approval on the device screen.
:::

## Getting Started

### Prerequisites

- A Lattice1 device connected to the internet
- The device's 6-character Device ID (found in Settings)
- Node.js 16+ or a modern browser environment

### Installation

```bash
# Using npm
npm install --save gridplus-sdk

# Using yarn
yarn add gridplus-sdk

# Using pnpm
pnpm add gridplus-sdk
```

### Step 1: Initialize Connection

The SDK needs to establish a secure connection with your Lattice1. This involves:

1. Creating a client instance with your app's identity
2. Storing the encrypted connection state for future use
3. Checking if you've already paired with this device

```ts
import { setup } from 'gridplus-sdk';

// Initialize the SDK with your app configuration
const isPaired = await setup({
  // Your app name (shown on Lattice screen during pairing)
  name: 'My DeFi App',

  // The 6-character ID from your Lattice1 device
  deviceId: 'ABC123',

  // Password for local encryption (not sent to device)
  password: 'my-secure-password',

  // Functions to persist the encrypted client state
  getStoredClient: () => localStorage.getItem('lattice-client'),
  setStoredClient: (client) => localStorage.setItem('lattice-client', client),
});

if (isPaired) {
  console.log('Already paired! Ready to use.');
} else {
  console.log('Need to pair with device first.');
}
```

:::tip Security Note
The `password` is used to encrypt the client state locally. It never leaves your application and is not sent to the Lattice1. Choose a strong password and store it securely.
:::

### Step 2: Pairing Process

Pairing establishes trust between your application and the Lattice1:

1. Your app sends a pairing request
2. The Lattice1 displays a 6-digit code on its screen
3. User enters this code in your app
4. A secure channel is established using ECDH key exchange

```ts
import { pair } from 'gridplus-sdk';

try {
  // User must read the 6-digit code from their Lattice screen
  const pairingCode = prompt('Enter the 6-digit code from your Lattice:');

  // Establish the secure connection
  const success = await pair(pairingCode);

  if (success) {
    console.log('✅ Pairing successful! Your app is now trusted.');
  } else {
    console.log('❌ Pairing failed. Please check the code and try again.');
  }
} catch (error) {
  console.error('Pairing error:', error.message);
}
```

:::warning
Pairing codes expire after 2 minutes. If the code expires, you'll need to restart the pairing process to get a new code.
:::

#### Alternative: CLI Pairing Tool

**New in v4.0**: For development and testing, you can use the built-in CLI pairing script:

```bash
npm run pair-device
```

This interactive script will:

1. Prompt for your device ID
2. Prompt for your app name
3. Trigger pairing on your Lattice
4. Ask you to enter the 6-digit code
5. Save the connection for future use

:::tip
The CLI pairing tool is perfect for:

- Quick testing and development
- One-time device setup
- Verifying your Lattice connection
- Learning how the pairing flow works
  :::

### Step 3: Fetching Addresses

Once paired, you can derive addresses from the Lattice1's active wallet:

```ts
import { fetchAddresses } from 'gridplus-sdk';

// Get default Ethereum addresses (first 10)
const addresses = await fetchAddresses();
console.log('My addresses:', addresses);

// Get a specific number of addresses
const fiveAddresses = await fetchAddresses(5);

// The addresses come from the active wallet on the device:
// - Internal wallet (if no SafeCard inserted)
// - SafeCard wallet (if inserted and unlocked)
```

#### How Address Derivation Works

1. **SDK sends derivation request** → Specifies the HD wallet path
2. **Lattice1 derives keys** → Uses BIP32/BIP44 standards
3. **Public keys returned** → Private keys never leave the device
4. **SDK computes addresses** → From the public keys

#### Custom Derivation Paths

The SDK supports any BIP44-compatible derivation path:

```ts
import { fetchAddresses, HARDENED_OFFSET } from 'gridplus-sdk';

// Understanding BIP44 paths: m/purpose'/coin_type'/account'/change/index
// The ' means "hardened" (add 0x80000000 to the value)

// Ethereum (m/44'/60'/0'/0/0)
const ethAddresses = await fetchAddresses({
  startPath: [
    HARDENED_OFFSET + 44, // purpose: BIP44
    HARDENED_OFFSET + 60, // coin_type: Ethereum
    HARDENED_OFFSET + 0, // account: first account
    0, // change: external chain
    0, // index: first address
  ],
  n: 10, // Get 10 addresses
});

// Bitcoin Legacy (m/44'/0'/0'/0/0)
const btcLegacy = await fetchAddresses({
  startPath: [
    HARDENED_OFFSET + 44, // purpose: BIP44
    HARDENED_OFFSET + 0, // coin_type: Bitcoin
    HARDENED_OFFSET + 0, // account
    0, // change
    0, // index
  ],
});

// Bitcoin Segwit (m/84'/0'/0'/0/0)
const btcSegwit = await fetchAddresses({
  startPath: [
    HARDENED_OFFSET + 84, // purpose: BIP84 (segwit)
    HARDENED_OFFSET + 0, // coin_type: Bitcoin
    HARDENED_OFFSET + 0, // account
    0, // change
    0, // index
  ],
});
```

#### Convenience Functions

For common blockchains, use these helper functions:

```ts
import {
  fetchAddresses, // Ethereum/EVM addresses
  fetchBtcLegacyAddresses, // Bitcoin P2PKH (1...)
  fetchBtcSegwitAddresses, // Bitcoin P2WPKH (bc1...)
  fetchBtcWrappedSegwitAddresses, // Bitcoin P2SH-P2WPKH (3...)
  fetchSolanaAddresses, // Solana addresses
  fetchXrpAddresses, // XRP classic addresses (r...)
} from 'gridplus-sdk/api/addresses';

// Each returns an array of address strings
const ethAddresses = await fetchAddresses(10);
const btcLegacy = await fetchBtcLegacyAddresses(5);
const btcSegwit = await fetchBtcSegwitAddresses(5);
const btcWrapped = await fetchBtcWrappedSegwitAddresses(5);
const solana = await fetchSolanaAddresses(5);
const xrp = await fetchXrpAddresses({ n: 5, startPathIndex: 0 });
```

### Step 4: Signing Transactions

The SDK supports all standard transaction formats through a unified signing interface:

```ts
import { sign } from 'gridplus-sdk/api/signing';
import { parseEther, parseGwei } from 'viem';

// Build a transaction using Viem format
const tx = {
  type: 'eip1559',
  to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
  value: parseEther('0.1'),
  data: '0x',
  nonce: 0,
  gas: 21000n,
  maxFeePerGas: parseGwei('20'),
  maxPriorityFeePerGas: parseGwei('2'),
  chainId: 1,
};

// Request signature from Lattice1
const result = await sign(tx);

console.log('Signed transaction:', result.tx);
console.log('Transaction hash:', result.txHash);

// Broadcast the signed transaction
// await provider.sendTransaction(result.tx);
```

#### What Happens During Signing

When you call `sign()`, the SDK orchestrates a secure signing process:

1. **Transaction Serialization** - Converts your transaction to RLP format
2. **Secure Transmission** - Encrypts and sends to your Lattice1
3. **User Review** - Device displays transaction details clearly
4. **Physical Approval** - User confirms on the device touchscreen
5. **Cryptographic Signing** - Secure element signs with private key
6. **Response Delivery** - Signed transaction returned to your app

The Lattice1 displays key transaction information:

- Recipient address
- Transfer amount
- Gas fees
- Contract interactions (decoded when possible)

For comprehensive examples including Bitcoin, Solana, messages, and EIP-7702 authorizations, see the [Signing Guide](./signing).
