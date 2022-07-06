interface GetAddressesRequestParams {
  startPath: number[];
  n: number;
  flag?: number;
}

interface GetAddressesRequestFunctionParams extends GetAddressesRequestParams {
  client: Client;
}

interface ValidateGetAddressesRequestParams extends GetAddressesRequestParams {
  url?: string;
  fwVersion?: Buffer;
  wallet?: Wallet;
  ephemeralPub?: Buffer;
  sharedSecret?: Buffer;
}

interface EncodeGetAddressesRequestParams {
  fwVersion: any;
  startPath: number[];
  n: number;
  wallet: Wallet;
  flag: number;
}
