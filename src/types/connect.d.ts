interface ConnectRequestParams {
  id: string;
}

interface ConnectRequestFunctionParams extends ConnectRequestParams {
  client: Client;
}

interface ValidateConnectRequestParams {
  deviceId?: string;
  key?: KeyPair;
  baseUrl?: string;
}

interface ValidatedConnectRequest {
  deviceId: string;
  key: KeyPair;
  baseUrl: string;
}
interface EncodeConnectRequestParams {
  fwVersion: any;
  startPath: number[];
  n: number;
  wallet: Wallet;
  flag: number;
}
