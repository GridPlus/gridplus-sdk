# 📜 Calldata Decoding

The Lattice's 5" touchscreen can display **decoded transaction calldata** instead of unreadable hex blobs. The SDK automatically fetches and caches contract ABIs to show human-readable function calls and parameters on the device screen.

:::info
Calldata decoding is automatic in v4.0 when using the `sign()` function for EVM transactions. The SDK handles ABI fetching and decoding behind the scenes.
:::

## How It Works

When you sign a contract interaction transaction:

1. **SDK detects contract call** - Checks if `data` field is present
2. **Fetches ABI** - Tries Etherscan first, falls back to 4byte.directory
3. **Caches decoder** - Stores ABI for future use
4. **Sends to device** - Lattice decodes and displays human-readable info
5. **User reviews** - Clear function name and parameters shown on screen

## Example: Automatic Decoding

**New in v4.0**: Calldata decoding happens automatically - no extra configuration needed!

```ts
import { setup, pair, sign } from 'gridplus-sdk';
import { encodeFunctionData, parseUnits, parseGwei } from 'viem';

// One-time setup
const isPaired = await setup({
  name: 'My DeFi App',
  deviceId: 'ABC123',
  password: 'my-secure-password',
  getStoredClient: () => localStorage.getItem('lattice-client'),
  setStoredClient: (client) => localStorage.setItem('lattice-client', client),
});

if (!isPaired) {
  const secret = prompt('Enter pairing code');
  await pair(secret);
}

// Build a contract interaction transaction
const erc20Abi = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
];

const tx = {
  type: 'eip1559',
  to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC contract
  data: encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [
      '0x742d35Cc6634C0532925a3b844Bc9e7595f8b2dc',
      parseUnits('100', 6), // 100 USDC
    ],
  }),
  value: 0n,
  nonce: 0,
  gas: 100000n,
  maxFeePerGas: parseGwei('20'),
  maxPriorityFeePerGas: parseGwei('2'),
  chainId: 1,
};

// Sign transaction - ABI decoding happens automatically!
const result = await sign(tx);

// User sees on Lattice screen:
// Contract: USDC Token
// Function: transfer
// recipient: 0x742d...b2dc
// amount: 100 USDC
```

## What the User Sees

### Before Decoding (Raw Hex)

```
To: 0xA0b8...eB48
Data: 0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f8b2dc0000000000000000000000000000000000000000000000000000000005f5e100
```

### After Decoding (Human-Readable)

```
Contract: USD Coin
Function: transfer
  recipient: 0x742d...b2dc
  amount: 100000000 (100 USDC)
```

## ABI Source Priority

The SDK fetches ABIs in this order:

1. **Etherscan** (Preferred)
   - Full contract ABI with parameter names
   - Only works for verified contracts
   - Includes function descriptions
   - Supports all EVM chains (Etherscan, Arbiscan, Polygonscan, etc.)

2. **4byte.directory** (Fallback)
   - Canonical function signature only
   - Works for unverified contracts
   - Parameter names show as `#1`, `#2`, etc.
   - Anyone can add missing signatures

:::tip
If you're building a dApp, verify your contracts on Etherscan! This gives users the best experience with parameter names and function descriptions.
:::

## Security Considerations

### Information Attacks

You might wonder: "Can someone submit a malicious ABI to trick users?"

**Short answer**: No, this is not a practical attack.

**Why it's safe**:

1. **Etherscan ABIs** - Only available for verified contracts (source code must match bytecode)
2. **4byte collision** - Extremely difficult to create a meaningful collision with just 4 bytes
3. **Self-referential spec** - The first 4 bytes of calldata must match the ABI, and these bytes are immutable in the transaction
4. **Validation** - If the ABI doesn't match the calldata, Lattice shows raw hex instead (alerts user)

### Calldata Mismatch Detection

If an ABI definition doesn't match the transaction calldata:

- Lattice firmware detects the mismatch
- Falls back to displaying raw hex
- User sees something is wrong

```
⚠️ UNABLE TO DECODE
Data: 0xa9059cbb0000...
(Proceed with caution)
```

## Advanced: DeFi Protocol Interactions

### Uniswap Swap Example

```ts
import { sign } from 'gridplus-sdk/api/signing';
import { encodeFunctionData, parseEther, parseGwei } from 'viem';

const uniswapRouterAbi = [
  {
    name: 'swapExactTokensForTokens',
    type: 'function',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
];

const tx = {
  type: 'eip1559',
  to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap Router
  data: encodeFunctionData({
    abi: uniswapRouterAbi,
    functionName: 'swapExactTokensForTokens',
    args: [
      parseUnits('1000', 6), // 1000 USDC
      parseUnits('0.95', 18), // Min 0.95 ETH
      [usdcAddress, wethAddress], // USDC -> WETH
      userAddress,
      Math.floor(Date.now() / 1000) + 1800, // 30 min deadline
    ],
  }),
  value: 0n,
  gas: 300000n,
  maxFeePerGas: parseGwei('20'),
  maxPriorityFeePerGas: parseGwei('2'),
  chainId: 1,
};

const result = await sign(tx);

// User sees:
// Contract: Uniswap V2 Router
// Function: swapExactTokensForTokens
//   amountIn: 1000 USDC
//   amountOutMin: 0.95 ETH
//   path: [USDC, WETH]
//   to: 0x742d...b2dc
//   deadline: 30 minutes
```

## Supported Chains

Automatic ABI fetching works on all EVM chains with Etherscan-compatible explorers:

- Ethereum (Etherscan)
- Arbitrum (Arbiscan)
- Polygon (Polygonscan)
- Optimism (Optimistic Etherscan)
- Base (Basescan)
- Avalanche (Snowtrace)
- BSC (BscScan)
- And many more...

## Troubleshooting

### ABI Not Decoding

If your transaction shows hex instead of decoded params:

1. **Check contract verification** - Is the contract verified on Etherscan?
2. **Check 4byte** - Does the function signature exist on 4byte.directory?
3. **Check calldata format** - Is the `data` field properly formatted?
4. **Check network** - Is the SDK using the correct chain explorer?

### Adding Missing Functions to 4byte

If your function isn't on 4byte.directory:

1. Go to [4byte.directory](https://4byte.directory)
2. Click "Submit Signature"
3. Enter your function signature (e.g., `transfer(address,uint256)`)
4. The SDK will automatically use it for future transactions

## Migration from v3.x

**v3.x required manual decoder setup**:

```ts
const { def } = await Utils.fetchCalldataDecoder(
  calldata,
  contractAddress,
  chainId,
);
const req = { ...txData, decoder: def };
```

**v4.0 handles it automatically**:

```ts
// Just sign - decoding happens behind the scenes!
const result = await sign(tx);
```

See the [Migration Guide](../migration-v3-to-v4) for complete v3 → v4 upgrade instructions.
