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
  SignRequestParams,
  SignData,
  EIP712MessagePayload,
  BitcoinSignPayload,
  Currency,
} from '../types';
import { isEIP712Payload, queue } from './utilities';

export const sign = async (data: SignRequestParams): Promise<SignData> => {
  return queue((client) => client.sign(data));
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
    },
    currency: CURRENCIES.ETH_MSG as Currency,
  } as SignRequestParams & { data: {protocol: string}};

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
    currency: 'BTC' as Currency,
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
    currency: 'BTC'as Currency,
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
    currency: 'BTC'as Currency,
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
