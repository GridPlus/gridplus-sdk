import { Buffer } from 'buffer';
import { Constants } from '..';
import {
  BTC_LEGACY_DERIVATION,
  BTC_SEGWIT_DERIVATION,
  BTC_WRAPPED_SEGWIT_DERIVATION,
  CURRENCIES,
  DEFAULT_ETH_DERIVATION,
  SOLANA_DERIVATION,
} from '../constants';
import { fetchDecoder } from '../functions/fetchDecoder';
import {
  BitcoinSignPayload,
  EIP712MessagePayload,
  SignData,
  SigningPayload,
  SignRequestParams,
  TransactionRequest,
} from '../types';
import { isEIP712Payload, queue } from './utilities';
import {
  encodeViemTransaction,
  encodeViemTypedData,
  encodeViemPersonalMessage,
} from '../calldata/evm';

export const sign = async (
  transaction: TransactionRequest,
  overrides?: SignRequestParams,
): Promise<SignData> => {
  const serializedTx = encodeViemTransaction(transaction);

  const { def } = await fetchDecoder(transaction);

  const payload: SigningPayload = {
    signerPath: DEFAULT_ETH_DERIVATION,
    curveType: Constants.SIGNING.CURVES.SECP256K1,
    hashType: Constants.SIGNING.HASHES.KECCAK256,
    encodingType: Constants.SIGNING.ENCODINGS.EVM,
    payload: serializedTx,
    decoder:  def,
  };

  return queue((client) => client.sign({ data: payload, ...overrides }));
};

export const signMessage = async (
  payload: string | Uint8Array | Buffer | Buffer[] | EIP712MessagePayload,
  overrides?: SignRequestParams,
): Promise<SignData> => {
  let processedPayload = payload;
  let protocol = 'signPersonal';

  if (isEIP712Payload(payload)) {
    protocol = 'eip712';
    processedPayload = encodeViemTypedData(payload as any);
  } else if (typeof payload !== 'string') {
    processedPayload = encodeViemPersonalMessage(
      payload as Buffer | Uint8Array,
    );
  }

  const tx = {
    data: {
      signerPath: DEFAULT_ETH_DERIVATION,
      curveType: Constants.SIGNING.CURVES.SECP256K1,
      hashType: Constants.SIGNING.HASHES.KECCAK256,
      protocol,
      payload: processedPayload,
      ...overrides,
    } as SigningPayload,
    currency: CURRENCIES.ETH_MSG,
  };

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
