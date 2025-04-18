import { serializeTransaction } from 'viem';
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
  toViemTransaction,
  isEip7702Transaction,
  serializeEIP7702Transaction,
} from '../ethereum';
import { fetchDecoder } from '../functions/fetchDecoder';
import {
  BitcoinSignPayload,
  EIP712MessagePayload,
  SignData,
  SigningPayload,
  SignRequestParams,
  TransactionRequest,
  Authorization,
  AuthorizationData,
} from '../types';
import { isEIP712Payload, queue } from './utilities';
import { RLP } from '@ethereumjs/rlp';
import { getYParity } from '../util';
import type { Hex } from 'viem';
import { keccak256 } from 'js-sha3';

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
  authorization: AuthorizationData,
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
        authorization.address,
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
    result.yParity = `0x${yParity.toString(16)}` as Hex;
    result.r = `0x${response.sig.r.toString('hex')}` as Hex;
    result.s = `0x${response.sig.s.toString('hex')}` as Hex;
  }

  return result;
};

export const sign = async (
  transaction: TransactionRequest,
  overrides?: SignRequestParams,
): Promise<SignData> => {
  const serializedTx = isEip7702Transaction(transaction)
    ? serializeEIP7702Transaction(transaction)
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
