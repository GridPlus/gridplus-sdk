import { Buffer } from 'buffer/';
import 'hash.js';

export type KVRecord = {
  id?: number;
  type?: number;
  caseSensitive?: boolean;
  key?: string;
  val?: string;
};

export type SignData = {
  tx?: string;
  txHash?: string;
  changeRecipient?: string;
  sig?: {
    v: Buffer;
    r: Buffer;
    s: Buffer;
  };
  sigs?: Buffer[];
  signer?: Buffer;
  err?: string;
};

export type GetKvRecordsData = {
  records: {
    id: string;
    [key: string]: string;
  }[];
  fetched: number;
  total: number;
};
