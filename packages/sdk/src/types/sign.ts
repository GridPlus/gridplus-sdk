import type { AccessList, Address, Hex, SignedAuthorization, SignedAuthorizationList, TypedData, TypedDataDefinition } from 'viem';
import type { Client } from '../client';
import type { Currency, SigningPath, Wallet } from './client';
import type { FirmwareConstants } from './firmware';

export type ETH_MESSAGE_PROTOCOLS = 'eip712' | 'signPersonal';

export const TRANSACTION_TYPE = {
  LEGACY: 0,
  EIP2930: 1,
  EIP1559: 2,
  EIP7702_AUTH: 4,
  EIP7702_AUTH_LIST: 5,
} as const;

// Base transaction request with common fields
type BaseTransactionRequest = {
  from?: Address;
  to: Address;
  value?: Hex | bigint;
  data?: Hex;
  chainId: number;
  nonce: number;
  gasLimit?: Hex | bigint;
};

// Legacy transaction request
type LegacyTransactionRequest = BaseTransactionRequest & {
  type: typeof TRANSACTION_TYPE.LEGACY;
  gasPrice: Hex | bigint;
};

// EIP-2930 transaction request
type EIP2930TransactionRequest = BaseTransactionRequest & {
  type: typeof TRANSACTION_TYPE.EIP2930;
  gasPrice: Hex | bigint;
  accessList?: AccessList;
};

// EIP-1559 transaction request
type EIP1559TransactionRequest = BaseTransactionRequest & {
  type: typeof TRANSACTION_TYPE.EIP1559;
  maxFeePerGas: Hex | bigint;
  maxPriorityFeePerGas: Hex | bigint;
  accessList?: AccessList;
};

// EIP-7702 single authorization transaction request (type 4)
export type EIP7702AuthTransactionRequest = BaseTransactionRequest & {
  type: typeof TRANSACTION_TYPE.EIP7702_AUTH;
  maxFeePerGas: Hex | bigint;
  maxPriorityFeePerGas: Hex | bigint;
  accessList?: AccessList;
  authorization: SignedAuthorization;
};

// EIP-7702 authorization list transaction request (type 5)
export type EIP7702AuthListTransactionRequest = BaseTransactionRequest & {
  type: typeof TRANSACTION_TYPE.EIP7702_AUTH_LIST;
  maxFeePerGas: Hex | bigint;
  maxPriorityFeePerGas: Hex | bigint;
  accessList?: AccessList;
  authorizationList: SignedAuthorizationList;
};

// Main discriminated union for transaction requests
export type TransactionRequest = LegacyTransactionRequest | EIP2930TransactionRequest | EIP1559TransactionRequest | EIP7702AuthTransactionRequest | EIP7702AuthListTransactionRequest;

export interface SigningPayload<TTypedData extends TypedData | Record<string, unknown> = TypedData> {
  signerPath: SigningPath;
  payload: Uint8Array | Uint8Array[] | Buffer | Buffer[] | Hex | EIP712MessagePayload<TTypedData>;
  curveType: number;
  hashType: number;
  encodingType?: number;
  protocol?: ETH_MESSAGE_PROTOCOLS;
  decoder?: Buffer;
}

export interface SignRequestParams<TTypedData extends TypedData | Record<string, unknown> = TypedData> {
  data: SigningPayload<TTypedData> | BitcoinSignPayload;
  currency?: Currency;
  cachedData?: unknown;
  nextCode?: Buffer;
}

export interface SignRequestFunctionParams<TTypedData extends TypedData | Record<string, unknown> = TypedData> extends SignRequestParams<TTypedData> {
  client: Client;
}

export interface EncodeSignRequestParams {
  fwConstants: FirmwareConstants;
  wallet: Wallet;
  requestData: unknown;
  cachedData?: unknown;
  nextCode?: Buffer;
}

export interface SignRequest {
  payload: Buffer;
  schema: number;
}

export interface EthSignRequest extends SignRequest {
  curveType: number;
  encodingType: number;
  hashType: number;
  omitPubkey: boolean;
  origPayloadBuf: Buffer;
  extraDataPayloads: Buffer[];
}

export interface EthMsgSignRequest extends SignRequest {
  input: {
    signerPath: SigningPath;
    payload: Buffer;
    protocol: string;
    fwConstants: FirmwareConstants;
  };
}

export interface BitcoinSignRequest extends SignRequest {
  origData: {
    prevOuts: PreviousOutput[];
    recipient: string;
    value: number;
    fee: number;
    changePath: number[];
    fwConstants: FirmwareConstants;
  };
  changeData?: { value: number };
}

export type PreviousOutput = {
  txHash: string;
  value: number;
  index: number;
  signerPath: number[];
};

export type BitcoinSignPayload = {
  prevOuts: PreviousOutput[];
  recipient: string;
  value: number;
  fee: number;
  changePath: number[];
};

export interface DecodeSignResponseParams {
  data: Buffer;
  request: SignRequest;
  isGeneric: boolean;
  currency?: Currency;
}

// Align EIP712MessagePayload with Viem's TypedDataDefinition
export interface EIP712MessagePayload<TTypedData extends TypedData | Record<string, unknown> = TypedData, TPrimaryType extends keyof TTypedData | 'EIP712Domain' = keyof TTypedData> {
  types: TTypedData;
  domain: TTypedData extends TypedData ? TypedDataDefinition<TTypedData, 'EIP712Domain'>['domain'] : Record<string, unknown>;
  primaryType: TPrimaryType;
  message: TTypedData extends TypedData ? TypedDataDefinition<TTypedData, TPrimaryType>['message'] : Record<string, unknown>;
}
