import { EXTERNAL } from '../constants';

export type FirmwareArr = [number, number, number];

export interface FirmwareVersion {
  major: number;
  minor: number;
  fix: number;
}

export interface GenericSigningData {
  calldataDecoding: {
    reserved: number;
    maxSz: number;
  };
  baseReqSz: number;
  // See `GENERIC_SIGNING_BASE_MSG_SZ` in firmware
  baseDataSz: number;
  hashTypes: typeof EXTERNAL.SIGNING.HASHES;
  curveTypes: typeof EXTERNAL.SIGNING.CURVES;
  encodingTypes: {
    NONE: typeof EXTERNAL.SIGNING.ENCODINGS.NONE;
    SOLANA: typeof EXTERNAL.SIGNING.ENCODINGS.SOLANA;
    EVM?: typeof EXTERNAL.SIGNING.ENCODINGS.EVM;
  };
}

export interface FirmwareConstants {
  abiCategorySz: number;
  abiMaxRmv: number;
  addrFlagsAllowed: boolean;
  allowBtcLegacyAndSegwitAddrs: boolean;
  allowedEthTxTypes: number[];
  contractDeployKey: string;
  eip712MaxTypeParams: number;
  eip712Supported: boolean;
  ethMaxDataSz: number;
  ethMaxGasPrice: number;
  ethMaxMsgSz: number;
  ethMsgPreHashAllowed: boolean;
  extraDataFrameSz: number;
  extraDataMaxFrames: number;
  genericSigning: GenericSigningData;
  getAddressFlags: [
    typeof EXTERNAL.GET_ADDR_FLAGS.ED25519_PUB,
    typeof EXTERNAL.GET_ADDR_FLAGS.SECP256K1_PUB,
  ];
  kvActionMaxNum: number;
  kvActionsAllowed: boolean;
  kvKeyMaxStrSz: number;
  kvRemoveMaxNum: number;
  kvValMaxStrSz: number;
  maxDecoderBufSz: number;
  personalSignHeaderSz: number;
  prehashAllowed: boolean;
  reqMaxDataSz: number;
  varAddrPathSzAllowed: boolean;
  flexibleAddrPaths?: boolean;
}

export interface LatticeError {
  code: string;
  errno: string;
  message: string;
}
