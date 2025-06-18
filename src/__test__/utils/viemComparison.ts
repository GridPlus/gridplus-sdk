import { mnemonicToSeedSync } from 'bip39';
import {
  createWalletClient,
  http,
  parseTransaction,
  serializeTransaction,
  hexToNumber,
  numberToHex,
  type Address,
  type Hex,
  type TransactionSerializable,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, polygon, bsc, avalanche } from 'viem/chains';
import { sign } from '../../api';
import { deriveAddress } from './determinism';

// Foundry test mnemonic
const FOUNDRY_TEST_MNEMONIC =
  'test test test test test test test test test test test junk';
const FOUNDRY_TEST_SEED = mnemonicToSeedSync(FOUNDRY_TEST_MNEMONIC);

// Utility function to create foundry account address for comparison
export const getFoundryAddress = (): Address => {
  // Use first account derivation path: m/44'/60'/0'/0/0
  const foundryPath = [44 + 0x80000000, 60 + 0x80000000, 0x80000000, 0, 0];
  return deriveAddress(FOUNDRY_TEST_SEED, foundryPath as any) as Address;
};

// Get Foundry private key for signing
export const getFoundryPrivateKey = (): Hex => {
  return '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Foundry test account #0 private key
};

// Create foundry account for actual signing
export const getFoundryAccount = () => {
  const privateKey = getFoundryPrivateKey();
  return privateKeyToAccount(privateKey);
};

// Create a wallet client for Foundry account
export const createFoundryWalletClient = (chainId = 1) => {
  const account = getFoundryAccount();
  const chains = {
    1: mainnet,
    137: polygon,
    56: bsc,
    43114: avalanche,
  };

  return createWalletClient({
    account,
    chain: chains[chainId] || mainnet,
    transport: http(),
  });
};

// Transaction type for our test vectors - use viem's TransactionSerializable
export type TestTransaction = TransactionSerializable;

// Helper to normalize Lattice signature components to viem format
const normalizeLatticeSignature = (
  latticeResult: any,
  originalTx: TestTransaction,
) => {
  // Convert Buffer v value to number
  let vValue: number;
  if (Buffer.isBuffer(latticeResult.sig.v)) {
    // Read entire buffer as big-endian integer
    // Single byte: <Buffer 26> = 0x26 = 38
    // Multi-byte: <Buffer 01 35> = 0x0135 = 309 (Polygon chainId 137 with EIP-155)
    const bufferLength = latticeResult.sig.v.length;
    if (bufferLength === 1) {
      vValue = latticeResult.sig.v.readUInt8(0);
    } else if (bufferLength === 2) {
      vValue = latticeResult.sig.v.readUInt16BE(0);
    } else if (bufferLength <= 4) {
      vValue = latticeResult.sig.v.readUInt32BE(Math.max(0, 4 - bufferLength));
    } else {
      // For very large buffers, read as hex and convert
      vValue = parseInt(latticeResult.sig.v.toString('hex'), 16);
    }
  } else if (typeof latticeResult.sig.v === 'number') {
    vValue = latticeResult.sig.v;
  } else if (typeof latticeResult.sig.v === 'string') {
    vValue = hexToNumber(latticeResult.sig.v as Hex);
  } else {
    vValue = Number(latticeResult.sig.v);
  }

  console.log(
    `🔧 Signature normalization: vValue=${vValue}, originalTx.type=${originalTx.type}`,
  );

  // For typed transactions (non-legacy), viem expects yParity instead of v
  if (originalTx.type !== 'legacy') {
    // Convert v to yParity (v is either 27/28 or 0/1)
    const yParity = vValue >= 27 ? vValue - 27 : vValue;
    console.log(`   Non-legacy: yParity=${yParity}`);
    return {
      ...originalTx,
      r: latticeResult.sig.r as Hex,
      s: latticeResult.sig.s as Hex,
      yParity,
    };
  } else {
    // Legacy transactions use v directly as BigInt
    console.log(`   Legacy: v=${vValue} (as BigInt)`);
    const result = {
      ...originalTx,
      r: latticeResult.sig.r as Hex,
      s: latticeResult.sig.s as Hex,
      v: BigInt(vValue),
    };

    // For legacy transactions, remove the type field to ensure Viem treats it as legacy
    delete result.type;

    // Also remove any typed transaction fields that might confuse viem
    delete result.maxFeePerGas;
    delete result.maxPriorityFeePerGas;
    delete result.accessList;
    delete result.authorizationList;

    console.log(`   Legacy result:`, {
      r: result.r?.slice(0, 10),
      s: result.s?.slice(0, 10),
      v: result.v,
      type: result.type,
    });
    return result;
  }
};

// Sign transaction with both Lattice and viem, then compare
export const signAndCompareTransaction = async (
  tx: TestTransaction,
  testName: string,
) => {
  const foundryAccount = getFoundryAccount();

  try {
    // Sign with Lattice using the new sign API that accepts TransactionSerializable directly
    const latticeResult = await sign(tx).catch((err) => {
      if (err.responseCode === 128) {
        err.message =
          'NOTE: You must have `FEATURE_TEST_RUNNER=1` enabled in firmware to run these tests.\n' +
          err.message;
      }
      if (err.responseCode === 132) {
        err.message =
          'NOTE: Please approve the transaction on your Lattice device.\n' +
          err.message;
      }
      throw err;
    });

    // Sign with viem wallet (use original transaction)
    const viemSignedTx = await foundryAccount.signTransaction(tx);

    // Parse the viem signed transaction to extract signature components
    const parsedViemTx = parseTransaction(viemSignedTx);

    // Debug: show what viem actually signed for legacy transactions
    if (tx.type === 'legacy') {
      console.log(`🔍 Viem signed transaction details:`);
      console.log(`   v: ${parsedViemTx.v}`);
      console.log(`   r: ${parsedViemTx.r?.slice(0, 10)}...`);
      console.log(`   s: ${parsedViemTx.s?.slice(0, 10)}...`);
      console.log(`   Full tx: ${viemSignedTx}`);
    }

    // Verify Lattice signature structure
    expect(latticeResult.sig).toBeDefined();
    expect(latticeResult.sig.r).toBeDefined();
    expect(latticeResult.sig.s).toBeDefined();
    expect(latticeResult.sig.v).toBeDefined();

    // Verify viem signature components exist
    expect(parsedViemTx.r).toBeDefined();
    expect(parsedViemTx.s).toBeDefined();

    // For typed transactions (EIP-1559, EIP-2930, EIP-7702), check yParity
    // For legacy transactions, check v
    if (tx.type !== 'legacy') {
      expect(parsedViemTx.yParity).toBeDefined();
    } else {
      expect(parsedViemTx.v).toBeDefined();
    }

    // Debug logging for legacy transactions
    if (tx.type === 'legacy') {
      console.log(`🔍 Debug ${testName}:`);
      console.log(`   latticeResult.tx exists: ${!!latticeResult.tx}`);
      console.log(`   latticeResult.sig:`, latticeResult.sig);
      if (latticeResult.tx) {
        console.log(`   latticeResult.tx: ${latticeResult.tx.slice(0, 40)}...`);
      }
    }

    // Get the signed transaction from Lattice
    let latticeSignedTx: string;

    // For legacy transactions, handle serialization compatibility issues
    if (tx.type === 'legacy') {
      if (latticeResult.tx) {
        // Lattice provided a complete signed transaction - use it directly
        latticeSignedTx = latticeResult.tx;
        console.log(
          `   Using Lattice provided tx: ${latticeSignedTx.slice(0, 40)}...`,
        );
      } else {
        // Lattice only provided signature components - reconstruct the transaction
        console.log(
          `   Reconstructing legacy transaction from signature components...`,
        );

        // For legacy transactions, we need to use a different approach
        // Convert Buffer v value to number
        let vValue: number;
        const vBuffer = latticeResult.sig.v as any; // Type assertion to avoid intersection issues

        if (Buffer.isBuffer(vBuffer)) {
          const bufferLength = vBuffer.length;
          if (bufferLength === 1) {
            vValue = vBuffer.readUInt8(0);
          } else if (bufferLength === 2) {
            vValue = vBuffer.readUInt16BE(0);
          } else if (bufferLength <= 4) {
            vValue = vBuffer.readUInt32BE(Math.max(0, 4 - bufferLength));
          } else {
            vValue = parseInt(vBuffer.toString('hex'), 16);
          }
        } else {
          vValue = Number(vBuffer);
        }

        // Prepare the unsigned transaction (no signature components)
        const unsignedTx = { ...tx };
        delete unsignedTx.type; // Remove type for legacy

        // Prepare the signature object with v for legacy transactions
        const signature = {
          r: latticeResult.sig.r as Hex,
          s: latticeResult.sig.s as Hex,
          v: BigInt(vValue), // Legacy uses v, not yParity
        };

        console.log(
          `   Unsigned tx:`,
          JSON.stringify(
            unsignedTx,
            (key, value) =>
              typeof value === 'bigint' ? value.toString() : value,
            2,
          ),
        );
        console.log(`   Signature:`, {
          r: signature.r.slice(0, 10) + '...',
          s: signature.s.slice(0, 10) + '...',
          v: signature.v.toString(),
        });

        latticeSignedTx = serializeTransaction(unsignedTx, signature);
        console.log(`   Reconstructed tx: ${latticeSignedTx.slice(0, 40)}...`);
      }
    } else if (latticeResult.tx) {
      // Lattice provided the complete signed transaction for non-legacy
      latticeSignedTx = latticeResult.tx;
    } else {
      // Reconstruct using viem's serializeTransaction with normalized signature
      const normalizedSignedTx = normalizeLatticeSignature(latticeResult, tx);
      latticeSignedTx = serializeTransaction(normalizedSignedTx);
    }

    // The most important comparison: verify both produce the same serialized transaction
    expect(latticeSignedTx).toBe(viemSignedTx);

    // Additional verification: compare signature components
    // Lattice returns r,s as hex strings with 0x prefix
    const latticeR = latticeResult.sig.r.toLowerCase();
    const latticeS = latticeResult.sig.s.toLowerCase();
    const viemR = parsedViemTx.r!.toLowerCase();
    const viemS = parsedViemTx.s!.toLowerCase();

    // Verify r and s components match exactly
    expect(latticeR).toBe(viemR);
    expect(latticeS).toBe(viemS);

    console.log(`✅ ${testName}: Signatures match perfectly`);
    console.log(`   r: ${latticeR.slice(0, 10)}...`);
    console.log(`   s: ${latticeS.slice(0, 10)}...`);
    console.log(`   Serialized tx: ${viemSignedTx.slice(0, 20)}...`);

    return {
      lattice: latticeResult,
      viem: viemSignedTx,
      success: true,
    };
  } catch (error) {
    console.error(`❌ Test failed for ${testName}:`, error.message);

    throw error;
  }
};
