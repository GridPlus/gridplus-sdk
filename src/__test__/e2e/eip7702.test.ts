/* eslint-disable quotes */
import { mnemonicToSeedSync } from 'bip39';
import { question } from 'readline-sync';
import { createWalletClient, Hex, http, parseEther, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';
import {
  fetchAddress,
  pair,
  signAuthorization,
  signAuthorizationList,
} from '../../api/index';
import { DEFAULT_ETH_DERIVATION } from '../../constants';
import { deriveAddress } from '../utils/determinism';
import { setupClient } from '../utils/setup';

// Foundry test mnemonic
const FOUNDRY_TEST_MNEMONIC =
  'test test test test test test test test test test test junk';
const FOUNDRY_TEST_SEED = mnemonicToSeedSync(FOUNDRY_TEST_MNEMONIC);

// Utility function to create foundry account address for comparison
const getFoundryAddress = (): Address => {
  // Use first account derivation path m/44'/60'/0'/0/0
  const foundryPath = [44 + 0x80000000, 60 + 0x80000000, 0x80000000, 0, 0];
  return deriveAddress(FOUNDRY_TEST_SEED, foundryPath as any) as Address;
};

// Get Foundry private key for signing
const getFoundryPrivateKey = (): Hex => {
  return '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Foundry test account #0 private key
};

// Create foundry account for actual signing
const getFoundryAccount = () => {
  const privateKey = getFoundryPrivateKey();
  return privateKeyToAccount(privateKey);
};

// Create a wallet client for Foundry account
const createFoundryWalletClient = () => {
  const account = getFoundryAccount();
  return createWalletClient({
    account,
    chain: mainnet,
    transport: http(),
  });
};

// EIP-7702 Authorization signing function using Foundry account with Viem's built-in method
const signFoundryAuthorization = async (params: {
  chainId: number;
  contractAddress: Address;
  nonce: number;
}) => {
  const walletClient = createFoundryWalletClient();
  const account = getFoundryAccount();

  // Use the wallet client's signAuthorization method
  const authorization = await (walletClient as any).signAuthorization({
    account,
    contractAddress: params.contractAddress,
    chainId: params.chainId,
    nonce: params.nonce,
  });

  return {
    r: authorization.r,
    s: authorization.s,
    yParity: authorization.yParity,
  };
};

describe('EIP-7702 Foundry Comparison Tests (Same Mnemonic)', () => {
  let latticeAddress: Address;
  let foundryAccount: ReturnType<typeof getFoundryAccount>;

  beforeAll(async () => {
    // Setup Lattice connection
    const isPaired = await setupClient();

    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }

    // Get Lattice address (should match Foundry if same mnemonic is used)
    latticeAddress = (await fetchAddress(DEFAULT_ETH_DERIVATION)) as Address;

    // Get Foundry test address and account
    getFoundryAddress();
    foundryAccount = getFoundryAccount();

    // Verify addresses match if same mnemonic is used
    if (latticeAddress.toLowerCase() !== foundryAccount.address.toLowerCase()) {
      throw new Error(
        `Addresses do not match. Lattice: ${latticeAddress}, Foundry: ${foundryAccount.address}`,
      );
    }
  });

  /**
   * Test comparing EIP-7702 authorization signatures with same nonce
   */
  test('Compare EIP-7702 authorization signatures: Same nonce comparison', async () => {
    // Use a specific nonce for comparison
    const testNonce = 42;

    const authorizationParams = {
      chainId: 1,
      contractAddress: '0x769F783730E49994F724069898f8738bFd406DfD' as Address,
      nonce: testNonce,
    };

    try {
      // 1️⃣ Sign authorization with Lattice
      const latticeAuthSig = await signAuthorization(authorizationParams);

      // 2️⃣ Sign authorization with Foundry account
      const foundryAuthSig =
        await signFoundryAuthorization(authorizationParams);

      // 4️⃣ Compare signatures
      const latticeYParity =
        typeof latticeAuthSig.yParity === 'string'
          ? parseInt(latticeAuthSig.yParity, 16)
          : latticeAuthSig.yParity;

      // 6️⃣ Verify signatures are valid
      expect(latticeAuthSig.r).toBeDefined();
      expect(latticeAuthSig.s).toBeDefined();
      expect(foundryAuthSig.r).toBeDefined();
      expect(foundryAuthSig.s).toBeDefined();
      expect(typeof latticeYParity).toBe('number');
      expect(typeof foundryAuthSig.yParity).toBe('number');
      expect([0, 1]).toContain(latticeYParity);
      expect([0, 1]).toContain(foundryAuthSig.yParity);

      // Verify signature format consistency
      expect(latticeAuthSig.r.startsWith('0x')).toBe(true);
      expect(latticeAuthSig.s.startsWith('0x')).toBe(true);
      expect(foundryAuthSig.r.startsWith('0x')).toBe(true);
      expect(foundryAuthSig.s.startsWith('0x')).toBe(true);
      expect(latticeAuthSig.r.length).toBe(66);
      expect(latticeAuthSig.s.length).toBe(66);
      expect(foundryAuthSig.r.length).toBe(66);
      expect(foundryAuthSig.s.length).toBe(66);

      // 7️⃣ Assert that signatures match exactly (same keys + same nonce = same signature)
      expect(latticeAuthSig.r).toBe(foundryAuthSig.r);
      expect(latticeAuthSig.s).toBe(foundryAuthSig.s);
      expect(latticeYParity).toBe(foundryAuthSig.yParity);
    } catch (error) {
      throw error;
    }
  });

  /**
   * Test comparing full EIP-7702 transaction signing with same nonce
   */
  test('Compare EIP-7702 transaction signing: Same nonce comparison', async () => {
    const testNonce = 43;

    // Create authorization using the same nonce for both
    const authorizationParams = {
      chainId: 1,
      contractAddress: '0x769F783730E49994F724069898f8738bFd406DfD' as Address,
      nonce: testNonce,
    };

    // First get authorization signature from both implementations
    const latticeAuthSig = await signAuthorization(authorizationParams);
    const foundryAuthSig = await signFoundryAuthorization(authorizationParams);

    // Create EIP-7702 transaction with Lattice authorization
    const latticeTransaction = {
      type: 'eip7702' as const,
      chainId: 1,
      nonce: testNonce + 1, // Transaction nonce should be different from auth nonce
      maxPriorityFeePerGas: BigInt(parseEther('0.000000001')),
      maxFeePerGas: BigInt(parseEther('0.00000001')),
      to: '0x769F783730E49994F724069898f8738bFd406DfD' as Address,
      value: BigInt(parseEther('0.1')),
      data: '0x12345678' as Hex,
      authorizationList: [
        {
          chainId: 1,
          address: authorizationParams.contractAddress, // Lattice API expects 'address'
          nonce: testNonce,
          yParity: latticeAuthSig.yParity,
          r: latticeAuthSig.r,
          s: latticeAuthSig.s,
        },
      ],
    };

    // Create EIP-7702 transaction with Foundry authorization
    const foundryTransaction = {
      type: 'eip7702' as const,
      chainId: 1,
      nonce: testNonce + 1,
      maxPriorityFeePerGas: BigInt(parseEther('0.000000001')),
      maxFeePerGas: BigInt(parseEther('0.00000001')),
      to: '0x769F783730E49994F724069898f8738bFd406DfD' as Address,
      value: BigInt(parseEther('0.1')),
      data: '0x12345678' as Hex,
      authorizationList: [
        {
          chainId: 1,
          address: authorizationParams.contractAddress, // Both APIs expect 'address'
          nonce: testNonce,
          yParity: foundryAuthSig.yParity,
          r: foundryAuthSig.r,
          s: foundryAuthSig.s,
        },
      ],
    };

    try {
      // 1️⃣ Sign transaction with Lattice
      const latticeResult = await signAuthorizationList(latticeTransaction);

      // 2️⃣ Sign transaction with Foundry account
      const foundryTxHash =
        await foundryAccount.signTransaction(foundryTransaction);

      // 5️⃣ Verify both transactions are properly signed
      // Note: signAuthorizationList only signs the authorization list, not the full transaction
      // so it won't return a txHash - that would only come from signing the complete transaction
      expect(latticeResult.sig.r).toBeDefined();
      expect(latticeResult.sig.s).toBeDefined();
      expect(foundryTxHash).toBeDefined();
      expect(foundryTxHash.startsWith('0x04')).toBe(true); // EIP-7702 type

      // 7️⃣ Assert that the authorization signatures used in transactions match
      // Normalize yParity to ensure both are numbers for comparison
      const latticeYParity =
        typeof latticeAuthSig.yParity === 'string'
          ? parseInt(latticeAuthSig.yParity, 16)
          : latticeAuthSig.yParity;

      expect(latticeAuthSig.r).toBe(foundryAuthSig.r);
      expect(latticeAuthSig.s).toBe(foundryAuthSig.s);
      expect(latticeYParity).toBe(foundryAuthSig.yParity);
    } catch (error) {
      throw error;
    }
  });
});
