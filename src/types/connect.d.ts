interface ConnectRequestParams {
  id: string;
}

interface ConnectRequestFunctionParams extends ConnectRequestParams {
  client: Client;
}
