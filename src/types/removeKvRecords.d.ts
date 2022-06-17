interface RemoveKvRecordsRequestParams {
  type?: number;
  ids?: string[];
}

interface RemoveKvRecordsRequestFunctionParams
  extends RemoveKvRecordsRequestParams {
  client: Client;
}
interface ValidateRemoveKvRequestParams {
  url?: string;
  fwConstants?: FirmwareConstants;
  sharedSecret?: Buffer;
  ids?: string[];
  type?: number;
}

interface ValidatedRemoveKvRequest {
  url: string;
  fwConstants: FirmwareConstants;
  sharedSecret: Buffer;
  type: number;
  ids: string[];
}

interface EncodeRemoveKvRecordsRequestParams {
  type: number;
  ids: string[];
  fwConstants: FirmwareConstants;
}
