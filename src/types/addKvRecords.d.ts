interface AddKvRecordsRequestParams {
  records: KVRecords;
  type?: number;
  caseSensitive?: boolean;
}

interface AddKvRecordsRequestFunctionParams extends AddKvRecordsRequestParams {
  client: Client;
}

interface EncodeAddKvRecordsRequestParams {
  records: KVRecords;
  fwConstants: FirmwareConstants;
  type: number;
  caseSensitive: boolean;
}
