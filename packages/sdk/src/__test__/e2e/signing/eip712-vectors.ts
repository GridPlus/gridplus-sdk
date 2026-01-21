/**
 * EIP-712 Typed Data Test Vectors
 *
 * These vectors test EIP-712 message signing compatibility between Lattice and viem.
 * Each vector contains domain, types, primaryType, and message data.
 */

import type { EIP712TestMessage } from '../../utils/viemComparison';

// Mock contract address for EIP-712 domain
const MOCK_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';

export const EIP712_MESSAGE_VECTORS: Array<{
  name: string;
  message: EIP712TestMessage;
}> = [
  {
    name: 'Negative Amount - Basic negative integer',
    message: {
      domain: {
        name: 'NegativeAmountHandler',
        version: '1',
        chainId: 1,
        verifyingContract: MOCK_CONTRACT_ADDRESS,
      },
      types: {
        Data: [
          { name: 'amount', type: 'int256' },
          { name: 'message', type: 'string' },
        ],
      },
      primaryType: 'Data',
      message: {
        amount: -100,
        message: 'Negative payment test',
      },
    },
  },
  {
    name: 'Negative Amount - Large negative value',
    message: {
      domain: {
        name: 'NegativeAmountHandler',
        version: '1',
        chainId: 1,
        verifyingContract: MOCK_CONTRACT_ADDRESS,
      },
      types: {
        Data: [
          { name: 'amount', type: 'int256' },
          { name: 'message', type: 'string' },
        ],
      },
      primaryType: 'Data',
      message: {
        amount: -1000000000000,
        message: 'Large negative amount',
      },
    },
  },
  {
    name: 'Negative Amount - Zero value',
    message: {
      domain: {
        name: 'NegativeAmountHandler',
        version: '1',
        chainId: 1,
        verifyingContract: MOCK_CONTRACT_ADDRESS,
      },
      types: {
        Data: [
          { name: 'amount', type: 'int256' },
          { name: 'message', type: 'string' },
        ],
      },
      primaryType: 'Data',
      message: {
        amount: 0,
        message: 'Zero amount test',
      },
    },
  },
  {
    name: 'Negative Amount - Positive value',
    message: {
      domain: {
        name: 'NegativeAmountHandler',
        version: '1',
        chainId: 1,
        verifyingContract: MOCK_CONTRACT_ADDRESS,
      },
      types: {
        Data: [
          { name: 'amount', type: 'int256' },
          { name: 'message', type: 'string' },
        ],
      },
      primaryType: 'Data',
      message: {
        amount: 500,
        message: 'Positive amount test',
      },
    },
  },
  {
    name: 'Mail - Basic email structure',
    message: {
      domain: {
        name: 'Ether Mail',
        version: '1',
        chainId: 1,
        verifyingContract: MOCK_CONTRACT_ADDRESS,
      },
      types: {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' },
        ],
      },
      primaryType: 'Mail',
      message: {
        from: {
          name: 'Alice',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: 'Hello, Bob!',
      },
    },
  },
  {
    name: 'Permit - ERC20 approval',
    message: {
      domain: {
        name: 'USD Coin',
        version: '2',
        chainId: 1,
        verifyingContract: MOCK_CONTRACT_ADDRESS,
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
        owner: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        spender: '0x1234567890123456789012345678901234567890',
        value: 1000000,
        nonce: 0,
        deadline: 9999999999,
      },
    },
  },
  {
    name: 'Vote - Governance voting',
    message: {
      domain: {
        name: 'Governance',
        version: '1',
        chainId: 1,
        verifyingContract: MOCK_CONTRACT_ADDRESS,
      },
      types: {
        Vote: [
          { name: 'proposalId', type: 'uint256' },
          { name: 'support', type: 'bool' },
          { name: 'voter', type: 'address' },
        ],
      },
      primaryType: 'Vote',
      message: {
        proposalId: 42,
        support: true,
        voter: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
      },
    },
  },
  {
    name: 'Complex Types - Nested structures',
    message: {
      domain: {
        name: 'Complex Protocol',
        version: '1',
        chainId: 1,
        verifyingContract: MOCK_CONTRACT_ADDRESS,
      },
      types: {
        Asset: [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        Order: [
          { name: 'trader', type: 'address' },
          { name: 'baseAsset', type: 'Asset' },
          { name: 'quoteAsset', type: 'Asset' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Order',
      message: {
        trader: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        baseAsset: {
          token: '0x1234567890123456789012345678901234567890',
          amount: 1000,
        },
        quoteAsset: {
          token: '0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd',
          amount: 2000,
        },
        deadline: 9999999999,
      },
    },
  },
  {
    name: 'Edge Case - Empty string',
    message: {
      domain: {
        name: 'Test',
        version: '1',
        chainId: 1,
        verifyingContract: MOCK_CONTRACT_ADDRESS,
      },
      types: {
        Data: [{ name: 'value', type: 'string' }],
      },
      primaryType: 'Data',
      message: {
        value: '',
      },
    },
  },
  {
    name: 'Edge Case - Maximum uint256',
    message: {
      domain: {
        name: 'Test',
        version: '1',
        chainId: 1,
        verifyingContract: MOCK_CONTRACT_ADDRESS,
      },
      types: {
        Data: [{ name: 'value', type: 'uint256' }],
      },
      primaryType: 'Data',
      message: {
        value: BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935'),
      },
    },
  },
  {
    name: 'Edge Case - Minimum int256',
    message: {
      domain: {
        name: 'Test',
        version: '1',
        chainId: 1,
        verifyingContract: MOCK_CONTRACT_ADDRESS,
      },
      types: {
        Data: [{ name: 'value', type: 'int256' }],
      },
      primaryType: 'Data',
      message: {
        value: BigInt('-57896044618658097711785492504343953926634992332820282019728792003956564819968'),
      },
    },
  },
  {
    name: 'Different Chain - Polygon',
    message: {
      domain: {
        name: 'Test',
        version: '1',
        chainId: 137,
        verifyingContract: MOCK_CONTRACT_ADDRESS,
      },
      types: {
        Data: [{ name: 'message', type: 'string' }],
      },
      primaryType: 'Data',
      message: {
        message: 'Polygon test',
      },
    },
  },
  {
    name: 'Different Chain - BSC',
    message: {
      domain: {
        name: 'Test',
        version: '1',
        chainId: 56,
        verifyingContract: MOCK_CONTRACT_ADDRESS,
      },
      types: {
        Data: [{ name: 'message', type: 'string' }],
      },
      primaryType: 'Data',
      message: {
        message: 'BSC test',
      },
    },
  },
];
