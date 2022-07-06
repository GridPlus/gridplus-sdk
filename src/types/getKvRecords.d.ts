interface GetKvRecordsRequestParams {
  type?: number;
  n?: number;
  start?: number;
}

interface GetKvRecordsRequestFunctionParams extends GetKvRecordsRequestParams {
  client: Client;
}

interface ValidateGetKvRequestParams {
  url?: string;
  fwConstants?: FirmwareConstants;
  sharedSecret?: Buffer;
  records?: KVRecords;
  n?: number;
  type?: number;
  start?: number;
}

interface EncodeGetKvRecordsRequestParams {
  type: number;
  n: number;
  start: number;
}


type GetKvRecordsData = {
  records: {
    id: string;
    [key: string]: string;
  }[];
  fetched: number;
  total: number;
};