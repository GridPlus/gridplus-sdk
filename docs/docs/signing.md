---
id: 'signing'
sidebar_position: 3
---

# 🧾 Signing Guide

## Overview

The GridPlus SDK provides a comprehensive signing interface for transactions and messages across multiple blockchains. All signing operations use Viem-compatible formats and maintain end-to-end encryption with your Lattice1 device.

### How Signing Works

1. **Create** - Build your transaction using Viem's `TransactionSerializable` format
2. **Serialize** - SDK converts to RLP encoding for transmission
3. **Encrypt** - Request sent through secure channel to device
4. **Display** - Lattice1 decodes and shows transaction details
5. **Approve** - User physically confirms on device screen
6. **Return** - Signed transaction returned, ready to broadcast

## Core Principles

### Security First

- **Private keys never leave the device** - All signing happens in the secure element
- **What you see is what you sign** - Transaction details are decoded and displayed
- **Physical approval required** - No remote signing without user consent
- **End-to-end encryption** - All communication is encrypted with session keys

### Type Safety & Validation

**New in v4.0**: Automatic transaction validation using Zod schemas ensures your transactions are correct before they're sent to the device.

```ts
// ❌ This will throw a clear validation error
const invalidTx = {
  type: 'eip1559',
  to: 'not-an-address', // Invalid hex address
  value: '0.1', // Should be bigint
  gas: 21000, // Should be bigint (21000n)
  // Missing required fields...
};

await sign(invalidTx);
// Error: Transaction validation failed:
//   - to: Invalid Ethereum address format
//   - value: Expected bigint, received string
//   - gas: Expected bigint, received number
//   - maxFeePerGas: Required field missing
```

**What gets validated**:

- Transaction type matches structure (legacy, eip1559, eip2930, eip7702)
- Required fields present for each type
- Correct data types (bigint for numbers, hex for addresses/hashes)
- Valid Ethereum addresses and hashes
- Properly formatted access lists and authorization lists

**Benefits**:

- **Catch errors early** - Before sending to device
- **Clear error messages** - Know exactly what's wrong
- **TypeScript integration** - Full IDE autocomplete support
- **Automatic normalization** - Handles `0x` prefix variations

:::tip
Zod validation helps you catch common mistakes like forgetting the `n` suffix on bigint values or using the wrong field names. This saves development time and prevents frustrating debugging sessions.
:::

### Active Wallet

The Lattice1 signs from its currently active wallet:

- **Internal Wallet** - The device's built-in HD wallet
- **SafeCard** - When inserted and unlocked, becomes the active wallet

### Derivation Paths

Every signing request needs a derivation path to identify which key to use:

- Follows BIP32/BIP44 standards
- Path determines which private key signs the transaction
- Must match the blockchain's expected format

## Message Signing

### Simple Messages

For signing plain text messages (like login challenges), use `signMessage`:

```ts
import { signMessage } from 'gridplus-sdk/api/signing';

// Simple text message
const message = 'Sign this message to prove you own this address';
const result = await signMessage(message);

// What the user sees on Lattice1:
// - Message type: "Personal Message"
// - Full message text (scrollable)
// - Signing address

// Result structure:
console.log(result.sig); // { r: '0x...', s: '0x...', v: 27 }
console.log(result.signer); // '0x742d35Cc6634C0532925a3b844Bc9e7595f8b2dc'

// The signature can be verified with:
// - ethers: verifyMessage(message, signature)
// - viem: verifyMessage({ message, signature, address })
```

### How Personal Sign Works

1. **Message Preparation** - Prefixed with `"\x19Ethereum Signed Message:\n" + length`
2. **Display** - Shows as ASCII text on device (hex if not readable)
3. **Signing** - Uses secp256k1 curve with keccak256 hash
4. **Recovery** - Signature includes recovery parameter (v) for address recovery

## Transaction Display & Decoding

### How Transactions Are Displayed

The Lattice1 decodes and displays transaction details based on the transaction type:

#### Standard Transfers

```
To: 0x742d...b2dc
Value: 0.1 ETH
Gas: 21000
Max Fee: 20 gwei
Priority: 2 gwei
Chain: Ethereum
```

#### Contract Interactions

```
To: Uniswap V3 Router
Function: swapExactTokensForTokens
Amount In: 1000 USDC
Amount Out Min: 0.95 ETH
Path: USDC -> ETH
Deadline: 30 mins
```

### ABI Decoding

The SDK automatically fetches and caches contract ABIs to show human-readable function calls:

```ts
import { sign } from 'gridplus-sdk/api/signing';

// Contract interaction - will be decoded on device
const tx = {
  type: 'eip1559',
  to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap Router
  data: '0x38ed1739...', // swapExactTokensForTokens calldata
  value: 0n,
  // ... gas parameters
};

const result = await sign(tx);
// User sees decoded function name and parameters on device
```

### Supported Encoding Types

The SDK automatically detects and applies the appropriate encoding:

| Transaction Type | What User Sees            | Encoding Used  |
| :--------------- | :------------------------ | :------------- |
| ETH Transfer     | To, Value, Gas details    | `EVM`          |
| ERC20 Transfer   | Token, Recipient, Amount  | `EVM` with ABI |
| Contract Call    | Function name, Parameters | `EVM` with ABI |
| Solana Transfer  | From, To, Lamports        | `SOLANA`       |
| Bitcoin          | Inputs, Outputs, Fee      | `BTC`          |
| Raw Message      | Hex or ASCII display      | `NONE`         |

## EVM Transaction Signing

### Transaction Types

The SDK supports all Ethereum transaction types using Viem's format:

#### EIP-1559 (Type 2) - Recommended

```ts
import { sign } from 'gridplus-sdk/api/signing';
import { parseEther, parseGwei } from 'viem';

const tx = {
  type: 'eip1559',
  to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
  value: parseEther('0.1'),
  nonce: 0,
  gas: 21000n,
  maxFeePerGas: parseGwei('20'),
  maxPriorityFeePerGas: parseGwei('2'),
  chainId: 1,
};

const result = await sign(tx);
```

#### Legacy (Type 0)

```ts
const tx = {
  type: 'legacy',
  to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
  value: parseEther('0.1'),
  nonce: 0,
  gasPrice: parseGwei('20'),
  gasLimit: 21000n,
  chainId: 1,
};

const result = await sign(tx);
```

#### EIP-2930 (Type 1) - With Access List

```ts
const tx = {
  type: 'eip2930',
  to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
  value: 0n,
  nonce: 0,
  gasPrice: parseGwei('20'),
  gasLimit: 100000n,
  chainId: 1,
  accessList: [
    {
      address: '0x...',
      storageKeys: ['0x...', '0x...'],
    },
  ],
};

const result = await sign(tx);
```

### Return Values

```ts
interface SignData {
  tx: string; // Complete signed transaction (ready to broadcast)
  txHash: string; // Transaction hash (keccak256)
  sig: {
    // Signature components
    r: string; // Signature r value
    s: string; // Signature s value
    v: number; // Recovery parameter
  };
  signer: string; // Address that signed
}
```

### Contract Interactions

```ts
// ERC20 Transfer
const erc20Transfer = {
  type: 'eip1559',
  to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  data: encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipientAddress, parseUnits('100', 6)], // 100 USDC
  }),
  value: 0n,
  // ... gas parameters
};

// DeFi Protocol Interaction
const swapTx = {
  type: 'eip1559',
  to: uniswapRouterAddress,
  data: swapCalldata,
  value: parseEther('1'), // If swapping ETH
  // ... gas parameters
};

// The Lattice1 will show:
// - Contract name (if verified)
// - Function being called
// - Decoded parameters
// - Token amounts (for known tokens)
```

## EIP-7702 Account Abstraction

### Understanding EIP-7702

EIP-7702 allows an EOA (Externally Owned Account) to temporarily act as a smart contract:

1. **Authorization** - EOA signs permission to delegate to a contract
2. **Delegation** - Transaction sets the EOA's code to point to the contract
3. **Execution** - EOA can now execute smart contract logic
4. **Reversion** - Code returns to empty after transaction

### Step 1: Sign Authorization

```ts
import { signAuthorization } from 'gridplus-sdk/api/signing';

// Grant permission for your EOA to use smart contract logic
const authRequest = {
  // Contract that will handle your account's logic
  address: '0x0000000000219ab540356cBB839Cbe05303d7705',
  chainId: 1,
  nonce: 0, // 0 = reusable, or use current nonce for one-time
};

// User sees on device:
// "Authorize Contract"
// Contract: 0x0000...7705
// Chain ID: 1
// Nonce: 0

const authorization = await signAuthorization(authRequest);
// Returns: { address, chainId, nonce, r, s, yParity }
```

### Step 2: Use in Transaction

```ts
import { sign } from 'gridplus-sdk/api/signing';

// Create transaction with authorization
const tx = {
  type: 'eip7702',
  authorizationList: [authorization],
  to: myEOA, // Call your own EOA with the delegated code
  value: 0n,
  data: encodeFunctionData({
    abi: accountAbstractionAbi,
    functionName: 'executeBatch',
    args: [operations],
  }),
  chainId: 1,
  nonce: currentNonce,
  gas: 200000n,
  maxFeePerGas: parseGwei('20'),
  maxPriorityFeePerGas: parseGwei('2'),
};

const result = await sign(tx);
```

### Use Cases

1. **Batched Transactions** - Execute multiple operations in one transaction
2. **Gas Sponsorship** - Have someone else pay for your gas
3. **Advanced Logic** - Conditional execution, limits, automation
4. **Session Keys** - Temporary permissions for dApps

## Advanced Signing Scenarios

### Multi-Chain Support

The SDK supports any EVM-compatible chain:

```ts
// Polygon
const polygonTx = {
  type: 'eip1559',
  to: recipient,
  value: parseEther('10'), // 10 MATIC
  chainId: 137,
  // ... other fields
};

// Arbitrum
const arbitrumTx = {
  type: 'eip1559',
  to: recipient,
  value: parseEther('0.01'),
  chainId: 42161,
  // ... other fields
};

// BSC (uses legacy transactions)
const bscTx = {
  type: 'legacy',
  to: recipient,
  value: parseEther('1'), // 1 BNB
  chainId: 56,
  gasPrice: parseGwei('5'),
  // ... other fields
};
```

### EIP-712 Typed Data Signing

#### What is EIP-712?

EIP-712 provides structured, human-readable message signing:

- **Structured Data** - JSON-like format instead of raw bytes
- **Domain Separation** - Prevents signature replay across dApps
- **Type Safety** - Explicit types for each field

#### Example: DeFi Permit

```ts
import { signMessage } from 'gridplus-sdk/api/signing';

const permit = {
  domain: {
    name: 'USD Coin',
    version: '2',
    chainId: 1,
    verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  types: {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
  primaryType: 'Permit',
  message: {
    owner: myAddress,
    spender: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap
    value: parseUnits('1000', 6), // 1000 USDC
    nonce: 0,
    deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  },
};

// User sees on Lattice1:
// "Sign Typed Data"
// Domain: USD Coin v2
// Permit:
//   Owner: 0x742d...b2dc
//   Spender: Uniswap V2 Router
//   Value: 1000 USDC
//   Deadline: in 1 hour

const result = await signMessage(permit);
```

#### Common EIP-712 Use Cases

1. **Token Permits** - Gasless token approvals
2. **Order Signing** - DEX limit orders
3. **Governance Votes** - Off-chain voting
4. **Meta Transactions** - Gasless transactions

## Bitcoin

The SDK provides dedicated functions for Bitcoin transactions based on address type:

### Legacy (P2PKH)

```ts
import { signBtcLegacyTx } from 'gridplus-sdk/api/signing';

const payload = {
  prevOuts: [
    {
      txHash:
        '2aba3db3dc5b1b3ded7231d90fe333e184d24672eb0b6466dbc86228b8996112',
      value: 100000, // satoshis
      index: 3,
      signerPath: [0x80000000 + 44, 0x80000000, 0x80000000, 0, 12],
    },
  ],
  recipient: '1FKpGnhtR3ZrVcU8hfEdMe8NpweFb2sj5F',
  value: 50000,
  fee: 20000,
  changePath: [0x80000000 + 44, 0x80000000, 0x80000000, 1, 0],
};

const result = await signBtcLegacyTx(payload);
// Returns: { tx, txHash, changeRecipient }
```

### Segwit (P2WPKH)

```ts
import { signBtcSegwitTx } from 'gridplus-sdk/api/signing';

const payload = {
  prevOuts: [
    {
      txHash:
        '2aba3db3dc5b1b3ded7231d90fe333e184d24672eb0b6466dbc86228b8996112',
      value: 100000,
      index: 3,
      signerPath: [0x80000000 + 84, 0x80000000, 0x80000000, 0, 12],
    },
  ],
  recipient: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  value: 50000,
  fee: 20000,
  changePath: [0x80000000 + 84, 0x80000000, 0x80000000, 1, 0],
};

const result = await signBtcSegwitTx(payload);
```

### Wrapped Segwit (P2SH-P2WPKH)

```ts
import { signBtcWrappedSegwitTx } from 'gridplus-sdk/api/signing';

const payload = {
  prevOuts: [
    {
      txHash:
        '2aba3db3dc5b1b3ded7231d90fe333e184d24672eb0b6466dbc86228b8996112',
      value: 100000,
      index: 3,
      signerPath: [0x80000000 + 49, 0x80000000, 0x80000000, 0, 12],
    },
  ],
  recipient: '3JvL6Ymt8MVWiCNHC7oWU6nLeHNJKLZGLN',
  value: 50000,
  fee: 20000,
  changePath: [0x80000000 + 49, 0x80000000, 0x80000000, 1, 0],
};

const result = await signBtcWrappedSegwitTx(payload);
```

## Solana

For Solana transactions, use `signSolanaTx`:

```ts
import { signSolanaTx } from 'gridplus-sdk/api/signing';
import { Transaction, SystemProgram } from '@solana/web3.js';

// Create a Solana transaction
const transfer = SystemProgram.transfer({
  fromPubkey: fromPublicKey,
  toPubkey: toPublicKey,
  lamports: 1234,
});

const transaction = new Transaction({ recentBlockhash }).add(transfer);

// Sign the transaction
const payload = {
  tx: transaction,
};

const result = await signSolanaTx(payload);
// Returns: { tx, txHash, sigs }
```
