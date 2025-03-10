import { Client } from '../client';
import { SigningPath, Currency, Wallet } from './client';
import { FirmwareConstants } from './firmware';
import type { Address, Hex } from 'viem';

export type ETH_MESSAGE_PROTOCOLS = 'eip712' | 'signPersonal';

export const TRANSACTION_TYPE = {
  LEGACY: 0,
  EIP2930: 1,
  EIP1559: 2,
  EIP7702_AUTH: 4,
  EIP7702_AUTH_LIST: 5,
};

export type TransactionRequest =
  | {
      to: string;
      value: string;
      data: string;
      chainId: number;
      nonce: number;
      gasLimit: string;
      maxFeePerGas?: string;
      maxPriorityFeePerGas?: string;
      from?: string;
      accessList?: Array<{ address: string; storageKeys: string[] }>;
      type?: (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];
    }
  | Authorization
  | EIP7702Transaction;

export interface SigningPayload {
  signerPath: SigningPath;
  payload:
    | Uint8Array
    | Uint8Array[]
    | Buffer
    | Buffer[]
    | string
    | EIP712MessagePayload;
  curveType: number;
  hashType: number;
  encodingType?: number;
  protocol?: ETH_MESSAGE_PROTOCOLS;
  decoder?: Buffer;
}

export interface SignRequestParams {
  data: SigningPayload | BitcoinSignPayload;
  currency?: Currency;
  cachedData?: any;
  nextCode?: Buffer;
}

export interface SignRequestFunctionParams extends SignRequestParams {
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

export interface EIP712MessagePayload {
  types: {
    [key: string]: {
      name: string;
      type: string;
    }[];
  };
  domain: any;
  primaryType: string;
  message: any;
}

// EIP-7702 Types
export interface Authorization {
  contractAddress: Address;
  chainId: number;
  nonce: number;
  yParity?: Hex;
  r?: Hex;
  s?: Hex;
}

export interface EIP7702BaseTransaction {
  type: number;
  chainId: number;
  nonce: number;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
  gasLimit: bigint;
  to: Address;
  value: bigint;
  data?: Hex;
  validUntil: number;
  authorizedAmount: bigint;
}

export interface EIP7702AuthTransaction extends EIP7702BaseTransaction {
  type: 4;
  authorization: Authorization;
}

export interface EIP7702AuthListTransaction extends EIP7702BaseTransaction {
  type: 5;
  authorizations: Authorization[];
  accessList: {
    address: Address;
    storageKeys: Hex[];
  }[];
}

export type EIP7702Transaction =
  | EIP7702AuthTransaction
  | EIP7702AuthListTransaction;
