---
id: 'migration-v3-to-v4'
title: '🔄 Migration Guide: v3 → v4'
sidebar_position: 4
---

# Migration Guide: v3.x to v4.0

GridPlus SDK v4.0.0 introduces significant improvements focused on modernization, type safety, and developer experience. This guide will help you migrate from v3.x to v4.0.0.

## 🚨 Breaking Changes Summary

### Core Dependency Migration

**v3.x used**: `ethers.js` and `@ethereumjs/tx`
**v4.0 uses**: `viem` and `zod`

This change affects:

- Transaction object format
- Transaction serialization
- Type definitions
- Validation patterns

### New Features in v4.0

- ✅ **EIP-7702 Support**: Account abstraction authorization signing
- ✅ **Bitcoin XPUB Helpers**: `fetchBtcXpub`, `fetchBtcYpub`, `fetchBtcZpub`
- ✅ **Zod Validation**: Automatic transaction validation with clear error messages
- ✅ **CLI Pairing Tool**: `npm run pair-device` for easy setup
- ✅ **Viem Integration**: Native support for modern Ethereum tooling
- ✅ **Improved Testing**: Foundry/Anvil integration for local development

---

## 📦 Installation

### Update Your Dependencies

```bash
# Remove old dependencies
npm uninstall ethers @ethereumjs/tx

# Install v4.0
npm install gridplus-sdk@^4.0.0 viem
```

### Update package.json

```json
{
  "dependencies": {
    "gridplus-sdk": "^4.0.0",
    "viem": "^2.31.0"
  }
}
```

---

## 🔄 Transaction Signing Migration

### v3.x (Ethers.js)

```ts
import { ethers } from 'ethers';

// Build transaction with ethers
const tx = {
  to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
  value: ethers.utils.parseEther('0.1'),
  gasLimit: 21000,
  maxFeePerGas: ethers.utils.parseUnits('20', 'gwei'),
  maxPriorityFeePerGas: ethers.utils.parseUnits('2', 'gwei'),
  nonce: 0,
  chainId: 1,
  type: 2, // EIP-1559
};

// Sign with SDK
const result = await client.sign({
  currency: 'ETH',
  data: tx,
});
```

### v4.0 (Viem)

```ts
import { sign } from 'gridplus-sdk/api/signing';
import { parseEther, parseGwei } from 'viem';

// Build transaction with viem
const tx = {
  type: 'eip1559',
  to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
  value: parseEther('0.1'),
  gas: 21000n,
  maxFeePerGas: parseGwei('20'),
  maxPriorityFeePerGas: parseGwei('2'),
  nonce: 0,
  chainId: 1,
};

// Sign with SDK
const result = await sign(tx);
```

### Key Differences

| Aspect            | v3.x (Ethers)               | v4.0 (Viem)       |
| :---------------- | :-------------------------- | :---------------- |
| **Type field**    | `type: 2`                   | `type: 'eip1559'` |
| **Value parsing** | `ethers.utils.parseEther()` | `parseEther()`    |
| **Gas field**     | `gasLimit`                  | `gas`             |
| **BigNumber**     | `BigNumber` class           | Native `bigint`   |
| **Import**        | `ethers` package            | `viem` package    |

---

## 📝 Transaction Types

### Legacy Transactions

#### v3.x

```ts
const tx = {
  to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
  value: ethers.utils.parseEther('0.1'),
  gasPrice: ethers.utils.parseUnits('20', 'gwei'),
  gasLimit: 21000,
  nonce: 0,
  chainId: 1,
  type: 0,
};
```

#### v4.0

```ts
const tx = {
  type: 'legacy',
  to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
  value: parseEther('0.1'),
  gasPrice: parseGwei('20'),
  gasLimit: 21000n,
  nonce: 0,
  chainId: 1,
};
```

### EIP-1559 Transactions

#### v3.x

```ts
const tx = {
  to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
  value: ethers.utils.parseEther('0.1'),
  maxFeePerGas: ethers.utils.parseUnits('20', 'gwei'),
  maxPriorityFeePerGas: ethers.utils.parseUnits('2', 'gwei'),
  gasLimit: 21000,
  nonce: 0,
  chainId: 1,
  type: 2,
};
```

#### v4.0

```ts
const tx = {
  type: 'eip1559',
  to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
  value: parseEther('0.1'),
  maxFeePerGas: parseGwei('20'),
  maxPriorityFeePerGas: parseGwei('2'),
  gas: 21000n,
  nonce: 0,
  chainId: 1,
};
```

### EIP-2930 (Access List)

#### v3.x

```ts
const tx = {
  to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
  value: 0,
  gasPrice: ethers.utils.parseUnits('20', 'gwei'),
  gasLimit: 100000,
  nonce: 0,
  chainId: 1,
  type: 1,
  accessList: [
    {
      address: '0x...',
      storageKeys: ['0x...'],
    },
  ],
};
```

#### v4.0

```ts
const tx = {
  type: 'eip2930',
  to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
  value: 0n,
  gasPrice: parseGwei('20'),
  gasLimit: 100000n,
  nonce: 0,
  chainId: 1,
  accessList: [
    {
      address: '0x...',
      storageKeys: ['0x...'],
    },
  ],
};
```

---

## 🔐 Client Setup & Pairing

### v3.x Pattern

```ts
import { Client } from 'gridplus-sdk';

const client = new Client({
  name: 'My App',
  crypto: savedCrypto, // Manually managed
});

const isPaired = await client.connect('ABC123');
if (!isPaired) {
  const secret = prompt('Enter pairing code');
  await client.pair(secret);
}
```

### v4.0 Pattern (Functional API)

```ts
import { setup, pair } from 'gridplus-sdk';

const isPaired = await setup({
  name: 'My App',
  deviceId: 'ABC123',
  password: 'my-secure-password',
  getStoredClient: () => localStorage.getItem('lattice-client'),
  setStoredClient: (client) => localStorage.setItem('lattice-client', client),
});

if (!isPaired) {
  const secret = prompt('Enter pairing code');
  await pair(secret);
}
```

### Key Improvements

- **Automatic state management**: Storage callbacks handle persistence
- **Simpler API**: No manual crypto object management
- **Type safety**: Full TypeScript support
- **Better error messages**: Zod validation provides clear feedback

---

## 🪙 Bitcoin Address Helpers

### v3.x (Manual Path Construction)

```ts
import { fetchAddresses, HARDENED_OFFSET } from 'gridplus-sdk';

// Legacy addresses
const btcLegacy = await fetchAddresses({
  startPath: [
    HARDENED_OFFSET + 44,
    HARDENED_OFFSET + 0,
    HARDENED_OFFSET + 0,
    0,
    0,
  ],
  n: 5,
});

// Segwit addresses
const btcSegwit = await fetchAddresses({
  startPath: [
    HARDENED_OFFSET + 84,
    HARDENED_OFFSET + 0,
    HARDENED_OFFSET + 0,
    0,
    0,
  ],
  n: 5,
});
```

### v4.0 (Convenience Helpers)

```ts
import {
  fetchBtcLegacyAddresses,
  fetchBtcSegwitAddresses,
  fetchBtcWrappedSegwitAddresses,
  fetchBtcXpub,
  fetchBtcYpub,
  fetchBtcZpub,
} from 'gridplus-sdk/api/addresses';

// Legacy addresses (1...)
const btcLegacy = await fetchBtcLegacyAddresses(5);

// Native Segwit addresses (bc1...)
const btcSegwit = await fetchBtcSegwitAddresses(5);

// Wrapped Segwit addresses (3...)
const btcWrapped = await fetchBtcWrappedSegwitAddresses(5);

// NEW: Extended public keys
const xpub = await fetchBtcXpub(); // Legacy XPUB
const ypub = await fetchBtcYpub(); // Wrapped Segwit YPUB
const zpub = await fetchBtcZpub(); // Native Segwit ZPUB
```

---

## 🆕 EIP-7702 Account Abstraction

**New in v4.0**: Sign authorization requests to temporarily delegate EOA logic to a smart contract.

```ts
import { signAuthorization, sign } from 'gridplus-sdk/api/signing';
import { parseGwei } from 'viem';

// Step 1: Sign authorization
const auth = await signAuthorization({
  address: '0x0000000000219ab540356cBB839Cbe05303d7705',
  chainId: 1,
  nonce: 0,
});

// Step 2: Use in transaction
const tx = {
  type: 'eip7702',
  authorizationList: [auth],
  to: myEOA,
  value: 0n,
  data: batchCalldata,
  chainId: 1,
  nonce: 1,
  gas: 200000n,
  maxFeePerGas: parseGwei('20'),
  maxPriorityFeePerGas: parseGwei('2'),
};

const result = await sign(tx);
```

---

## ✅ Validation with Zod

**New in v4.0**: Automatic transaction validation with helpful error messages.

### What Gets Validated

- Transaction type matches structure
- Required fields present
- Field types correct (bigint, hex strings, etc.)
- Valid addresses and hashes
- Access lists properly formatted

### Example Validation Error

```ts
// ❌ This will throw a clear error
const tx = {
  type: 'eip1559',
  to: 'invalid-address', // Not a valid hex address
  value: '0.1', // Should be bigint, not string
  gas: 21000, // Should be bigint (21000n)
  // Missing required fields...
};

await sign(tx);
// Error: Invalid transaction:
//   - to: Invalid address format
//   - value: Expected bigint, received string
//   - gas: Expected bigint, received number
//   - Missing required field: maxFeePerGas
```

---

## 🧪 Testing Setup

### v3.x

Testing used custom setups without standardized local networks.

### v4.0 (Foundry + Anvil)

```bash
# One-time setup (starts Anvil in background)
npm run setup:anvil

# In another terminal, run tests
npm run test

# Run specific test suites
npm run e2e-eth
npm run e2e-eip7702
npm run e2e-sign

# Cleanup when done
npm run cleanup:anvil
```

**New CLI pairing tool**:

```bash
npm run pair-device
```

---

## 🔍 Import Paths

### v3.x

```ts
import { Client, Constants, Utils } from 'gridplus-sdk';
```

### v4.0 (Modular Imports)

```ts
// Functional API
import { setup, pair } from 'gridplus-sdk';
import { sign, signMessage, signAuthorization } from 'gridplus-sdk/api/signing';
import { fetchAddresses, fetchBtcXpub } from 'gridplus-sdk/api/addresses';

// Constants and utilities still available
import { Constants, HARDENED_OFFSET } from 'gridplus-sdk';
```

---

## 🚀 Quick Migration Checklist

- [ ] Update `package.json` dependencies
- [ ] Replace `ethers` imports with `viem`
- [ ] Change transaction `type` from number to string (`2` → `'eip1559'`)
- [ ] Rename `gasLimit` to `gas`
- [ ] Convert numbers to `bigint` (add `n` suffix: `21000n`)
- [ ] Replace `parseEther()` with viem's version
- [ ] Update client setup to use `setup()` and `pair()` functions
- [ ] Consider using new Bitcoin XPUB helpers
- [ ] Update test setup to use Foundry/Anvil
- [ ] Review validation errors (now powered by Zod)

---

## 📚 Additional Resources

- [Viem Documentation](https://viem.sh)
- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [Foundry Book](https://book.getfoundry.sh/)
- [SDK Testing Guide](./testing)

---

## ❓ Need Help?

If you encounter issues during migration:

1. Check the [GitHub Issues](https://github.com/GridPlus/gridplus-sdk/issues)
2. Review the [test suite](https://github.com/GridPlus/gridplus-sdk/tree/main/src/__test__) for examples
3. Consult the [signing guide](./signing) for transaction examples

**Common gotchas**:

- Forgetting to convert numbers to `bigint`
- Using `gasLimit` instead of `gas`
- Numeric transaction types instead of strings
- Missing required fields (Zod will catch these)
