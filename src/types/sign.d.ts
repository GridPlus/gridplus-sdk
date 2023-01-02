interface SigningPayload {
  signerPath: SigningPath;
  payload: (Uint8Array | Buffer | Buffer[]) | string;
  curveType: number;
  hashType: number;
  encodingType?: number;
}

interface SignRequestParams {
  data: SigningPayload | BitcoinSignPayload;
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
    prevOuts: PreviousOutput[];
    recipient: string;
    value: number;
    fee: number;
    changePath: number[];
    fwConstants: FirmwareConstants;
  };
  changeData?: { value: number };
}

type PreviousOutput = {
  txHash: string;
  value: number;
  index: number;
  signerPath: number[];
};

type BitcoinSignPayload = {
  prevOuts: PreviousOutput[];
  recipient: string;
  value: number;
  fee: number;
  changePath: number[];
};

interface DecodeSignResponseParams {
  data: Buffer;
  /** The original request data */
  request: SignRequest;
  isGeneric: boolean;
  currency?: Currency;
}
