import { type Hex, isHex, hexToBigInt, isAddress, getAddress } from 'viem';

/**
 * Parse a value to a non-negative BigInt using viem utilities
 */
export function parsePositiveBigInt(
  value: string | number | bigint | Hex | undefined,
): bigint | undefined {
  if (value === undefined) return undefined;

  try {
    // Use viem's hexToBigInt for hex strings, otherwise BigInt constructor
    const bigIntValue =
      typeof value === 'string' && isHex(value)
        ? hexToBigInt(value as Hex)
        : BigInt(value);

    if (bigIntValue < 0n) {
      throw new Error('Value must be non-negative');
    }
    return bigIntValue;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Value must be non-negative'
    ) {
      throw error;
    }
    throw new Error('Invalid value format');
  }
}

/**
 * Parse a gas value to a non-negative BigInt using viem utilities
 */
export function parseGasValue(
  value: string | number | bigint | Hex | undefined,
): bigint | undefined {
  if (value === undefined) return undefined;

  try {
    // Use viem's hexToBigInt for hex strings, otherwise BigInt constructor
    const bigIntValue =
      typeof value === 'string' && isHex(value)
        ? hexToBigInt(value as Hex)
        : BigInt(value);

    if (bigIntValue < 0n) {
      throw new Error('Gas values must be non-negative');
    }
    return bigIntValue;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Gas values must be non-negative'
    ) {
      throw error;
    }
    throw new Error('Invalid gas value format');
  }
}

/**
 * Parse a chain ID using viem utilities for hex handling
 */
export function parseChainId(value: string | number | undefined): number {
  if (value === undefined) return 1;

  // Handle hex chainId values using viem
  const numValue =
    typeof value === 'string' && isHex(value)
      ? Number(hexToBigInt(value as Hex))
      : Number(value);

  if (!Number.isInteger(numValue) || numValue <= 0) {
    throw new Error('ChainId must be a positive integer');
  }
  return numValue;
}

/**
 * Validate and normalize authorization object using viem utilities
 */
export function validateAuthorization(auth: any): {
  chainId: number;
  address: `0x${string}`;
  nonce: number;
  r?: `0x${string}`;
  s?: `0x${string}`;
  yParity?: number;
} {
  if (!auth || typeof auth !== 'object') {
    throw new Error('Authorization must be an object');
  }

  const chainId = Number(auth.chainId);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error('Authorization chainId must be a positive integer');
  }

  // Use viem's isAddress for validation and getAddress for checksum format
  if (!auth.address || !isAddress(auth.address, { strict: false })) {
    throw new Error('Authorization address must be a valid hex address');
  }

  const nonce = Number(auth.nonce);
  if (!Number.isInteger(nonce) || nonce < 0) {
    throw new Error('Authorization nonce must be a non-negative integer');
  }

  const result: any = {
    chainId,
    address: getAddress(auth.address), // Ensures proper checksum format
    nonce,
    yParity: auth.yParity ?? 0,
  };

  // Use viem's isHex for hex string validation
  if (auth.r && !isHex(auth.r)) {
    throw new Error('Authorization r must be a valid hex string');
  }
  if (auth.s && !isHex(auth.s)) {
    throw new Error('Authorization s must be a valid hex string');
  }

  if (auth.r) result.r = auth.r as `0x${string}`;
  if (auth.s) result.s = auth.s as `0x${string}`;

  return result;
}

/**
 * Parse transaction fields with validation using viem utilities
 */
export function parseTransactionFields(tx: any): {
  chainId: number;
  value: bigint | undefined;
  nonce: number;
  gas: bigint | undefined;
  maxFeePerGas: bigint | undefined;
  maxPriorityFeePerGas: bigint | undefined;
  gasPrice: bigint | undefined;
} {
  try {
    const nonceValue =
      tx.nonce !== undefined ? parsePositiveBigInt(tx.nonce) : 0n;

    return {
      chainId: parseChainId(tx.chainId),
      value: parsePositiveBigInt(tx.value),
      nonce: Number(nonceValue),
      gas: tx.gasLimit ? parseGasValue(tx.gasLimit) : parseGasValue(tx.gas),
      maxFeePerGas: parseGasValue(tx.maxFeePerGas),
      maxPriorityFeePerGas: parseGasValue(tx.maxPriorityFeePerGas),
      gasPrice: parseGasValue(tx.gasPrice),
    };
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`Invalid transaction field: ${err.message}`);
    }
    throw err;
  }
}
