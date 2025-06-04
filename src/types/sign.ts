import { Client } from '../client';
import { SigningPath, Currency, Wallet } from './client';
import { FirmwareConstants } from './firmware';
import type {
  Address,
  Hex,
  Hash,
  TransactionSerializable,
  TransactionSerializableEIP1559,
  TransactionSerializableEIP2930,
  TransactionSerializableEIP7702,
  TypedData,
  TypedDataDefinition,
} from 'viem';

export type ETH_MESSAGE_PROTOCOLS = 'eip712' | 'signPersonal';

export const TRANSACTION_TYPE = {
  LEGACY: 0,
  EIP2930: 1,
  EIP1559: 2,
  EIP7702_AUTH: 4,
  EIP7702_AUTH_LIST: 5,
} as const;

export type TransactionRequest =
  | {
      to: Address;
      value?: Hex | bigint;
      data?: Hex;
      chainId: number;
      nonce: number;
      gasLimit: Hex | bigint;
      gasPrice?: Hex | bigint; // Legacy transactions
      maxFeePerGas?: Hex | bigint; // EIP-1559
      maxPriorityFeePerGas?: Hex | bigint; // EIP-1559
      from?: Address;
      accessList?: Array<{ address: Address; storageKeys: Hex[] }>;
      type?: (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];
    }
  | EIP7702Transaction;

export interface SigningPayload<
  TTypedData extends TypedData | Record<string, unknown> = TypedData,
> {
  signerPath: SigningPath;
  payload:
    | Uint8Array
    | Uint8Array[]
    | Buffer
    | Buffer[]
    | Hex
    | EIP712MessagePayload<TTypedData>;
  curveType: number;
  hashType: number;
  encodingType?: number;
  protocol?: ETH_MESSAGE_PROTOCOLS;
  decoder?: Buffer;
}

export interface SignRequestParams<
  TTypedData extends TypedData | Record<string, unknown> = TypedData,
> {
  data: SigningPayload<TTypedData> | BitcoinSignPayload;
  currency?: Currency;
  cachedData?: any;
  nextCode?: Buffer;
}

export interface SignRequestFunctionParams<
  TTypedData extends TypedData | Record<string, unknown> = TypedData,
> extends SignRequestParams<TTypedData> {
  client: Client;
}

export interface EncodeSignRequestParams {
  fwConstants: FirmwareConstants;
  wallet: Wallet;
  requestData: any;
  cachedData?: any;
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

export interface EIP712MessagePayload<
  TTypedData extends TypedData | Record<string, unknown> = TypedData,
  TPrimaryType extends keyof TTypedData | 'EIP712Domain' = keyof TTypedData,
> {
  types: TTypedData;
  domain: TTypedData extends TypedData
    ? TypedDataDefinition<TTypedData, 'EIP712Domain'>['message']
    : any;
  primaryType: TPrimaryType;
  message: TTypedData extends TypedData
    ? TypedDataDefinition<TTypedData, TPrimaryType>['message']
    : any;
}

// EIP-7702 Types

/**
 * EIP-7702 Authorization data structure - the data that gets signed.
 * This is what needs to be signed with ecrecover: keccak(MAGIC || rlp([chain_id, address, nonce]))
 */
export interface AuthorizationData {
  contractAddress: Address; // The target contract address for delegation
  chainId: number; // Either 0 (valid on all chains) or the specific chain ID
  nonce: number; // Must be less than 2^64 - 1
}

/**
 * EIP-7702 Authorization tuple structure compatible with Viem.
 * From the spec: "authorization_list = [[chain_id, address, nonce, y_parity, r, s], ...]"
 */
export interface Authorization extends AuthorizationData {
  address: Address; // Alias for contractAddress to match Viem
  yParity?: number; // Recovery parameter (v)
  r?: Hex; // r component of the signature
  s?: Hex; // s component of the signature (must be <= secp256k1n/2 per EIP-2)
}

/**
 * EIP-7702 Base transaction structure compatible with Viem.
 * From the spec:
 * "rlp([chain_id, nonce, max_priority_fee_per_gas, max_fee_per_gas, gas_limit, destination, value, data, access_list, authorization_list, signature_y_parity, signature_r, signature_s])"
 */
export interface EIP7702BaseTransaction {
  type: number; // Transaction type (0x04 for EIP-7702)
  chainId: number; // Chain ID for the transaction
  nonce: number; // Sender's nonce
  maxPriorityFeePerGas: bigint | Hex; // EIP-1559 max priority fee
  maxFeePerGas: bigint | Hex; // EIP-1559 max fee
  gasLimit: bigint | Hex; // Gas limit for the transaction
  to: Address; // Destination address (null destination not valid)
  value?: bigint | Hex; // ETH value to send
  data?: Hex; // Transaction calldata
  accessList?: Array<{ address: Address; storageKeys: Hex[] }>; // EIP-2930 access list
}

/**
 * EIP-7702 Single Authorization transaction (type 0x04).
 * This type includes a single authorization tuple.
 */
export interface EIP7702AuthTransaction extends EIP7702BaseTransaction {
  type: 4;
  authorization: Authorization;
}

/**
 * EIP-7702 Authorization List transaction (type 0x05).
 * This type includes multiple authorization tuples.
 */
export interface EIP7702AuthListTransaction extends EIP7702BaseTransaction {
  type: 5;
  authorizations: Authorization[];
}

export type EIP7702Transaction =
  | EIP7702AuthTransaction
  | EIP7702AuthListTransaction;

// Viem-compatible signature type
export interface ViemSignature {
  r: Hex;
  s: Hex;
  v: number;
  yParity: number;
}

// Enhanced SignData to be more Viem-compatible
export interface EnhancedSignData {
  sig?: {
    r: Buffer;
    s: Buffer;
    v: Buffer;
  };
  pubkey?: Buffer;
  signature?: ViemSignature; // Viem-compatible format
}
