interface SignRequestParams {
  data: SigningPayload;
  currency?: Currency;
  cachedData?: any;
  nextCode?: Buffer;
  retries?: number;
}

interface SignRequestFunctionParams extends SignRequestParams {
  client: Client;
}

interface ValidateSignRequestParams {
  url?: string;
  fwConstants?: FirmwareConstants;
  wallet?: Wallet;
  sharedSecret?: Buffer;
}

interface ValidatedSignRequest {
  deviceId: string;
  key: KeyPair;
  baseUrl: string;
}

interface EncodeSignRequestParams {
  request: any;
  fwConstants: FirmwareConstants;
  wallet: Wallet;
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
  request: EthSignRequest | EthMsgSignRequest | BitcoinSignRequest;
  isGeneric: boolean;
  currency?: Currency;
}