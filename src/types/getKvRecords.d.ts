interface GetKvRecordsRequestParams {
  type?: number;
  n?: number;
  start?: number;
}

interface GetKvRecordsRequestFunctionParams extends GetKvRecordsRequestParams {
  client: Client;
}

type AddressTag = {
  caseSensitive: boolean;
  id: number;
  key: string;
  type: number;
  val: string;
};

interface GetKvRecordsData {
  records: AddressTag[];
  fetched: number;
  total: number;
}
