export const ABI_TEST_VECTORS = [
  {
    name: "DAI totalSupply() - Zero parameters",
    tx: {
      type: 'eip1559' as const,
      to: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as `0x${string}`,
      value: BigInt(0),
      data: '0x18160ddd' as `0x${string}`,
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'),
      maxPriorityFeePerGas: BigInt('2000000000'),
      gas: BigInt('100000'),
      chainId: 1,
    },
    category: "empty-params"
  },
  {
    name: "DAI transfer() - Basic types (address,uint256)",
    tx: {
      type: 'eip1559' as const,
      to: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as `0x${string}`,
      value: BigInt(0),
      data: '0xa9059cbb000000000000000000000000742d35cc6b2d9e9a3b7b7b4a7b0b2b7b0b2b7b0b0000000000000000000000000000000000000000000000001bc16d674ec80000' as `0x${string}`,
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'),
      maxPriorityFeePerGas: BigInt('2000000000'),
      gas: BigInt('100000'),
      chainId: 1,
    },
    category: "basic-types"
  },
  {
    name: "DAI approve() - Basic types (address,uint256)",
    tx: {
      type: 'eip1559' as const,
      to: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as `0x${string}`,
      value: BigInt(0),
      data: '0x095ea7b3000000000000000000000000742d35cc6b2d9e9a3b7b7b4a7b0b2b7b0b2b7b0bffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' as `0x${string}`,
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'),
      maxPriorityFeePerGas: BigInt('2000000000'),
      gas: BigInt('100000'),
      chainId: 1,
    },
    category: "basic-types-2"
  },
  {
    name: "Uniswap V2 swapExactTokensForTokens() - Arrays and multiple params",
    tx: {
      type: 'eip1559' as const,
      to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' as `0x${string}`,
      value: BigInt(0),
      data: '0x38ed17390000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000c7d713b49da000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000742d35cc6b2d9e9a3b7b7b4a7b0b2b7b0b2b7b0b000000000000000000000000000000000000000000000000000000006553f10000000000000000000000000000000000000000000000000000000000000000020000000000000000000000006b175474e89094c44da98b954eedeac495271d0f000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7' as `0x${string}`,
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'),
      maxPriorityFeePerGas: BigInt('2000000000'),
      gas: BigInt('200000'),
      chainId: 1,
    },
    category: "defi-swap"
  },
  {
    name: "USDC transferFrom() - Three parameters (address,address,uint256)",
    tx: {
      type: 'eip1559' as const,
      to: '0xa0b86991c31cC495E4C9f0Bc06B0c9b3f5cDdC2C' as `0x${string}`,
      value: BigInt(0),
      data: '0x23b872dd000000000000000000000000742d35cc6b2d9e9a3b7b7b4a7b0b2b7b0b2b7b0b000000000000000000000000a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b20000000000000000000000000000000000000000000000000000000005f5e100' as `0x${string}`,
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'),
      maxPriorityFeePerGas: BigInt('2000000000'),
      gas: BigInt('300000'),
      chainId: 1,
    },
    category: "three-params"
  },
  {
    name: "WETH deposit() - Payable function with value",
    tx: {
      type: 'eip1559' as const,
      to: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`,
      value: BigInt('1000000000000000000'),
      data: '0xd0e30db0' as `0x${string}`,
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'),
      maxPriorityFeePerGas: BigInt('2000000000'),
      gas: BigInt('400000'),
      chainId: 1,
    },
    category: "payable-function"
  },
  {
    name: "WETH withdraw() - Single uint256 parameter",
    tx: {
      type: 'eip1559' as const,
      to: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`,
      value: BigInt(0),
      data: '0x2e1a7d4d0000000000000000000000000000000000000000000000000de0b6b3a7640000' as `0x${string}`,
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'),
      maxPriorityFeePerGas: BigInt('2000000000'),
      gas: BigInt('300000'),
      chainId: 1,
    },
    category: "single-param"
  },
  {
    name: "Uniswap V3 exactInputSingle() - Complex struct parameter",
    tx: {
      type: 'eip1559' as const,
      to: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' as `0x${string}`,
      value: BigInt(0),
      data: '0x414bf3890000000000000000000000006b175474e89094c44da98b954eedeac495271d0f000000000000000000000000a0b86991c31cc495e4c9f0bc06b0c9b3f5cddc2c0000000000000000000000000000000000000000000000000000000000000bb8000000000000000000000000742d35cc6b2d9e9a3b7b7b4a7b0b2b7b0b2b7b0b0000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000989680000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'),
      maxPriorityFeePerGas: BigInt('2000000000'),
      gas: BigInt('500000'),
      chainId: 1,
    },
    category: "complex-struct"
  },
  {
    name: "Curve remove_liquidity_one_coin() - Negative int and complex params",
    tx: {
      type: 'eip1559' as const,
      to: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7' as `0x${string}`,
      value: BigInt(0),
      data: '0x1a4d01d20000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000c7d713b49da0000' as `0x${string}`,
      nonce: 0,
      maxFeePerGas: BigInt('20000000000'),
      maxPriorityFeePerGas: BigInt('2000000000'),
      gas: BigInt('600000'),
      chainId: 1,
    },
    category: "complex-params"
  }
];