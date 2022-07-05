interface AddKvRecordsRequestParams {
  records: KVRecords;
  type?: number;
  caseSensitive?: boolean;
}
interface AddKvRecordsRequestFunctionParams extends AddKvRecordsRequestParams {
  client: Client;
}

interface ValidateAddKvRequestParams {
  url?: string;
  fwConstants?: FirmwareConstants;
  wallet?: Wallet;
  sharedSecret?: Buffer;
  records?: KVRecords;
}

interface EncodeAddKvRecordsRequestParams {
  records: KVRecords;
  fwConstants: FirmwareConstants;
  type: number;
  caseSensitive: boolean;
}
