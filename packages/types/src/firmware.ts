import type {
  LatticeGetAddressesFlag,
  LatticeSignCurve,
  LatticeSignEncoding,
  LatticeSignHash,
} from './protocol';

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
  hashTypes: {
    NONE: typeof LatticeSignHash.none;
    KECCAK256: typeof LatticeSignHash.keccak256;
    SHA256: typeof LatticeSignHash.sha256;
    SHA512HALF?: typeof LatticeSignHash.sha512half;
    [key: string]: number | undefined;
  };
  curveTypes: {
    SECP256K1: typeof LatticeSignCurve.secp256k1;
    ED25519: typeof LatticeSignCurve.ed25519;
    BLS12_381_G2: typeof LatticeSignCurve.bls12_381;
    [key: string]: number | undefined;
  };
  encodingTypes: {
    NONE: typeof LatticeSignEncoding.none;
    SOLANA: typeof LatticeSignEncoding.solana;
    COSMOS?: typeof LatticeSignEncoding.cosmos;
    EVM?: typeof LatticeSignEncoding.evm;
    XRP?: typeof LatticeSignEncoding.xrp;
    [key: string]: number | undefined;
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
    typeof LatticeGetAddressesFlag.ed25519Pubkey,
    typeof LatticeGetAddressesFlag.secp256k1Pubkey,
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
