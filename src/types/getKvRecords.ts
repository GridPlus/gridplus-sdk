import { Client } from '../client';

export interface GetKvRecordsRequestParams {
  type?: number;
  n?: number;
  start?: number;
}

export interface GetKvRecordsRequestFunctionParams
  extends GetKvRecordsRequestParams {
  client: Client;
}

export type AddressTag = {
  caseSensitive: boolean;
  id: number;
  key: string;
  type: number;
  val: string;
};

export interface GetKvRecordsData {
  records: AddressTag[];
  fetched: number;
  total: number;
}
