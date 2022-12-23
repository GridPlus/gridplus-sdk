interface GetKvRecordsRequestParams {
  type?: number;
  n?: number;
  start?: number;
}

interface GetKvRecordsRequestFunctionParams extends GetKvRecordsRequestParams {
  client: Client;
}

interface GetKvRecordsData {
  records: {
    id: string;
    [key: string]: string;
  }[];
  fetched: number;
  total: number;
}