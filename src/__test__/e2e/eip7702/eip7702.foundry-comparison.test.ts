/* eslint-disable quotes */
import { question } from 'readline-sync';
import {
  getAddress,
  Hex,
  parseEther,
  TransactionSerializableEIP7702,
  type Address,
  serializeTransaction,
  keccak256,
  hashMessage,
  toBytes,
  concat,
  toHex,
  toRlp,
  hexToSignature,
  signatureToHex,
  createWalletClient,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mnemonicToSeedSync } from 'bip39';
import {
  pair,
  signAuthorizationList,
  signAuthorization,
  fetchAddress,
} from '../../../api/index';
import { setupClient } from '../../utils/setup';
import { DEFAULT_ETH_DERIVATION } from '../../../constants';
import { deriveAddress, TEST_SEED } from '../../utils/determinism';
import { mainnet } from 'viem/chains';

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
  const foundryPath = [44 + 0x80000000, 60 + 0x80000000, 0x80000000, 0, 0];
  // This would need to be implemented - for now we'll use a mock
  // In a real scenario, you'd derive the private key from the same path
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

// Debug utility function to print detailed comparison info
const debugCompare = (
  label: string,
  latticeResult: any,
  foundryResult: any,
) => {
  console.log('\n========== COMPARISON DEBUG ==========');
  console.log(`${label}:`);
  console.log('Lattice Result:', JSON.stringify(latticeResult, null, 2));
  console.log('Foundry Result:', JSON.stringify(foundryResult, null, 2));
  console.log('=====================================\n');
};

describe('EIP-7702 Foundry Comparison Tests (Same Mnemonic)', () => {
  let latticeAddress: Address;
  let foundryAddress: Address;
  let foundryAccount: ReturnType<typeof getFoundryAccount>;

  beforeAll(async () => {
    // Setup Lattice connection
    console.log('⏱️ Setting up Lattice connection');
    const isPaired = await setupClient();
    console.log(
      '📱 Pairing status:',
      isPaired ? 'ALREADY PAIRED' : 'NOT PAIRED',
    );

    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      console.log('🔑 Attempting to pair with secret');
      await pair(secret.toUpperCase());
      console.log('✅ Pairing completed');
    }

    // Get Lattice address (should match Foundry if same mnemonic is used)
    latticeAddress = (await fetchAddress(DEFAULT_ETH_DERIVATION)) as Address;
    console.log('🏠 Lattice address:', latticeAddress);

    // Get Foundry test address and account
    foundryAddress = getFoundryAddress();
    foundryAccount = getFoundryAccount();
    console.log('🧪 Foundry test account address:', foundryAddress);
    console.log('🧪 Foundry account from private key:', foundryAccount.address);

    // Verify addresses match if same mnemonic is used
    console.log('\n🔍 ADDRESS VERIFICATION:');
    if (latticeAddress.toLowerCase() === foundryAccount.address.toLowerCase()) {
      console.log('✅ ADDRESSES MATCH - Same mnemonic confirmed!');
    } else {
      console.log('⚠️ ADDRESSES DIFFER - Different mnemonics being used');
      console.log(`  Lattice: ${latticeAddress}`);
      console.log(`  Foundry: ${foundryAccount.address}`);
    }
  });

  /**
   * Test comparing EIP-7702 authorization signatures with same nonce
   */
  test('Compare EIP-7702 authorization signatures: Same nonce comparison', async () => {
    console.log(
      '\n🔍 COMPARING EIP-7702 AUTHORIZATION SIGNATURES (SAME NONCE)',
    );

    // Use a specific nonce for comparison
    const testNonce = 42;

    const authorizationParams = {
      chainId: 1,
      contractAddress: '0x769F783730E49994F724069898f8738bFd406DfD' as Address,
      nonce: testNonce,
    };

    console.log('📋 Authorization parameters:', authorizationParams);

    try {
      // 1️⃣ Sign authorization with Lattice
      console.log('\n🔐 Signing authorization with Lattice...');
      const latticeAuthSig = await signAuthorization(authorizationParams);
      console.log('✅ Lattice authorization signature obtained');

      // 2️⃣ Sign authorization with Foundry account
      console.log('🧪 Signing authorization with Foundry account...');
      const foundryAuthSig =
        await signFoundryAuthorization(authorizationParams);
      console.log('✅ Foundry authorization signature obtained');

      // 3️⃣ Compare signature components
      console.log('\n📊 SIGNATURE COMPARISON (SAME NONCE):');
      console.log(`Using nonce: ${testNonce}`);
      console.log('\nLattice signature:');
      console.log(`  - r: ${latticeAuthSig.r}`);
      console.log(`  - s: ${latticeAuthSig.s}`);
      console.log(`  - yParity: ${latticeAuthSig.yParity}`);

      console.log('\nFoundry signature:');
      console.log(`  - r: ${foundryAuthSig.r}`);
      console.log(`  - s: ${foundryAuthSig.s}`);
      console.log(`  - yParity: ${foundryAuthSig.yParity}`);

      // 4️⃣ Compare signatures
      const latticeYParity =
        typeof latticeAuthSig.yParity === 'string'
          ? parseInt(latticeAuthSig.yParity, 16)
          : latticeAuthSig.yParity;

      const signaturesMatch =
        latticeAuthSig.r === foundryAuthSig.r &&
        latticeAuthSig.s === foundryAuthSig.s &&
        latticeYParity === foundryAuthSig.yParity;

      console.log('\n🔍 SIGNATURE ANALYSIS:');
      console.log(
        `  - R values match: ${latticeAuthSig.r === foundryAuthSig.r ? '✅' : '❌'}`,
      );
      console.log(
        `  - S values match: ${latticeAuthSig.s === foundryAuthSig.s ? '✅' : '❌'}`,
      );
      console.log(
        `  - Y Parity match: ${latticeYParity === foundryAuthSig.yParity ? '✅' : '❌'}`,
      );
      console.log(`  - Complete match: ${signaturesMatch ? '✅' : '❌'}`);

      // 5️⃣ Store results for detailed comparison
      const latticeResult = {
        r: latticeAuthSig.r,
        s: latticeAuthSig.s,
        yParity: latticeYParity, // Normalized to number
        address: latticeAddress,
        nonce: testNonce,
      };

      const foundryResult = {
        r: foundryAuthSig.r,
        s: foundryAuthSig.s,
        yParity: foundryAuthSig.yParity,
        address: foundryAccount.address,
        nonce: testNonce,
      };

      debugCompare(
        'EIP-7702 Authorization Signatures (Same Nonce)',
        latticeResult,
        foundryResult,
      );

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

      if (signaturesMatch) {
        console.log(
          '🎉 PERFECT MATCH: Both implementations produce identical signatures!',
        );
      } else {
        console.log(
          '📊 DIFFERENCE DETECTED: Signatures differ - analyzing implementation differences',
        );
      }

      console.log('✅ Both signatures are valid and properly formatted');
      console.log('🏁 Authorization signature comparison completed');

      // 7️⃣ Assert that signatures match exactly (same keys + same nonce = same signature)
      expect(latticeAuthSig.r).toBe(foundryAuthSig.r);
      expect(latticeAuthSig.s).toBe(foundryAuthSig.s);
      expect(latticeYParity).toBe(foundryAuthSig.yParity);
    } catch (error) {
      console.error('\n❌ AUTHORIZATION SIGNATURE COMPARISON FAILED:');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      throw error;
    }
  });

  /**
   * Test comparing full EIP-7702 transaction signing with same nonce
   */
  test('Compare EIP-7702 transaction signing: Same nonce comparison', async () => {
    console.log('\n🔍 COMPARING EIP-7702 TRANSACTION SIGNING (SAME NONCE)');

    const testNonce = 43;

    // Create authorization using the same nonce for both
    const authorizationParams = {
      chainId: 1,
      contractAddress: '0x769F783730E49994F724069898f8738bFd406DfD' as Address,
      nonce: testNonce,
    };

    // First get authorization signature from both implementations
    console.log('🔐 Getting authorization signatures...');
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

    console.log('📌 Transactions created for comparison');

    try {
      // 1️⃣ Sign transaction with Lattice
      console.log('\n🔐 Signing EIP-7702 transaction with Lattice...');
      const latticeResult = await signAuthorizationList(latticeTransaction);
      console.log('✅ Lattice transaction signature obtained');

      // 2️⃣ Sign transaction with Foundry account
      console.log('🧪 Signing EIP-7702 transaction with Foundry account...');
      const foundryTxHash =
        await foundryAccount.signTransaction(foundryTransaction);
      console.log('✅ Foundry transaction signature obtained');

      // 3️⃣ Compare transaction results
      console.log('\n📊 TRANSACTION SIGNING COMPARISON (SAME NONCE):');
      console.log(`Using authorization nonce: ${testNonce}`);
      console.log(`Using transaction nonce: ${testNonce + 1}`);

      console.log('\nLattice result:');
      console.log(`  - sig.r: ${toHex(latticeResult.sig.r)}`);
      console.log(`  - sig.s: ${toHex(latticeResult.sig.s)}`);

      console.log('\nFoundry result:');
      console.log(`  - signedTx length: ${foundryTxHash.length} chars`);
      console.log(
        `  - signedTx (first 100 chars): ${foundryTxHash.substring(0, 100)}...`,
      );

      // 4️⃣ Store results for detailed comparison
      const latticeTransactionResult = {
        sigR: toHex(latticeResult.sig.r),
        sigS: toHex(latticeResult.sig.s),
        address: latticeAddress,
        authNonce: testNonce,
        txNonce: testNonce + 1,
      };

      const foundryTransactionResult = {
        signedTransaction: foundryTxHash,
        signedTxLength: foundryTxHash.length,
        address: foundryAccount.address,
        authNonce: testNonce,
        txNonce: testNonce + 1,
      };

      debugCompare(
        'EIP-7702 Transaction Signatures (Same Nonce)',
        latticeTransactionResult,
        foundryTransactionResult,
      );

      // 5️⃣ Verify both transactions are properly signed
      // Note: signAuthorizationList only signs the authorization list, not the full transaction
      // so it won't return a txHash - that would only come from signing the complete transaction
      expect(latticeResult.sig.r).toBeDefined();
      expect(latticeResult.sig.s).toBeDefined();
      expect(foundryTxHash).toBeDefined();
      expect(foundryTxHash.startsWith('0x04')).toBe(true); // EIP-7702 type

      console.log('✅ Both transaction signatures are valid');
      console.log('🏁 Transaction signing comparison completed');

      // 6️⃣ Analysis summary
      console.log('\n🔍 SIGNING PROCESS ANALYSIS:');
      console.log('Key findings:');
      console.log(`- Authorization nonce used: ${testNonce}`);
      console.log(`- Transaction nonce used: ${testNonce + 1}`);
      console.log(`- Lattice address: ${latticeAddress}`);
      console.log(`- Foundry address: ${foundryAccount.address}`);
      console.log('- Both follow EIP-7702 transaction structure');
      console.log(
        '- Lattice signed authorization list, Foundry signed complete transaction',
      );
      console.log('- Both use the same nonce for deterministic comparison');

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
      console.error('\n❌ TRANSACTION SIGNING COMPARISON FAILED:');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      throw error;
    }
  });
});
