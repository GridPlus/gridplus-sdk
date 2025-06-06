import { RLP } from '@ethereumjs/rlp';
import { keccak256 } from 'js-sha3';
import {
  serializeTransaction,
  type Address,
  type Hex,
  type TransactionSerializable,
  type TransactionSerializableEIP7702,
} from 'viem';
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
  SignData,
  SigningPayload,
  SignRequestParams,
  TransactionRequest,
} from '../types';
import { getYParity } from '../util';
import { queue } from './utilities';

// Define the authorization request type based on Viem's structure
type AuthorizationRequest = {
  chainId: number;
  nonce: number;
} & ({ address: Address } | { contractAddress: Address });

/**
 * Sign a transaction using Viem-compatible transaction types
 */
export const sign = async (
  transaction: TransactionRequest | TransactionSerializable,
  overrides?: Omit<SignRequestParams, 'data'>,
): Promise<SignData> => {
  // Handle both our transaction format and Viem's format
  const serializedTx =
    'type' in transaction && typeof transaction.type === 'string'
      ? serializeTransaction(transaction as TransactionSerializable)
      : isEip7702Transaction(transaction as TransactionRequest)
        ? serializeEIP7702Transaction(transaction as any)
        : serializeTransaction(
            toViemTransaction(transaction as TransactionRequest),
          );

  const payload: SigningPayload = {
    signerPath: DEFAULT_ETH_DERIVATION,
    curveType: Constants.SIGNING.CURVES.SECP256K1,
    hashType: Constants.SIGNING.HASHES.KECCAK256,
    encodingType: Constants.SIGNING.ENCODINGS.EIP7702_AUTH_LIST,
    payload: serializedTx,
    decoder: await fetchDecoder(transaction as TransactionRequest),
  };

  return queue((client) => client.sign({ data: payload, ...overrides }));
};

/**
 * Sign a message with support for EIP-712 typed data and const assertions
 */
export function signMessage(
  payload: string | Uint8Array | Buffer | Buffer[],
  overrides?: Omit<SignRequestParams, 'data'>,
): Promise<SignData> {
  const basePayload: SigningPayload = {
    signerPath: DEFAULT_ETH_DERIVATION,
    curveType: Constants.SIGNING.CURVES.SECP256K1,
    hashType: Constants.SIGNING.HASHES.KECCAK256,
    protocol: 'signPersonal',
    payload: payload as Hex,
    ...overrides,
  };

  const tx: SignRequestParams = {
    data: basePayload,
    currency: CURRENCIES.ETH_MSG,
  };

  return queue((client) => client.sign(tx));
}

/**
 * Signs an EIP-7702 authorization to set code for an externally owned account (EOA).
 * Returns a Viem-compatible authorization object.
 */
export const signAuthorization = async (
  authorization: AuthorizationRequest,
  overrides?: Omit<SignRequestParams, 'data'>,
): Promise<Authorization> => {
  // EIP-7702 authorization message is: MAGIC || rlp([chain_id, address, nonce])
  // MAGIC = 0x05 per EIP-7702 spec
  const MAGIC = Buffer.from([0x05]);

  // Handle the address/contractAddress alias
  const address =
    'address' in authorization
      ? authorization.address
      : authorization.contractAddress;

  const message = Buffer.concat([
    MAGIC,
    Buffer.from(
      RLP.encode([authorization.chainId, address, authorization.nonce]),
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

    // Create a complete Authorization object with all required signature components
    const result: Authorization = {
      address, // Viem compatibility
      chainId: authorization.chainId,
      nonce: authorization.nonce,
      yParity,
      r: `0x${response.sig.r.toString('hex')}` as Hex,
      s: `0x${response.sig.s.toString('hex')}` as Hex,
    };

    return result;
  }

  throw new Error('Failed to get signature from device');
};

/**
 * Sign an EIP-7702 transaction using Viem-compatible types
 */
export const signAuthorizationList = async (
  tx: TransactionSerializableEIP7702,
): Promise<SignData> => {
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

    // Return the SignData structure from Lattice, not the converted signature
    return signedPayload;
  } catch (error) {
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
