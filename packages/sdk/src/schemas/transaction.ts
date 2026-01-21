import { type Hex, getAddress, hexToBigInt, isAddress, isHex } from 'viem';
import { z } from 'zod';
import { TRANSACTION_TYPE } from '../types';

// Helper to handle various numeric inputs and convert them to BigInt.
// It also validates that the value is not negative.
const toPositiveBigInt = z.union([z.string().regex(/^(0x[0-9a-fA-F]+|[0-9]+)$/, 'Invalid number format'), z.number(), z.bigint()]).transform((val, ctx) => {
  try {
    const b = typeof val === 'string' && isHex(val) ? hexToBigInt(val) : BigInt(val);
    if (b < 0n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Value must be non-negative',
      });
      return z.NEVER;
    }
    return b;
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid numeric value',
    });
    return z.NEVER;
  }
});

// Schema for gas-related fields, ensuring they are non-negative BigInts.
const GasValueSchema = toPositiveBigInt.refine((val) => val >= 0n, {
  message: 'Gas values must be non-negative',
});

// Schema for chainId, ensuring it's a positive integer.
const ChainIdSchema = z
  .union([z.string(), z.number()])
  .transform((val) => (typeof val === 'string' && isHex(val) ? Number(hexToBigInt(val as Hex)) : Number(val)))
  .refine((val) => Number.isInteger(val) && val > 0, {
    message: 'Chain ID must be a positive integer',
  });

// Schema for an Ethereum address, which validates and checksums it.
const AddressSchema = z
  .string()
  .refine(isAddress, 'Invalid address')
  .transform((addr) => getAddress(addr));

// Schema for hex data, ensuring it's a valid hex string.
const DataSchema = z.string().refine(isHex, 'Data must be a valid hex string').default('0x');

const NonceSchema = z.union([z.string().regex(/^(0x[0-9a-fA-F]+|[0-9]+)$/, 'Invalid nonce format'), z.number().int().nonnegative(), z.bigint()]).transform((val, ctx) => {
  try {
    const bigVal = typeof val === 'string' ? (isHex(val as Hex) ? hexToBigInt(val as Hex) : BigInt(val)) : typeof val === 'number' ? BigInt(val) : val;

    if (bigVal < 0n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nonce must be non-negative',
      });
      return z.NEVER;
    }

    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
    if (bigVal > maxSafe) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nonce exceeds JavaScript safe integer range',
      });
      return z.NEVER;
    }

    return Number(bigVal);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid nonce value',
    });
    return z.NEVER;
  }
});

// Schema for access list entries.
const AccessListEntrySchema = z.object({
  address: AddressSchema,
  storageKeys: z.array(z.string().refine(isHex, 'Storage key must be a hex string')),
});

// Schema for EIP-7702 authorization entries.
const AuthorizationSchema = z.object({
  chainId: z.number().int().positive(),
  address: AddressSchema,
  nonce: z.number().int().nonnegative(),
  yParity: z.number().optional().default(0),
  r: z.string().refine(isHex).optional(),
  s: z.string().refine(isHex).optional(),
});

// Base schema for all transaction types.
const BaseTxSchema = z.object({
  to: AddressSchema.optional(),
  value: toPositiveBigInt.optional(),
  data: DataSchema,
  nonce: NonceSchema.optional(),
  gas: GasValueSchema.optional(),
  gasLimit: GasValueSchema.optional(),
  chainId: ChainIdSchema.optional().default(1),
  accessList: z.array(AccessListEntrySchema).optional(),
});

// Schema for Legacy (Type 0) transactions.
const LegacyTxSchema = BaseTxSchema.extend({
  type: z.union([z.literal('legacy'), z.literal(TRANSACTION_TYPE.LEGACY)]).optional(),
  gasPrice: GasValueSchema,
});

// Schema for EIP-2930 (Type 1) transactions.
const EIP2930TxSchema = BaseTxSchema.extend({
  type: z.union([z.literal('eip2930'), z.literal(TRANSACTION_TYPE.EIP2930)]),
  gasPrice: GasValueSchema,
});

// Schema for EIP-1559 (Type 2) transactions.
const EIP1559TxSchema = BaseTxSchema.extend({
  type: z.union([z.literal('eip1559'), z.literal(TRANSACTION_TYPE.EIP1559)]),
  maxFeePerGas: GasValueSchema,
  maxPriorityFeePerGas: GasValueSchema,
});

// Schema for EIP-7702 (Type 4/5) transactions.
const EIP7702TxSchema = BaseTxSchema.extend({
  type: z.union([z.literal('eip7702'), z.literal(TRANSACTION_TYPE.EIP7702_AUTH), z.literal(TRANSACTION_TYPE.EIP7702_AUTH_LIST)]),
  maxFeePerGas: GasValueSchema,
  maxPriorityFeePerGas: GasValueSchema,
  authorizationList: z.array(AuthorizationSchema).min(1),
});

/**
 * A comprehensive zod schema that validates and normalizes a flexible transaction input.
 * It handles:
 * - Type inference (legacy, EIP-1559, etc.) based on provided fields.
 * - Coercion of numbers, strings, and hex values to their correct types (BigInt, Address).
 * - Validation of addresses, hex data, and transaction-specific rules.
 * - Merging of `gas` and `gasLimit` fields.
 */
export const TransactionSchema = z
  .any()
  // Pre-process to check for circular references before zod touches it
  .refine(
    (val) => {
      try {
        JSON.stringify(val, (_, value) => (typeof value === 'bigint' ? value.toString() : value));
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Circular reference detected in transaction object' },
  )
  .transform((tx) => {
    // Prioritize gasLimit over gas
    if (tx.gasLimit) {
      tx.gas = tx.gasLimit;
    }

    if (tx.data === null || tx.data === undefined || tx.data === '') {
      tx.data = '0x';
    }

    // Normalize EIP-7702 `authorization` to `authorizationList`
    if (tx.authorization) {
      tx.authorizationList = [tx.authorization];
    }
    return tx;
  })
  .transform((tx: any) => {
    // Type inference and validation logic
    const hasAuthList = !!tx.authorizationList;
    const hasMaxFee = !!tx.maxFeePerGas || !!tx.maxPriorityFeePerGas;
    const hasAccessList = !!tx.accessList;
    const hasGasPrice = !!tx.gasPrice;

    let type: 'eip7702' | 'eip1559' | 'eip2930' | 'legacy' = 'legacy';
    let schema: z.ZodTypeAny = LegacyTxSchema;

    if (tx.type === 'eip7702' || tx.type === 4 || tx.type === 5 || hasAuthList) {
      type = 'eip7702';
      schema = EIP7702TxSchema;
    } else if (tx.type === 'eip1559' || tx.type === 2 || hasMaxFee) {
      type = 'eip1559';
      schema = EIP1559TxSchema;
    } else if (tx.type === 'eip2930' || tx.type === 1 || hasAccessList) {
      type = 'eip2930';
      schema = EIP2930TxSchema;
    }

    // For legacy, if gasPrice is missing, it's an invalid tx
    if (type === 'legacy' && !hasGasPrice) {
      throw new Error('Legacy transactions require a `gasPrice` field.');
    }

    const result = schema.parse(tx);

    // Post-process the successfully parsed data
    const data: any = result;
    data.type = type;
    if (type === 'legacy' && data.gas === undefined) {
      data.gas = 21000n; // Default gas for legacy transfers
    }

    // Remove fields that are not part of the final type
    if (type !== 'legacy' && type !== 'eip2930') data.gasPrice = undefined;
    if (type !== 'eip1559' && type !== 'eip7702') {
      data.maxFeePerGas = undefined;
      data.maxPriorityFeePerGas = undefined;
    }
    data.gasLimit = undefined;
    if (type !== 'eip7702') data.authorizationList = undefined;

    return data;
  });

export type FlexibleTransaction = z.infer<typeof TransactionSchema>;
