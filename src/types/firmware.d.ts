type FirmwareArr = [
  number,
  number,
  number,
]

interface FirmwareVersion {
  major: number;
  minor: number;
  fix: number;
}

interface GenericSigningData {
  calldataDecoding: {
    reserved: number;
    maxSz: number;
  };
  baseReqSz: number;
  // See `GENERIC_SIGNING_BASE_MSG_SZ` in firmware
  baseDataSz: number;
  hashTypes: EXTERNAL.SIGNING.HASHES;
  curveTypes: EXTERNAL.SIGNING.CURVES;
  encodingTypes: {
    NONE: EXTERNAL.SIGNING.ENCODINGS.NONE;
    SOLANA: EXTERNAL.SIGNING.ENCODINGS.SOLANA;
    EVM?: EXTERNAL.SIGNING.ENCODINGS.EVM;
  };
}

interface FirmwareConstants {
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
    EXTERNAL.GET_ADDR_FLAGS.ED25519_PUB,
    EXTERNAL.GET_ADDR_FLAGS.SECP256K1_PUB,
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

interface LatticeError {
  code: string;
  errno: string;
  message: string;
}