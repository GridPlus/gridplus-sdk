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
} from '../types';
import { isEIP712Payload, queue } from './utilities';
import { RLP } from '@ethereumjs/rlp';

export const signAuthorization = async (
  authorization: Authorization,
  overrides?: SignRequestParams,
): Promise<SignData> => {
  // EIP-7702 authorization message is: MAGIC || rlp([chain_id, address, nonce])
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
    encodingType: Constants.SIGNING.ENCODINGS.EVM,
    payload: message,
  };

  return queue((client) => client.sign({ data: payload, ...overrides }));
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
    encodingType: Constants.SIGNING.ENCODINGS.EVM,
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
