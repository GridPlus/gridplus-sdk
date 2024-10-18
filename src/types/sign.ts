import { Client } from '../client';
import { SigningPath, Currency, Wallet } from './client';
import { FirmwareConstants } from './firmware';

export type ETH_MESSAGE_PROTOCOLS = 'eip712' | 'signPersonal';

export interface SigningPayload {
  signerPath: SigningPath;
  payload: Uint8Array | Buffer | Buffer[] | string | EIP712MessagePayload;
  curveType: number;
  hashType: number;
  encodingType?: number;
  protocol?: ETH_MESSAGE_PROTOCOLS;
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
  /** The original request data */
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
