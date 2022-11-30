// import { Client } from '../client'

interface TestRequestPayload {
  payload: Buffer;
  testID: number;
  client: Client;
}

interface EthDepositInfo {
  networkName: string;
  forkVersion: Buffer;
  validatorsRoot: Buffer;
}

interface EthDepositDataReq {
  // (optional) BLS withdrawal key or ETH1 withdrawal address
  withdrawalKey?: Buffer | string;
  // Amount to be deposited in GWei (10**9 wei)
  amountGwei: number;
  // Info about the chain we are using.
  // You probably shouldn't change this unless you know what you're doing.
  info: EthDepositInfo;
  // In order to be compatible with Ethereum's online launchpad, you need
  // to set the CLI version. Obviously we are not using the CLI here but
  // we are following the protocol outlined in v2.3.0.
  depositCliVersion: string;
}

interface EthDepositDataResp {
  // Validator's pubkey as a hex string
  pubkey: string;
  // JSON encoded deposit data
  depositData: string;
}