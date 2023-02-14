interface RemoveKvRecordsRequestParams {
  type?: number;
  ids?: string[];
}

interface RemoveKvRecordsRequestFunctionParams
  extends RemoveKvRecordsRequestParams {
  client: Client;
}