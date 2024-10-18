import { Client } from '../client';
import { KVRecords } from './shared';

export interface AddKvRecordsRequestParams {
  records: KVRecords;
  type?: number;
  caseSensitive?: boolean;
}

export interface AddKvRecordsRequestFunctionParams
  extends AddKvRecordsRequestParams {
  client: Client;
}
