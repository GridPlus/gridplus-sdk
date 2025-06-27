---
sidebar_position: 6
title: Migration Guide v3 → v4
description: Complete guide for migrating from GridPlus SDK v3.x to v4.x
---

# GridPlus SDK v3 to v4 Migration Guide

This guide will help you migrate from GridPlus SDK v3.x to v4.x. Version 4 introduces significant breaking changes to simplify the API and improve compatibility with modern Ethereum tooling.

:::tip **🚀 Major Improvement: Dedicated Signing Functions**
Version 4 introduces specialized signing functions that are **cleaner, more type-safe, and the recommended approach** over the generic `client.sign()` method. This guide will show you how to migrate to these new functions.
:::

## 🚨 Breaking Changes Overview

### 1. **NEW: Dedicated Signing Functions (Recommended)**

**The Primary Change:** Use specialized signing functions instead of the generic `client.sign()` method.

**Before (v3):**
```typescript
import { Client, CURRENCIES } from 'gridplus-sdk';

const client = new Client();

// Transaction signing
await client.sign({
  data: transactionPayload,
  currency: CURRENCIES.ETH
});

// Message signing  
await client.sign({
  data: messagePayload,
  currency: CURRENCIES.ETH_MSG
});
```

**After (v4) - ✅ Recommended Approach:**
```typescript
import { 
  sign, 
  signMessage, 
  signAuthorization,
  signBtcLegacyTx,
  signSolanaTx 
} from 'gridplus-sdk/signing';

// EVM transaction signing - much cleaner!
const result = await sign(transaction);

// Message signing - simpler API
const signature = await signMessage("Hello, world!");

// EIP-7702 authorization signing - new feature!
const auth = await signAuthorization({
  chainId: 1,
  address: '0x...',
  nonce: 0
});

// Bitcoin transaction signing - cleaner
const btcResult = await signBtcLegacyTx(payload);

// Solana transaction signing - cleaner
const solResult = await signSolanaTx(buffer);
```

### 2. Unified EVM Currency System

**Before (v3):**
```typescript
// Separate currencies for transactions and messages
import { CURRENCIES } from 'gridplus-sdk';

// Transaction signing
await client.sign({
  data: transactionPayload,
  currency: CURRENCIES.ETH
});

// Message signing  
await client.sign({
  data: messagePayload,
  currency: CURRENCIES.ETH_MSG
});
```

**After (v4) - If Using client.sign():**
```typescript
// Single unified EVM currency (when using client.sign)
import { CURRENCIES } from 'gridplus-sdk';

await client.sign({
  data: transactionPayload,
  currency: CURRENCIES.EVM  // ✅ Unified currency
});

await client.sign({
  data: messagePayload,
  currency: CURRENCIES.EVM  // ✅ Same currency for messages
});
```

**After (v4) - ✅ Recommended with New Functions:**
```typescript
// No currency needed - handled automatically!
import { sign, signMessage } from 'gridplus-sdk/signing';

await sign(transaction);        // ✅ No currency parameter needed
await signMessage(message);     // ✅ No currency parameter needed
```

### 3. Viem-First API Design

**Before (v3):**
```typescript
// Legacy transaction format
const transaction = {
  to: '0x...',
  value: 1000000000000000000, // Number
  gasPrice: 20000000000,      // Number
  gasLimit: 21000,            // Number
  nonce: 42,
  data: '0x...',
  chainId: 1
};
```

**After (v4):**
```typescript
// Viem-compatible transaction format
import { parseEther, parseGwei } from 'viem';

const transaction = {
  to: '0x...',
  value: parseEther('1'),           // bigint
  gasPrice: parseGwei('20'),        // bigint
  gas: 21000n,                      // bigint (renamed from gasLimit)
  nonce: 42,
  data: '0x...',
  chainId: 1
};
```

### 4. Enhanced Type Safety

**Before (v3):**
```typescript
// Loose typing with potential runtime errors
interface TransactionPayload {
  type: number;           // ❌ Number instead of bigint
  gasPrice: number;       // ❌ Number instead of bigint
  value: number;          // ❌ Number instead of bigint
  to: string;            // ❌ String instead of Address
}
```

**After (v4):**
```typescript
// Strict Viem-compatible typing
import type { Address, Hex, TransactionSerializable } from 'viem';

interface TransactionRequest {
  to: Address;            // ✅ Proper Address type
  value?: Hex | bigint;   // ✅ Hex or bigint
  gas?: Hex | bigint;     // ✅ Proper gas field
  data?: Hex;             // ✅ Proper Hex type
  chainId: number;
}
```

### 5. **NEW: EIP-7702 Authorization Support**

```typescript
// EIP-7702 authorization signing - completely new feature!
import { signAuthorization, signAuthorizationList } from 'gridplus-sdk/signing';

const authorization = await signAuthorization({
  chainId: 1,
  address: '0x...',  // Contract to authorize
  nonce: 0
});

// EIP-7702 transaction with authorization list
const eip7702Transaction = await signAuthorizationList({
  type: 'eip7702' as const,
  authorizationList: [authorization],
  to: '0x...',
  value: parseEther('1')
});
```

## 📋 Step-by-Step Migration

### Step 1: Update Dependencies

```bash
npm install gridplus-sdk@^4.0.0 viem@^2.0.0
# or
pnpm add gridplus-sdk@^4.0.0 viem@^2.0.0
```

### Step 2: Set Up the GridPlus Client

:::warning **Important: Client Setup Required**
The new signing functions still require a GridPlus client to be set up and connected before use. You need to initialize and connect to your Lattice device first.
:::

**Basic Client Setup:**
```typescript
import { setup } from 'gridplus-sdk';

// Initialize and connect to your Lattice device
const isPaired = await setup({
  name: 'My App',           // Your app name
  deviceId: 'ABC123',       // Your Lattice device ID (6 characters)
  password: 'my-secure-password',  // Local encryption password
  
  // Functions to persist encrypted client state
  getStoredClient: () => localStorage.getItem('lattice-client'),
  setStoredClient: (client) => localStorage.setItem('lattice-client', client),
});

if (isPaired) {
  console.log('✅ Connected to Lattice!');
  // Now you can use the signing functions
} else {
  console.log('⚠️ Need to pair with device first');
  // Handle pairing process (see pairing section below)
}
```

**Client Setup with Pairing:**
```typescript
import { setup, pair } from 'gridplus-sdk';

// Set up storage functions (Node.js example with file system)
const getStoredClient = async () => {
  try {
    return await fs.readFile('./lattice-client.json', 'utf8');
  } catch {
    return '';  // Return empty string if file doesn't exist
  }
};

const setStoredClient = async (clientData) => {
  await fs.writeFile('./lattice-client.json', clientData || '');
};

// Initialize the connection
const isPaired = await setup({
  name: 'My DApp',
  deviceId: 'ABC123',       // Your device ID
  password: 'my-secure-password',
  getStoredClient,
  setStoredClient,
});

if (!isPaired) {
  // Need to pair - user must read code from Lattice screen
  const pairingCode = prompt('Enter 6-digit code from Lattice screen:');
  
  try {
    await pair(pairingCode.toUpperCase());
    console.log('✅ Pairing successful!');
  } catch (error) {
    console.error('❌ Pairing failed:', error.message);
  }
}
```

**Reconnecting with Stored State:**
```typescript
import { setup } from 'gridplus-sdk';

// For subsequent app launches, setup can reconnect automatically
const isPaired = await setup({
  // Only provide storage functions - will load previous connection
  getStoredClient: () => localStorage.getItem('lattice-client'),
  setStoredClient: (client) => localStorage.setItem('lattice-client', client),
});

if (isPaired) {
  console.log('✅ Reconnected automatically!');
  // Ready to use signing functions immediately
} else {
  console.log('❌ Need to set up connection first');
  // Handle first-time setup
}
```

:::tip **Setup Best Practices**
- Use the `setup()` function for all client initialization - it handles connection automatically
- Store the client state securely using the provided storage functions
- Handle pairing gracefully with clear user instructions about reading the Lattice screen
- Once set up, the connection persists across app restarts
- All signing functions work automatically after successful setup
:::

### Step 3: **Migrate to New Signing Functions (Recommended)**

:::tip **Best Practice**
Instead of updating your existing `client.sign()` calls, migrate to the new dedicated signing functions for cleaner, more maintainable code.
:::

**EVM Transactions:**
```diff
- import { Client, CURRENCIES } from 'gridplus-sdk';
- const client = new Client();
- 
- const result = await client.sign({
-   data: transaction,
-   currency: CURRENCIES.ETH
- });

+ import { sign } from 'gridplus-sdk/signing';
+ 
+ const result = await sign(transaction);
```

**Message Signing:**
```diff
- import { Client, CURRENCIES } from 'gridplus-sdk';
- const client = new Client();
- 
- const result = await client.sign({
-   data: { payload: message },
-   currency: CURRENCIES.ETH_MSG
- });

+ import { signMessage } from 'gridplus-sdk/signing';
+ 
+ const result = await signMessage(message);
```

**Bitcoin Transactions:**
```diff
- import { Client, CURRENCIES } from 'gridplus-sdk';
- const client = new Client();
- 
- const result = await client.sign({
-   data: {
-     signerPath: BTC_LEGACY_DERIVATION,
-     ...payload
-   },
-   currency: CURRENCIES.BTC
- });

+ import { signBtcLegacyTx } from 'gridplus-sdk/signing';
+ 
+ const result = await signBtcLegacyTx(payload);
```

**Solana Transactions:**
```diff
- import { Client, CURRENCIES } from 'gridplus-sdk';
- const client = new Client();
- 
- const result = await client.sign({
-   data: {
-     signerPath: SOLANA_DERIVATION,
-     curveType: Constants.SIGNING.CURVES.ED25519,
-     // ... complex setup
-   }
- });

+ import { signSolanaTx } from 'gridplus-sdk/signing';
+ 
+ const result = await signSolanaTx(buffer);
```

### Step 4: Update Transaction Formats to Viem

```diff
- const transaction = {
-   gasPrice: 20000000000,
-   gasLimit: 21000,
-   value: 1000000000000000000
- };

+ import { parseEther, parseGwei } from 'viem';
+ const transaction = {
+   gasPrice: parseGwei('20'),
+   gas: 21000n,
+   value: parseEther('1')
+ };
```

### Step 5: Update Type Imports

```diff
- import { SignData, TransactionPayload } from 'gridplus-sdk';

+ import { SignData } from 'gridplus-sdk';
+ import type { TransactionSerializable, Address, Hex } from 'viem';
```

### Step 6 (Optional): If Keeping client.sign(), Update Currency

```diff
- currency: CURRENCIES.ETH
- currency: CURRENCIES.ETH_MSG
+ currency: CURRENCIES.EVM  // Use for both transactions and messages
```

### Step 7: Complete Example - Setup + Signing

Here's a complete example showing the full flow from setup to transaction signing:

```typescript
import { setup, pair, sign, signMessage } from 'gridplus-sdk';
import { parseEther, parseGwei } from 'viem';

// Storage functions (localStorage example for web apps)
const getStoredClient = () => localStorage.getItem('lattice-client');
const setStoredClient = (client) => localStorage.setItem('lattice-client', client);

async function initializeAndSign() {
  try {
    // 1. Set up the connection (first time or reconnect)
    let isPaired = await setup({
      name: 'My DApp v4',
      deviceId: 'ABC123',  // Your Lattice device ID
      password: 'my-secure-password',
      getStoredClient,
      setStoredClient,
    });

    // 2. Handle pairing if needed
    if (!isPaired) {
      console.log('📱 Please check your Lattice screen for the pairing code');
      const pairingCode = prompt('Enter 6-digit code from Lattice:');
      
      await pair(pairingCode.toUpperCase());
      console.log('✅ Pairing successful!');
    }

    console.log('✅ Connected to Lattice');

    // 3. Create a transaction using Viem types
    const transaction = {
      to: '0x742d35Cc6634C0532925a3b8D214B6F8e39Ba9Db',
      value: parseEther('0.1'),
      gasPrice: parseGwei('20'),
      gas: 21000n,
      nonce: 42,
      chainId: 1,
    };

    // 4. Sign the transaction using the new signing function
    const result = await sign(transaction);
    console.log('✅ Transaction signed:', result.txHash);

    // 5. Sign a message
    const messageSignature = await signMessage('Hello, GridPlus v4!');
    console.log('✅ Message signed:', messageSignature);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the example
initializeAndSign();
```

:::info **Complete Working Example**
This example shows the complete flow from client setup to signing. Copy and adapt this code for your own application.
:::

## 🔧 Complete Migration Patterns

### Pattern 1: Simple Transaction Signing

**Before (v3):**
```typescript
import { Client, CURRENCIES } from 'gridplus-sdk';

const client = new Client();

const legacySign = async () => {
  const result = await client.sign({
    data: {
      to: '0x742d35Cc6634C0532925a3b8D214B6F8e39Ba9Db',
      value: 1000000000000000000,
      gasPrice: 20000000000,
      gasLimit: 21000,
      nonce: 1,
      chainId: 1
    },
    currency: CURRENCIES.ETH
  });
  return result.txHash;
};
```

**After (v4) - ✅ Recommended:**
```typescript
import { setup, sign } from 'gridplus-sdk';
import { parseEther, parseGwei } from 'viem';

// Set up connection (do this once at app startup)
await setup({
  name: 'My App',
  deviceId: 'ABC123',
  password: 'my-password',
  getStoredClient: () => localStorage.getItem('lattice-client'),
  setStoredClient: (client) => localStorage.setItem('lattice-client', client),
});

const modernSign = async () => {
  const result = await sign({
    to: '0x742d35Cc6634C0532925a3b8D214B6F8e39Ba9Db',
    value: parseEther('1'),
    gasPrice: parseGwei('20'),
    gas: 21000n,
    nonce: 1,
    chainId: 1
  });
  return result.txHash; // Properly typed as Hex
};
```

### Pattern 2: Message Signing

**Before (v3):**
```typescript
import { Client, CURRENCIES } from 'gridplus-sdk';

const client = new Client();

const signUserMessage = async (message: string) => {
  return client.sign({
    data: { payload: message },
    currency: CURRENCIES.ETH_MSG
  });
};
```

**After (v4) - ✅ Recommended:**
```typescript
import { setup, signMessage } from 'gridplus-sdk';

// Set up connection (do this once at app startup)
await setup({
  name: 'My App',
  deviceId: 'ABC123',
  password: 'my-password',
  getStoredClient: () => localStorage.getItem('lattice-client'),
  setStoredClient: (client) => localStorage.setItem('lattice-client', client),
});

const signUserMessage = async (message: string) => {
  return signMessage(message);  // Much cleaner!
};
```

### Pattern 3: EIP-1559 Transactions

**Before (v3):**
```typescript
const eip1559Transaction = {
  type: 2,
  maxFeePerGas: 30000000000,
  maxPriorityFeePerGas: 2000000000,
  to: '0x...',
  value: 1000000000000000000,
  gasLimit: 21000,
  nonce: 1,
  chainId: 1
};

const result = await client.sign({
  data: eip1559Transaction,
  currency: CURRENCIES.ETH
});
```

**After (v4) - ✅ Recommended:**
```typescript
import { setup, sign } from 'gridplus-sdk';
import { parseEther, parseGwei } from 'viem';

// Set up connection (do this once at app startup)
await setup({
  name: 'My App',
  deviceId: 'ABC123',
  password: 'my-password',
  getStoredClient: () => localStorage.getItem('lattice-client'),
  setStoredClient: (client) => localStorage.setItem('lattice-client', client),
});

const eip1559Transaction = {
  type: 'eip1559' as const,
  maxFeePerGas: parseGwei('30'),
  maxPriorityFeePerGas: parseGwei('2'),
  to: '0x...',
  value: parseEther('1'),
  gas: 21000n,
  nonce: 1,
  chainId: 1
};

const result = await sign(eip1559Transaction);
```

### Pattern 4: **NEW - EIP-7702 Authorization**

**New in v4:**
```typescript
import { 
  setup,
  signAuthorization, 
  signAuthorizationList 
} from 'gridplus-sdk';
import { parseEther, parseGwei } from 'viem';

// Set up connection (do this once at app startup)
await setup({
  name: 'My App',
  deviceId: 'ABC123',
  password: 'my-password',
  getStoredClient: () => localStorage.getItem('lattice-client'),
  setStoredClient: (client) => localStorage.setItem('lattice-client', client),
});

// Sign an authorization to set code for an EOA
const authorization = await signAuthorization({
  chainId: 1,
  address: '0x742d35Cc6634C0532925a3b8D214B6F8e39Ba9Db',  // Contract to authorize
  nonce: 0
});

// Sign a transaction that includes the authorization
const eip7702Transaction = await signAuthorizationList({
  type: 'eip7702' as const,
  authorizationList: [authorization],
  to: '0x...',
  value: parseEther('1'),
  gas: 100000n,
  maxFeePerGas: parseGwei('20'),
  maxPriorityFeePerGas: parseGwei('2'),
  nonce: 1,
  chainId: 1
});
```

### Pattern 5: Bitcoin Transactions

**Before (v3):**
```typescript
import { Client, CURRENCIES, BTC_LEGACY_DERIVATION } from 'gridplus-sdk';

const client = new Client();

const signBitcoin = async (payload) => {
  return client.sign({
    data: {
      signerPath: BTC_LEGACY_DERIVATION,
      ...payload
    },
    currency: CURRENCIES.BTC
  });
};
```

**After (v4) - ✅ Recommended:**
```typescript
import { 
  setup,
  signBtcLegacyTx, 
  signBtcSegwitTx, 
  signBtcWrappedSegwitTx 
} from 'gridplus-sdk';

// Set up connection (do this once at app startup)
await setup({
  name: 'My App',
  deviceId: 'ABC123',
  password: 'my-password',
  getStoredClient: () => localStorage.getItem('lattice-client'),
  setStoredClient: (client) => localStorage.setItem('lattice-client', client),
});

// Much cleaner APIs for different Bitcoin transaction types
const signBitcoinLegacy = async (payload) => {
  return signBtcLegacyTx(payload);
};

const signBitcoinSegwit = async (payload) => {
  return signBtcSegwitTx(payload);
};

const signBitcoinWrappedSegwit = async (payload) => {
  return signBtcWrappedSegwitTx(payload);
};
```

### Pattern 6: Solana Transactions

**Before (v3):**
```typescript
import { Client, Constants, SOLANA_DERIVATION } from 'gridplus-sdk';

const client = new Client();

const signSolana = async (payload: Buffer) => {
  return client.sign({
    data: {
      signerPath: SOLANA_DERIVATION,
      curveType: Constants.SIGNING.CURVES.ED25519,
      hashType: Constants.SIGNING.HASHES.NONE,
      encodingType: Constants.SIGNING.ENCODINGS.SOLANA,
      payload,
    }
  });
};
```

**After (v4) - ✅ Recommended:**
```typescript
import { setup, signSolanaTx } from 'gridplus-sdk';

// Set up connection (do this once at app startup)
await setup({
  name: 'My App',
  deviceId: 'ABC123',
  password: 'my-password',
  getStoredClient: () => localStorage.getItem('lattice-client'),
  setStoredClient: (client) => localStorage.setItem('lattice-client', client),
});

const signSolana = async (payload: Buffer) => {
  return signSolanaTx(payload);  // Much simpler!
};
```

## 🆕 Complete Feature Overview

### Dedicated Signing Functions

Version 4 introduces specialized signing functions that provide:

- **Better Type Safety**: Each function has specific parameter types
- **Cleaner API**: No need to specify currencies or complex configurations
- **Better Developer Experience**: IntelliSense and auto-completion work better
- **Reduced Boilerplate**: Less code to write and maintain

#### **All Available Signing Functions:**

```typescript
import { 
  // Setup & Connection
  setup,                   // Initialize and connect to Lattice
  pair,                    // Pair with device using 6-digit code
  
  // EVM Functions
  sign,                    // Main EVM transaction signing
  signMessage,             // Personal message signing
  signAuthorization,       // EIP-7702 authorization signing
  signAuthorizationList,   // EIP-7702 transaction with auth list
  
  // Bitcoin Functions  
  signBtcLegacyTx,        // Bitcoin Legacy transactions
  signBtcSegwitTx,        // Bitcoin SegWit transactions
  signBtcWrappedSegwitTx, // Bitcoin Wrapped SegWit transactions
  
  // Solana Functions
  signSolanaTx            // Solana transaction signing
} from 'gridplus-sdk';
```

#### **EVM Transaction Signing:**
```typescript
import { sign } from 'gridplus-sdk';
import { parseEther, parseGwei } from 'viem';

// Legacy transaction
const legacyTx = await sign({
  to: '0x742d35Cc6634C0532925a3b8D214B6F8e39Ba9Db',
  value: parseEther('1'),
  gasPrice: parseGwei('20'),
  gas: 21000n,
  nonce: 1,
  chainId: 1
});

// EIP-1559 transaction
const eip1559Tx = await sign({
  type: 'eip1559' as const,
  to: '0x742d35Cc6634C0532925a3b8D214B6F8e39Ba9Db',
  value: parseEther('1'),
  maxFeePerGas: parseGwei('30'),
  maxPriorityFeePerGas: parseGwei('2'),
  gas: 21000n,
  nonce: 1,
  chainId: 1
});
```

#### **Message Signing:**
```typescript
import { signMessage } from 'gridplus-sdk';

// String messages
const signature1 = await signMessage("Hello, world!");

// Binary data
const binaryData = new Uint8Array([1, 2, 3, 4]);
const signature2 = await signMessage(binaryData);

// Buffer data
const bufferData = Buffer.from("Hello, world!", 'utf8');
const signature3 = await signMessage(bufferData);
```

#### **EIP-7702 Authorization (New Feature):**
```typescript
import { 
  signAuthorization, 
  signAuthorizationList 
} from 'gridplus-sdk';

// Sign individual authorization
const auth = await signAuthorization({
  chainId: 1,
  address: '0x742d35Cc6634C0532925a3b8D214B6F8e39Ba9Db',  // Contract address
  nonce: 0
});

// Sign transaction with authorization list
const eip7702Tx = await signAuthorizationList({
  type: 'eip7702' as const,
  authorizationList: [auth],
  to: '0x...',
  value: parseEther('1'),
  gas: 100000n,
  maxFeePerGas: parseGwei('20'),
  maxPriorityFeePerGas: parseGwei('2'),
  nonce: 1,
  chainId: 1
});
```

## ⚠️ Deprecation Warnings

The following features are deprecated and will be removed in v5:

1. **Generic client.sign() for EVM**: Use dedicated signing functions instead
2. **Legacy Transaction Format**: Use Viem's `TransactionSerializable` types
3. **Separate ETH/ETH_MSG currencies**: Use dedicated functions or unified `CURRENCIES.EVM`
4. **Number-based gas values**: Use `bigint` or `Hex` types
5. **Manual transaction type specification**: Let Viem handle type detection

:::warning **Migration Path**
While `client.sign()` still works in v4, it's deprecated. Plan to migrate to dedicated signing functions before v5.
:::

## 🧪 Testing Your Migration

### 1. Type Checking

```bash
# Ensure TypeScript compilation passes
npx tsc --noEmit
```

### 2. Unit Tests

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { setup, sign, signMessage } from 'gridplus-sdk';

describe('Migration Tests', () => {
  beforeAll(async () => {
    // Set up connection before running tests
    await setup({
      name: 'Test App',
      deviceId: 'ABC123',
      password: 'test-password',
      getStoredClient: () => localStorage.getItem('test-lattice-client'),
      setStoredClient: (client) => localStorage.setItem('test-lattice-client', client),
    });
  });

  it('should use new signing functions', async () => {
    const transaction = {
      to: '0x742d35Cc6634C0532925a3b8D214B6F8e39Ba9Db',
      value: 1000000000000000000n,
      gas: 21000n,
      gasPrice: 20000000000n,
      nonce: 1,
      chainId: 1
    };
    
    // Test should not throw
    const result = await sign(transaction);
    expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('should handle message signing', async () => {
    const signature = await signMessage("Hello, world!");
    expect(signature).toBeDefined();
  });
});
```

### 3. Integration Tests

```typescript
// Test actual signing with your Lattice device
import { setup, sign } from 'gridplus-sdk';
import { parseEther, parseGwei } from 'viem';

const testSigning = async () => {
  // Set up connection first
  await setup({
    name: 'Integration Test',
    deviceId: 'ABC123',
    password: 'test-password',
    getStoredClient: () => localStorage.getItem('test-lattice-client'),
    setStoredClient: (client) => localStorage.setItem('test-lattice-client', client),
  });

  const result = await sign({
    to: '0x742d35Cc6634C0532925a3b8D214B6F8e39Ba9Db',
    value: parseEther('1'),
    gasPrice: parseGwei('20'),
    gas: 21000n,
    nonce: 1,
    chainId: 1
  });
  
  // Verify response format
  expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  expect(typeof result.sig.v).toBe('bigint');
};
```

## 📞 Support

If you encounter issues during migration:

1. Check the [GitHub Issues](https://github.com/GridPlus/gridplus-sdk/issues)
2. Review the [API Documentation](https://docs.gridplus.io)
3. Join our [Discord Community](https://discord.gg/gridplus)

## 📈 Benefits of v4

- **🎯 Specialized Functions**: Dedicated functions for each transaction type
- **🔒 Better Type Safety**: Full Viem integration prevents runtime errors
- **🧹 Cleaner API**: Reduced boilerplate and configuration complexity
- **⚡ Modern Standards**: Built for current Ethereum ecosystem
- **🚀 Enhanced Features**: EIP-7702 support for account abstraction
- **📈 Performance**: Optimized transaction serialization
- **🔮 Future-Proof**: Ready for upcoming Ethereum improvements
- **👨‍💻 Better DX**: Improved IntelliSense and developer experience

---

*This migration guide covers the major changes. For complete API reference, see the [full documentation](/).* 