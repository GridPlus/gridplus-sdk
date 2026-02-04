import type { TypedData } from 'viem';
import type { Client } from '../client';
import type { SignRequestParams } from '@gridplus/types';

/**
 * Re-export sign types from @gridplus/types
 */
export {
  TRANSACTION_TYPE,
  type ETH_MESSAGE_PROTOCOLS,
  type EIP7702AuthTransactionRequest,
  type EIP7702AuthListTransactionRequest,
  type TransactionRequest,
  type SigningPayload,
  type SignRequestParams,
  type EncodeSignRequestParams,
  type SignRequest,
  type EthSignRequest,
  type EthMsgSignRequest,
  type BitcoinSignRequest,
  type PreviousOutput,
  type BitcoinSignPayload,
  type DecodeSignResponseParams,
  type EIP712MessagePayload,
} from '@gridplus/types';

/**
 * SDK-specific types that reference the Client class
 */
export interface SignRequestFunctionParams<
  TTypedData extends TypedData | Record<string, unknown> = TypedData,
> extends SignRequestParams<TTypedData> {
  client: Client;
}
