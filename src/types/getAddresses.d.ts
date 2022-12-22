interface GetAddressesRequestParams {
  startPath: number[];
  n: number;
  flag?: number;
}

interface GetAddressesRequestFunctionParams extends GetAddressesRequestParams {
  client: Client;
}
