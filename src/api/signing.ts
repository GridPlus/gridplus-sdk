import { RLP } from '@ethereumjs/rlp';
import { keccak256 } from 'js-sha3';
import type { Hex } from 'viem';
import { serializeTransaction, TransactionSerializableEIP7702 } from 'viem';
import { SignAuthorizationParameters } from 'viem/_types/accounts/utils/signAuthorization';
import { z } from 'zod';
import { Constants } from '..';
import {
  BTC_LEGACY_DERIVATION,
  BTC_SEGWIT_DERIVATION,
  BTC_WRAPPED_SEGWIT_DERIVATION,
  CURRENCIES,
  DEFAULT_ETH_DERIVATION,
  SOLANA_DERIVATION,
} from '../constants';
import {
  isEip7702Transaction,
  serializeEIP7702Transaction,
  toViemTransaction,
} from '../ethereum';
import { fetchDecoder } from '../functions/fetchDecoder';
import {
  Authorization,
  BitcoinSignPayload,
  EIP712MessagePayload,
  SignData,
  SigningPayload,
  SignRequestParams,
  TransactionRequest,
} from '../types';
import { getYParity } from '../util';
import { isEIP712Payload, queue } from './utilities';

export const sign = async (
  transaction: TransactionRequest,
  overrides?: SignRequestParams,
): Promise<SignData> => {
  const serializedTx = isEip7702Transaction(transaction)
    ? serializeEIP7702Transaction(transaction as any)
    : serializeTransaction(toViemTransaction(transaction));

  const payload: SigningPayload = {
    signerPath: DEFAULT_ETH_DERIVATION,
    curveType: Constants.SIGNING.CURVES.SECP256K1,
    hashType: Constants.SIGNING.HASHES.KECCAK256,
    encodingType: Constants.SIGNING.ENCODINGS.EIP7702_AUTH_LIST,
    payload: serializedTx,
    decoder: await fetchDecoder(transaction),
  };

  return queue((client) => client.sign({ data: payload, ...overrides }));
};

export const signMessage = async (
  payload: string | Uint8Array | Buffer | Buffer[] | EIP712MessagePayload,
  overrides?: SignRequestParams,
): Promise<SignData> => {
  const tx = {
    data: {
      signerPath: DEFAULT_ETH_DERIVATION,
      curveType: Constants.SIGNING.CURVES.SECP256K1,
      hashType: Constants.SIGNING.HASHES.KECCAK256,
      protocol: 'signPersonal',
      payload,
      ...overrides,
    } as SigningPayload,
    currency: CURRENCIES.ETH_MSG,
  };

  if (isEIP712Payload(payload)) {
    tx.data.protocol = 'eip712';
  }

  return queue((client) => client.sign(tx));
};

const authorizationSchema = z.object({
  chainId: z.number(),
  contractAddress: z.string().startsWith('0x').length(42),
  nonce: z.number(),
  yParity: z.number().or(z.string().startsWith('0x')),
  r: z.string().startsWith('0x'),
  s: z.string().startsWith('0x'),
});

const eip7702TransactionSchema = z.object({
  type: z.literal('eip7702'),
  chainId: z.number(),
  nonce: z.number(),
  maxPriorityFeePerGas: z.bigint().or(z.string()),
  maxFeePerGas: z.bigint().or(z.string()),
  to: z.string().startsWith('0x'),
  value: z.bigint().optional(),
  data: z.string().startsWith('0x').optional(),
  authorizationList: z.array(authorizationSchema),
});

/**
 * Signs an EIP-7702 authorization to set code for an externally owned account (EOA).
 *
 * From the EIP-7702 spec:
 * - "MAGIC = 0x05" (parameter value)
 * - "authority = ecrecover(keccak(MAGIC || rlp([chain_id, address, nonce])), y_parity, r, s)"
 *   where s value must be less than or equal to secp256k1n/2, as specified in EIP-2.
 *
 * This function creates and signs the authorization message required for EIP-7702 delegation.
 */
export const signAuthorization = async (
  authorization: Omit<SignAuthorizationParameters, 'privateKey'>,
  overrides?: SignRequestParams,
): Promise<Authorization> => {
  // EIP-7702 authorization message is: MAGIC || rlp([chain_id, address, nonce])
  // MAGIC = 0x05 per EIP-7702 spec
  const MAGIC = Buffer.from([0x05]);
  const message = Buffer.concat([
    MAGIC,
    Buffer.from(
      RLP.encode([
        authorization.chainId,
        authorization.contractAddress,
        authorization.nonce,
      ]),
    ),
  ]);

  const payload: SigningPayload = {
    signerPath: DEFAULT_ETH_DERIVATION,
    curveType: Constants.SIGNING.CURVES.SECP256K1,
    hashType: Constants.SIGNING.HASHES.KECCAK256,
    encodingType: Constants.SIGNING.ENCODINGS.EIP7702_AUTH,
    payload: message,
  };

  // Get the signature with all components
  const response = await queue((client) =>
    client.sign({ data: payload, ...overrides }),
  );

  // Create a result object that combines authorization data with signature components
  const result: Authorization = {
    contractAddress: authorization.contractAddress,
    ...authorization,
  };

  // Extract signature components if they exist
  if (response.sig && response.pubkey) {
    // Create a mock tx object to use with getYParity
    // For EIP-7702, we need to prepare a proper hash for the message to recover y-parity
    // We need a proper 32-byte hash for secp256k1 to work with
    const messageHash = Buffer.from(keccak256(message), 'hex');

    // Create a mock tx that will just return this hash directly without modifying it
    const mockTx = {
      _type: null, // Bypass the hash processing in getYParity
      getMessageToSign: () => messageHash,
    };

    // Get the y-parity value using our utility function
    const yParity = getYParity(mockTx, response);

    // Add the signature components to the result
    result.yParity = yParity;
    result.r = `0x${response.sig.r.toString('hex')}` as Hex;
    result.s = `0x${response.sig.s.toString('hex')}` as Hex;
  }

  return result;
};

export const signAuthorizationList = async (
  tx: TransactionSerializableEIP7702,
): Promise<SignData> => {
  const txClone = JSON.parse(
    JSON.stringify(tx, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

  // Convert string representations of BigInt back to BigInt
  const convertBackBigInt = (obj: any) => {
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      if (
        typeof value === 'string' &&
        /^\d+$/.test(value) &&
        key.includes('Fee')
      ) {
        obj[key] = BigInt(value);
      } else if (
        key === 'value' &&
        typeof value === 'string' &&
        /^\d+$/.test(value)
      ) {
        obj[key] = BigInt(value);
      } else if (typeof value === 'object' && value !== null) {
        convertBackBigInt(value);
      }
    });
    return obj;
  };

  const txForValidation = convertBackBigInt(txClone);

  const result = eip7702TransactionSchema.safeParse(txForValidation);

  if (!result.success) {
    // Additional debugging for authorizationList
    if (tx.authorizationList) {
      tx.authorizationList.forEach((auth, idx) => {
        console.log(`DEBUG: Auth[${idx}]:`, {
          chainId: auth.chainId,
          address: auth.address,
          nonce: auth.nonce,
          yParity: auth.yParity,
          r: auth.r,
          s: auth.s,
        });
      });
    }

    throw new Error(
      `EIP7702 transaction validation failed: ${result.error.message}`,
    );
  }

  // Extra safety check for addresses
  if (tx.authorizationList) {
    tx.authorizationList.forEach((auth, index) => {
      if (!auth.address) {
        throw new Error(
          `Authorization at index ${index} is missing an address`,
        );
      }

      // Ensure address has correct format
      if (
        typeof auth.address !== 'string' ||
        !auth.address.startsWith('0x') ||
        auth.address.length !== 42
      ) {
        throw new Error(
          `Authorization at index ${index} has invalid address format: ${auth.address}`,
        );
      }
    });
  }

  try {
    const serializedTx = serializeTransaction(tx);

    const payload: SigningPayload = {
      signerPath: DEFAULT_ETH_DERIVATION,
      curveType: Constants.SIGNING.CURVES.SECP256K1,
      hashType: Constants.SIGNING.HASHES.KECCAK256,
      encodingType: Constants.SIGNING.ENCODINGS.EIP7702_AUTH_LIST,
      payload: serializedTx,
    };

    const signedPayload = await queue((client) =>
      client.sign({ data: payload }),
    );
    console.log('signedPayload', signedPayload);
    console.log('signedPayload.sig', signedPayload.sig);

    // Return the SignData structure from Lattice, not the converted signature
    return signedPayload;
  } catch (error) {
    console.error('DEBUG: Error during serialization:', error);
    throw error;
  }
};

export const signBtcLegacyTx = async (
  payload: BitcoinSignPayload,
): Promise<SignData> => {
  const tx = {
    data: {
      signerPath: BTC_LEGACY_DERIVATION,
      ...payload,
    },
    currency: CURRENCIES.BTC,
  };
  return queue((client) => client.sign(tx));
};

export const signBtcSegwitTx = async (
  payload: BitcoinSignPayload,
): Promise<SignData> => {
  const tx = {
    data: {
      signerPath: BTC_SEGWIT_DERIVATION,
      ...payload,
    },
    currency: CURRENCIES.BTC,
  };
  return queue((client) => client.sign(tx));
};

export const signBtcWrappedSegwitTx = async (
  payload: BitcoinSignPayload,
): Promise<SignData> => {
  const tx = {
    data: {
      signerPath: BTC_WRAPPED_SEGWIT_DERIVATION,
      ...payload,
    },
    currency: CURRENCIES.BTC,
  };
  return queue((client) => client.sign(tx));
};

export const signSolanaTx = async (
  payload: Buffer,
  overrides?: SignRequestParams,
): Promise<SignData> => {
  const tx = {
    data: {
      signerPath: SOLANA_DERIVATION,
      curveType: Constants.SIGNING.CURVES.ED25519,
      hashType: Constants.SIGNING.HASHES.NONE,
      encodingType: Constants.SIGNING.ENCODINGS.SOLANA,
      payload,
      ...overrides,
    },
  };
  return queue((client) => client.sign(tx));
};
