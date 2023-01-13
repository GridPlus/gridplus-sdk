interface SignRequestParams {
  data: SigningPayload;
  currency?: Currency;
  cachedData?: any;
  nextCode?: Buffer;
}

interface SignRequestFunctionParams extends SignRequestParams {
  client: Client;
}

interface EncodeSignRequestParams {
  fwConstants: FirmwareConstants;
  wallet: Wallet;
  requestData: any;
  cachedData?: any;
  nextCode?: Buffer;
}

interface SignRequest {
  payload: Buffer;
  schema: number;
}

interface EthSignRequest extends SignRequest {
  curveType: number;
  encodingType: number;
  hashType: number;
  omitPubkey: boolean;
  origPayloadBuf: Buffer;
  extraDataPayloads: Buffer[];
}

interface EthMsgSignRequest extends SignRequest {
  input: {
    signerPath: SigningPath;
    payload: Buffer;
    protocol: string;
    fwConstants: FirmwareConstants;
  };
}

interface BitcoinSignRequest extends SignRequest {
  origData: {
    prevOuts: any;
    recipient: string;
    value: number;
    fee: number;
    changePath: number[];
    fwConstants: FirmwareConstants;
  };
  changeData?: { value: number };
}

interface DecodeSignResponseParams {
  data: Buffer;
  /** The original request data */
  request: SignRequest;
  isGeneric: boolean;
  currency?: Currency;
}
