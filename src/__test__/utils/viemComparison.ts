import { mnemonicToSeedSync } from 'bip39';
import {
  type Address,
  type Hex,
  parseTransaction,
  serializeTransaction,
  type TransactionSerializable,
  type TypedDataDefinition,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sign, signMessage } from '../../api';
import { normalizeLatticeSignature } from '../../ethereum';
import { deriveAddress } from './determinism';
import { FOUNDRY_TEST_MNEMONIC } from './testConstants';
import { ensureHexBuffer } from '../../util';

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

// Transaction type for our test vectors - use viem's TransactionSerializable
export type TestTransaction = TransactionSerializable;

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
    const parsedViemTx = parseTransaction(viemSignedTx as `0x${string}`);

    // Verify Lattice signature structure
    expect(latticeResult.sig).toBeDefined();
    expect(latticeResult.sig.r).toBeDefined();
    expect(latticeResult.sig.s).toBeDefined();

    // For legacy transactions, expect v; for modern transactions, v might be undefined
    if (tx.type === 'legacy') {
      expect(latticeResult.sig.v).toBeDefined();
    }

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

    // Get the signed transaction from Lattice
    let latticeSignedTx: string;

    // Check if the new viemTx field is available (automatic normalization)
    if ((latticeResult as any).viemTx) {
      latticeSignedTx = (latticeResult as any).viemTx;
    } else if (latticeResult.tx) {
      // Use the provided signed transaction
      latticeSignedTx = latticeResult.tx;
    } else {
      // Fallback to manual normalization for backward compatibility
      const normalizedSignedTx = normalizeLatticeSignature(latticeResult, tx);
      latticeSignedTx = serializeTransaction(normalizedSignedTx);
    }

    // The most important comparison: verify both produce the same serialized transaction
    expect(latticeSignedTx).toBe(viemSignedTx);

    // Additional verification: compare signature components
    // Lattice returns r,s as hex strings with 0x prefix or as Buffer
    const normalizeSigComponent = (value: string | Buffer) => {
      const hexString =
        typeof value === 'string'
          ? value
          : '0x' + Buffer.from(value).toString('hex');
      const stripped = hexString.replace(/^0x/, '').toLowerCase();
      return `0x${stripped.padStart(64, '0')}`;
    };

    const latticeR = normalizeSigComponent(latticeResult.sig.r);
    const latticeS = normalizeSigComponent(latticeResult.sig.s);
    const viemR = normalizeSigComponent(parsedViemTx.r!);
    const viemS = normalizeSigComponent(parsedViemTx.s!);

    // Verify r and s components match exactly
    expect(latticeR).toBe(viemR);
    expect(latticeS).toBe(viemS);

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

// EIP-712 message type for test vectors
export type EIP712TestMessage = {
  domain: TypedDataDefinition['domain'];
  types: TypedDataDefinition['types'];
  primaryType: string;
  message: Record<string, unknown>;
};

// Sign EIP-712 typed data with both Lattice and viem, then compare
export const signAndCompareEIP712Message = async (
  eip712Message: EIP712TestMessage,
  testName: string,
) => {
  const foundryAccount = getFoundryAccount();

  try {
    // Sign with viem wallet
    const viemSignature = await foundryAccount.signTypedData({
      domain: eip712Message.domain,
      types: eip712Message.types,
      primaryType: eip712Message.primaryType,
      message: eip712Message.message,
    });

    // Sign with Lattice - need to add EIP712Domain to types
    const latticeTypes = {
      ...eip712Message.types,
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
    };

    const latticePayload = {
      types: latticeTypes,
      domain: eip712Message.domain,
      primaryType: eip712Message.primaryType,
      message: eip712Message.message,
    };

    const latticeResult = await signMessage(latticePayload).catch((err) => {
      if (err.responseCode === 128) {
        err.message =
          'NOTE: You must have `FEATURE_TEST_RUNNER=1` enabled in firmware to run these tests.\n' +
          err.message;
      }
      if (err.responseCode === 132) {
        err.message =
          'NOTE: Please approve the message signature on your Lattice device.\n' +
          err.message;
      }
      throw err;
    });

    // Normalize signature components
    const normalizeHex = (value: any): string => {
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'bigint') {
        let hex = value.toString(16);
        if (hex.length % 2 !== 0) hex = `0${hex}`;
        return hex;
      }
      if (typeof value === 'number') {
        return value.toString(16);
      }
      if (typeof value === 'string') {
        return value.startsWith('0x') ? value.slice(2) : value;
      }
      if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
        return Buffer.from(value).toString('hex');
      }
      if (typeof value?.toString === 'function') {
        const str = value.toString();
        if (/^0x[0-9a-f]+$/i.test(str)) {
          return str.slice(2);
        }
        if (/^[0-9a-f]+$/i.test(str)) {
          return str;
        }
      }
      return ensureHexBuffer(value as string | number | Buffer).toString('hex');
    };

    const rHex = normalizeHex(latticeResult.sig.r);
    const sHex = normalizeHex(latticeResult.sig.s);
    let vHex = normalizeHex(latticeResult.sig.v);
    if (!vHex) {
      vHex = '00';
    }
    vHex = vHex.padStart(2, '0');

    const latticeSignature = `0x${rHex}${sHex}${vHex}`;

    // Compare signatures
    expect(latticeSignature).toBe(viemSignature);

    return {
      lattice: latticeResult,
      viem: viemSignature,
      success: true,
    };
  } catch (error) {
    console.error(`❌ Test failed for ${testName}:`, error.message);
    throw error;
  }
};
