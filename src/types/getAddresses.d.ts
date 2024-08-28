interface GetAddressesRequestParams {
  startPath: number[];
  n: number;
  flag?: number;
  iterIdx?: number;
}

interface GetAddressesRequestFunctionParams extends GetAddressesRequestParams {
  client: Client;
}
