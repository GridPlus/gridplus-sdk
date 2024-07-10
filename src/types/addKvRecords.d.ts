interface AddKvRecordsRequestParams {
  records: KVRecords;
  type?: number;
  caseSensitive?: boolean;
}

interface AddKvRecordsRequestFunctionParams extends AddKvRecordsRequestParams {
  client: Client;
}
