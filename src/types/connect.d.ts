interface ConnectRequestParams {
  id: string;
}

interface ConnectRequestFunctionParams extends ConnectRequestParams {
  client: Client;
}

interface EncodeConnectRequestParams {
  fwVersion: any;
  startPath: number[];
  n: number;
  wallet: Wallet;
  flag: number;
}
