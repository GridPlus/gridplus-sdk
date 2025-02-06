import { TRANSACTION_TYPE } from '../types/sign';
import {
  decodeFunctionData,
  toFunctionSelector,
  parseAbiItem,
  parseAbiParameters,
  type AbiFunction,
} from 'viem';
import { AbiParameters, Hex } from 'ox';

// Helper function to strip 0x prefix
const stripHexPrefix = (hex: string): string => hex.replace(/^0x/, '');

/**
 * Parse function parameters into ABI format
 * @param funcName - Name of the function
 * @param paramTypes - Array of parameter types
 * @returns ABI function item
 */
export const parseFunction = (
  funcName: string,
  paramTypes: string[],
): AbiFunction => {
  const inputs = parseAbiParameters(paramTypes.join(','));
  return {
    type: 'function',
    name: funcName,
    inputs,
    outputs: [],
    stateMutability: 'nonpayable',
  };
};

/**
 * Look through an ABI definition to see if there is a function that matches the signature provided.
 * @param sig - a 0x-prefixed hex string containing 4 bytes of info
 * @param abi - a Solidity JSON ABI structure
 * @returns Array containing function name and parameter types
 */
export const parseSolidityJSONABI = (
  sig: string,
  abi: any[],
): { def: string[] } => {
  sig = coerceSig(sig);
  const abiArray = typeof abi === 'string' ? JSON.parse(abi) : abi;

  const match = abiArray
    .filter((item): item is AbiFunction => item.type === 'function')
    .find((item) => toFunctionSelector(item) === sig);

  if (!match) {
    throw new Error('Unable to find matching function in ABI');
  }

  return {
    def: [match.name, ...match.inputs.map((input) => input.type)],
  };
};

/**
 * Convert a canonical name into an ABI definition.
 * @param sig - a 0x-prefixed hex string containing 4 bytes of info
 * @param name - canonical name of the function
 * @returns Array containing function name and parameter types
 */
export const parseCanonicalName = (
  sig: string,
  name: string,
): { def: string[] } => {
  sig = coerceSig(sig);
  const abiItem = parseAbiItem(`function ${name}`) as AbiFunction;
  const selector = toFunctionSelector(abiItem);

  if (selector !== sig) {
    throw new Error('Selector does not match canonical name');
  }

  return {
    def: [abiItem.name, ...abiItem.inputs.map((input) => input.type)],
  };
};

/**
 * Decode calldata using the provided definition
 * @param def - Array containing function name and parameter types
 * @param calldata - Buffer containing full calldata payload
 * @returns Array of decoded parameters, or null values if decoding fails
 */
export const decodeCalldata = (
  def: string[],
  calldata: Buffer,
  isDebug = false,
): (string | null)[] => {
  if (!Array.isArray(def) || def.length === 0) {
    console.warn('Invalid definition:', def);
    return [];
  }

  const [funcName, ...paramTypes] = def;
  try {
    const abiItem = parseFunction(funcName, paramTypes);
    const hexData = Hex.fromBytes(calldata);

    // First 4 bytes are the function selector
    const params = AbiParameters.decode(
      abiItem.inputs,
      Hex.slice(hexData, 4),
    );

    return params.map((param: unknown) => {
      if (param === null || param === undefined) {
        return null;
      }
      if (typeof param === 'string') {
        return stripHexPrefix(param);
      }
      if (typeof param === 'number' || typeof param === 'bigint') {
        return param.toString();
      }
      if (param instanceof Uint8Array) {
        return stripHexPrefix(Hex.fromBytes(param));
      }
      if (Array.isArray(param)) {
        return param
          .map((item: unknown) => {
            if (item instanceof Uint8Array) {
              return stripHexPrefix(Hex.fromBytes(item));
            }
            return item?.toString() || null;
          })
          .join(',');
      }
      return String(param);
    });
  } catch (error) {
    if (isDebug) {
      console.warn('Failed to decode calldata:', error);
    }
    return Array(paramTypes.length).fill(null);
  }
};

/**
 * Pull out nested calldata which may correspond to nested ABI definitions.
 * @param def - Array containing function name and parameter types
 * @param calldata - Buffer containing full calldata payload
 * @returns Array of calldata params, or null values
 */
export const getNestedCalldata = (
  def: string[],
  calldata: Buffer,
  isDebug = false,
): (string[] | null)[] => {
  if (!Array.isArray(def) || def.length === 0) {
    console.warn('Invalid definition:', def);
    return [];
  }

  const [funcName, ...paramTypes] = def;
  try {
    const abiItem = parseFunction(funcName, paramTypes);
    const hexData = Hex.fromBytes(calldata);

    // First 4 bytes are the function selector
    const params = AbiParameters.decode(
      abiItem.inputs,
      Hex.slice(hexData, 4),
    );

    return params.map((param) => {
      if (Array.isArray(param) && param.every((item) => item instanceof Uint8Array)) {
        return param.map((bytes) => stripHexPrefix(Hex.fromBytes(bytes)));
      }
      return null;
    });
  } catch (error) {
    if (isDebug) {
      console.warn('Failed to get nested calldata:', error);
    }
    return Array(paramTypes.length).fill(null);
  }
};

/**
 * Replace nested definitions in the original definition
 * @param def - Original definition array
 * @param nestedDefs - Array of nested definitions
 * @returns Updated definition array
 */
export const replaceNestedDefs = (
  def: string[],
  nestedDefs: (string | string[])[],
): string[] => {
  if (!Array.isArray(def) || !Array.isArray(nestedDefs)) {
    return def;
  }

  return def.map((item, index) => {
    if (index === 0) return item; // Keep function name
    const nestedDef = nestedDefs[index - 1];
    return nestedDef === null ? item : String(nestedDef);
  });
};

/**
 * Ensure the sig is properly formatted
 * @param sig - Function signature
 * @returns Formatted signature with 0x prefix
 */
export const coerceSig = (sig: string): string => {
  if (typeof sig !== 'string' || (sig.length !== 10 && sig.length !== 8)) {
    throw new Error('`sig` must be a hex string with 4 bytes of data.');
  }
  return sig.length === 8 ? `0x${sig}` : sig;
};

/**
 * Helper function to serialize BigInt values
 * @param obj - Object containing BigInt values
 * @returns Object with BigInt values converted to strings
 */
export const serializeBigInt = (obj: unknown): unknown => {
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }
  if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, serializeBigInt(value)]),
    );
  }
  return obj;
};

// Helper function to encode transaction data for viem
export const encodeViemTransaction = (transaction: any): string => {
  const {
    to,
    value,
    data,
    chainId,
    nonce,
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    accessList,
    type = TRANSACTION_TYPE.LEGACY,
  } = transaction;

  const txType =
    type === TRANSACTION_TYPE.LEGACY
      ? 'legacy'
      : type === TRANSACTION_TYPE.EIP2930
        ? 'eip2930'
        : 'eip1559';

  const encodedTx = {
    to,
    value: BigInt(value),
    data,
    chainId: Number(chainId),
    nonce: Number(nonce),
    gas: BigInt(gasLimit),
    ...(maxFeePerGas && { maxFeePerGas: BigInt(maxFeePerGas) }),
    ...(maxPriorityFeePerGas && {
      maxPriorityFeePerGas: BigInt(maxPriorityFeePerGas),
    }),
    ...(accessList && { accessList }),
    type: txType,
  };

  return stripHexPrefix(Hex.fromBytes(Buffer.from(JSON.stringify(serializeBigInt(encodedTx)))));
};

// Helper function to encode EIP-712 typed data
export const encodeViemTypedData = (typedData: {
  types: Record<string, Array<{ name: string; type: string }>>;
  domain: Record<string, any>;
  primaryType: string;
  message: Record<string, any>;
}): string => {
  const { types, domain, primaryType, message } = typedData;
  return stripHexPrefix(Hex.fromBytes(Buffer.from(JSON.stringify({ types, domain, primaryType, message }))));
};

// Helper function to encode personal sign messages
export const encodeViemPersonalMessage = (
  message: string | Uint8Array | Buffer,
): string => {
  if (typeof message === 'string') {
    return stripHexPrefix(Hex.fromBytes(Buffer.from(message)));
  }
  return stripHexPrefix(Hex.fromBytes(Buffer.from(message)));
};
