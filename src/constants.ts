import {
  LatticeEncDataSchema,
  LatticeGetAddressesFlag,
  LatticeSignBlsDst,
  LatticeSignCurve,
  LatticeSignEncoding,
  LatticeSignHash,
} from './protocol/latticeConstants';

/**
 * Externally exported constants used for building requests
 * @public
 */
export const EXTERNAL = {
  // Optional flags for `getAddresses`
  GET_ADDR_FLAGS: {
    SECP256K1_PUB: LatticeGetAddressesFlag.secp256k1Pubkey,
    ED25519_PUB: LatticeGetAddressesFlag.ed25519Pubkey,
    BLS12_381_G1_PUB: LatticeGetAddressesFlag.bls12_381Pubkey,
  },
  // Options for building general signing requests
  SIGNING: {
    HASHES: {
      NONE: LatticeSignHash.none,
      KECCAK256: LatticeSignHash.keccak256,
      SHA256: LatticeSignHash.sha256,
    },
    CURVES: {
      SECP256K1: LatticeSignCurve.secp256k1,
      ED25519: LatticeSignCurve.ed25519,
      BLS12_381_G2: LatticeSignCurve.bls12_381,
    },
    ENCODINGS: {
      NONE: LatticeSignEncoding.none,
      SOLANA: LatticeSignEncoding.solana,
      EVM: LatticeSignEncoding.evm,
      ETH_DEPOSIT: LatticeSignEncoding.eth_deposit,
    },
    BLS_DST: {
      BLS_DST_NUL: LatticeSignBlsDst.NUL,
      BLS_DST_POP: LatticeSignBlsDst.POP,
    },
  },
  // Options for exporting encrypted data
  ENC_DATA: {
    SCHEMAS: {
      BLS_KEYSTORE_EIP2335_PBKDF_V4: LatticeEncDataSchema.eip2335,
    },
  },
  ETH_CONSENSUS_SPEC: {
    NETWORKS: {
      MAINNET_GENESIS: {
        networkName: 'mainnet',
        forkVersion: Buffer.alloc(4),
        // Empty root because there were no validators at genesis
        validatorsRoot: Buffer.alloc(32),
      },
    },
    DOMAINS: {
      DEPOSIT: Buffer.from('03000000', 'hex'),
      VOLUNTARY_EXIT: Buffer.from('04000000', 'hex'),
    },
  },
} as const;

//===============================
// INTERNAL CONSTANTS
//===============================
/** @internal */
const addressSizes = {
  BTC: 20, // 20 byte pubkeyhash
  ETH: 20, // 20 byte address not including 0x prefix
} as const;

/** @internal */
const CURRENCIES = {
  ETH: 'ETH',
  BTC: 'BTC',
  ETH_MSG: 'ETH_MSG',
} as const;

/** @internal */
// THIS NEEDS TO BE A PROTOCOL CONSTANT TOO
const signingSchema = {
  BTC_TRANSFER: 0,
  ETH_TRANSFER: 1,
  ERC20_TRANSFER: 2,
  ETH_MSG: 3,
  EXTRA_DATA: 4,
  GENERAL_SIGNING: 5,
} as const;

/** @internal */
const HARDENED_OFFSET = 0x80000000; // Hardened offset

/** @internal */
const BIP_CONSTANTS = {
  PURPOSES: {
    ETH: HARDENED_OFFSET + 44,
    BTC_LEGACY: HARDENED_OFFSET + 44,
    BTC_WRAPPED_SEGWIT: HARDENED_OFFSET + 49,
    BTC_SEGWIT: HARDENED_OFFSET + 84,
  },
  COINS: {
    ETH: HARDENED_OFFSET + 60,
    BTC: HARDENED_OFFSET,
    BTC_TESTNET: HARDENED_OFFSET + 1,
  },
} as const;

/** @internal For all HSM-bound requests */
const REQUEST_TYPE_BYTE = 0x02;

/** @internal */
const VERSION_BYTE = 1;

/** @internal ChainId value to signify larger chainID is in data buffer */
const HANDLE_LARGER_CHAIN_ID = 255;

/** @internal Max number of bytes to contain larger chainID in data buffer */
const MAX_CHAIN_ID_BYTES = 8;

/** @internal */
const BASE_URL = 'https://signing.gridpl.us';

/** @internal */
const EIP712_ABI_LATTICE_FW_TYPE_MAP = {
  address: 1,
  bool: 2,
  uint8: 3,
  uint16: 4,
  uint24: 5,
  uint32: 6,
  uint40: 7,
  uint48: 8,
  uint56: 9,
  uint64: 10,
  uint72: 11,
  uint80: 12,
  uint88: 13,
  uint96: 14,
  uint104: 15,
  uint112: 16,
  uint120: 17,
  uint128: 18,
  uint136: 19,
  uint144: 20,
  uint152: 21,
  uint160: 22,
  uint168: 23,
  uint176: 24,
  uint184: 25,
  uint192: 26,
  uint200: 27,
  uint208: 28,
  uint216: 29,
  uint224: 30,
  uint232: 31,
  uint240: 32,
  uint248: 33,
  uint256: 34,
  int8: 35,
  int16: 36,
  int24: 37,
  int32: 38,
  int40: 39,
  int48: 40,
  int56: 41,
  int64: 42,
  int72: 43,
  int80: 44,
  int88: 45,
  int96: 46,
  int104: 47,
  int112: 48,
  int120: 49,
  int128: 50,
  int136: 51,
  int144: 52,
  int152: 53,
  int160: 54,
  int168: 55,
  int176: 56,
  int184: 57,
  int192: 58,
  int200: 59,
  int208: 60,
  int216: 61,
  int224: 62,
  int232: 63,
  int240: 64,
  int248: 65,
  int256: 66,
  uint: 67,
  bytes1: 69,
  bytes2: 70,
  bytes3: 71,
  bytes4: 72,
  bytes5: 73,
  bytes6: 74,
  bytes7: 75,
  bytes8: 76,
  bytes9: 77,
  bytes10: 78,
  bytes11: 79,
  bytes12: 80,
  bytes13: 81,
  bytes14: 82,
  bytes15: 83,
  bytes16: 84,
  bytes17: 85,
  bytes18: 86,
  bytes19: 87,
  bytes20: 88,
  bytes21: 89,
  bytes22: 90,
  bytes23: 91,
  bytes24: 92,
  bytes25: 93,
  bytes26: 94,
  bytes27: 95,
  bytes28: 96,
  bytes29: 97,
  bytes30: 98,
  bytes31: 99,
  bytes32: 100,
  bytes: 101,
  string: 102,
};

/** @internal */
const ETH_ABI_LATTICE_FW_TYPE_MAP = {
  ...EIP712_ABI_LATTICE_FW_TYPE_MAP,
  tuple1: 103,
  tuple2: 104,
  tuple3: 105,
  tuple4: 106,
  tuple5: 107,
  tuple6: 108,
  tuple7: 109,
  tuple8: 110,
  tuple9: 111,
  tuple10: 112,
  tuple11: 113,
  tuple12: 114,
  tuple13: 115,
  tuple14: 116,
  tuple15: 117,
  tuple16: 118,
  tuple17: 119, // Firmware currently cannot support tuples larger than this
};

/** @internal */
const ethMsgProtocol = {
  SIGN_PERSONAL: {
    str: 'signPersonal',
    enumIdx: 0, // Enum index of this protocol in Lattice firmware
  },
  TYPED_DATA: {
    str: 'typedData',
    enumIdx: 1,
    rawDataMaxLen: 1629, // Max size of raw data payload in bytes
    typeCodes: EIP712_ABI_LATTICE_FW_TYPE_MAP, // Enum indices of data types in Lattice firmware
  },
};

/** @internal */
function getFwVersionConst(v: Buffer): FirmwareConstants {
  const c: any = {
    extraDataFrameSz: 0,
    extraDataMaxFrames: 0,
    genericSigning: {} as any,
  };
  function gte(v: Buffer, exp: FirmwareArr): boolean {
    // Note that `v` fields come in as [fix|minor|major]
    return (
      v[2] > exp[0] ||
      (v[2] === exp[0] && v[1] > exp[1]) ||
      (v[2] === exp[0] && v[1] === exp[1] && v[0] > exp[2]) ||
      (v[2] === exp[0] && v[1] === exp[1] && v[0] === exp[2])
    );
  }
  // Very old legacy versions do not give a version number
  const legacy = v.length === 0;

  // BASE FIELDS
  //--------------------------------------

  // Various size constants have changed on the firmware side over time and
  // are captured here
  if (!legacy && gte(v, [0, 10, 4])) {
    // >=0.10.3
    c.reqMaxDataSz = 1678;
    c.ethMaxGasPrice = 20000000000000; // 20000 gwei
    c.addrFlagsAllowed = true;
  } else if (!legacy && gte(v, [0, 10, 0])) {
    // >=0.10.0
    c.reqMaxDataSz = 1678;
    c.ethMaxGasPrice = 20000000000000; // 20000 gwei
    c.addrFlagsAllowed = true;
  } else {
    // Legacy or <0.10.0
    c.reqMaxDataSz = 1152;
    c.ethMaxGasPrice = 500000000000; // 500 gwei
    c.addrFlagsAllowed = false;
  }
  // These transformations apply to all versions. The subtraction
  // of 128 bytes accounts for metadata and is for legacy reasons.
  // For all modern versions, these are 1550 bytes.
  // NOTE: Non-legacy ETH txs (e.g. EIP1559) will shrink
  // this number.
  // See `ETH_BASE_TX_MAX_DATA_SZ` and `ETH_MAX_BASE_MSG_SZ` in firmware
  c.ethMaxDataSz = c.reqMaxDataSz - 128;
  c.ethMaxMsgSz = c.ethMaxDataSz;
  // Max number of params in an EIP712 type. This was added to firmware
  // to avoid blowing stack size.
  c.eip712MaxTypeParams = 18;

  // -----
  // EXTRA FIELDS ADDED IN LATER FIRMWARE VERSIONS
  // -----

  // --- V0.10.X ---
  // V0.10.4 introduced the ability to send signing requests over multiple
  // data frames (i.e. in multiple requests)
  if (!legacy && gte(v, [0, 10, 4])) {
    c.extraDataFrameSz = 1500; // 1500 bytes per frame of extraData allowed
    c.extraDataMaxFrames = 1; // 1 frame of extraData allowed
  }
  // V0.10.5 added the ability to use flexible address path sizes, which
  // changes the `getAddress` API. It also added support for EIP712
  if (!legacy && gte(v, [0, 10, 5])) {
    c.varAddrPathSzAllowed = true;
    c.eip712Supported = true;
  }
  // V0.10.8 allows a user to sign a prehashed transaction if the payload
  // is too big
  if (!legacy && gte(v, [0, 10, 8])) {
    c.prehashAllowed = true;
  }
  // V0.10.10 allows a user to sign a prehashed ETH message if payload too big
  if (!legacy && gte(v, [0, 10, 10])) {
    c.ethMsgPreHashAllowed = true;
  }

  // --- 0.11.X ---
  // V0.11.0 allows new ETH transaction types
  if (!legacy && gte(v, [0, 11, 0])) {
    c.allowedEthTxTypes = [
      1, // eip2930
      2, // eip1559
    ];
    // This version added extra data fields to the ETH tx
    c.ethMaxDataSz -= 10;
    c.ethMaxMsgSz = c.ethMaxDataSz;
  }
  // V0.11.2 changed how messages are displayed. For personal_sign messages
  // we now write the header (`Signer: <path>`) into the main body of the screen.
  // This means personal sign message max size is slightly smaller than for
  // EIP712 messages because in the latter case there is no header
  // Note that `<path>` has max size of 62 bytes (`m/X/X/...`)
  if (!legacy && gte(v, [0, 11, 2])) {
    c.personalSignHeaderSz = 72;
  }

  // --- V0.12.X ---
  // V0.12.0 added an API for creating, removing, and fetching key-val file
  // records. For the purposes of this SDK, we only hook into one type of kv
  // file: address names.
  if (!legacy && gte(v, [0, 12, 0])) {
    c.kvActionsAllowed = true;
    c.kvKeyMaxStrSz = 63;
    c.kvValMaxStrSz = 63;
    c.kvActionMaxNum = 10;
    c.kvRemoveMaxNum = 100;
  }

  // --- V0.13.X ---
  // V0.13.0 added native segwit addresses and fixed a bug in exporting
  // legacy bitcoin addresses
  if (!legacy && gte(v, [0, 13, 0])) {
    c.allowBtcLegacyAndSegwitAddrs = true;
    // Random address to be used when trying to deploy a contract
    c.contractDeployKey = '0x08002e0fec8e6acf00835f43c9764f7364fa3f42';
  }

  // --- V0.14.X ---
  // V0.14.0 added support for a more robust API around ABI definitions
  // and generic signing functionality
  if (!legacy && gte(v, [0, 14, 0])) {
    // Size of `category` buffer. Inclusive of null terminator byte.
    c.abiCategorySz = 32;
    c.abiMaxRmv = 200; // Max number of ABI defs that can be removed with
    // a single request
    // See `sizeof(GenericSigningRequest_t)` in firmware
    c.genericSigning.baseReqSz = 1552;
    // See `GENERIC_SIGNING_BASE_MSG_SZ` in firmware
    c.genericSigning.baseDataSz = 1519;
    c.genericSigning.hashTypes = EXTERNAL.SIGNING.HASHES;
    c.genericSigning.curveTypes = EXTERNAL.SIGNING.CURVES;
    c.genericSigning.encodingTypes = {
      NONE: EXTERNAL.SIGNING.ENCODINGS.NONE,
      SOLANA: EXTERNAL.SIGNING.ENCODINGS.SOLANA,
    };
    // Supported flags for `getAddresses`
    c.getAddressFlags = [
      EXTERNAL.GET_ADDR_FLAGS.ED25519_PUB,
      EXTERNAL.GET_ADDR_FLAGS.SECP256K1_PUB,
    ];
    // We updated the max number of params in EIP712 types
    c.eip712MaxTypeParams = 36;
  }
  // DEPRECATED
  // V0.14.1 Added the Terra decoder
  // if (!legacy && gte(v, [0, 14, 1])) {
  //   c.genericSigning.encodingTypes.TERRA = EXTERNAL.SIGNING.ENCODINGS.TERRA;
  // }

  // --- V0.15.X ---
  // V0.15.0 added an EVM decoder and removed the legacy ETH signing pathway
  if (!legacy && gte(v, [0, 15, 0])) {
    c.genericSigning.encodingTypes.EVM = EXTERNAL.SIGNING.ENCODINGS.EVM;
    // We now use the general signing data field as the base
    // Note that we have NOT removed the ETH_MSG type so we should
    // not change ethMaxMsgSz
    c.ethMaxDataSz = 1550 - 31;
    // Max buffer size for get/add decoder requests
    c.maxDecoderBufSz = 1600;
    // Code used to write a calldata decoder
    c.genericSigning.calldataDecoding = {
      reserved: 2895728,
      maxSz: 1024,
    };
  }

  // --- V0.17.X ---
  // V0.17.0 added support for BLS12-381-G1 pubkeys and G2 sigs
  if (!legacy && gte(v, [0, 17, 0])) {
    c.getAddressFlags.push(EXTERNAL.GET_ADDR_FLAGS.BLS12_381_G1_PUB);
    c.genericSigning.encodingTypes.ETH_DEPOSIT =
      EXTERNAL.SIGNING.ENCODINGS.ETH_DEPOSIT;
  }

  return c;
}

/** @internal */
// eslint-disable-next-line no-control-regex
const ASCII_REGEX = /^[\x00-\x7F]+$/;

/** @internal */
const EXTERNAL_NETWORKS_BY_CHAIN_ID_URL =
  'https://gridplus.github.io/chains/chains.json';

/** @internal - Max number of addresses to fetch */
const MAX_ADDR = 10;

/** @internal */
const NETWORKS_BY_CHAIN_ID = {
  1: {
    name: 'ethereum',
    baseUrl: 'https://api.etherscan.io',
    apiRoute: 'api?module=contract&action=getabi',
  },
  137: {
    name: 'polygon',
    baseUrl: 'https://api.polygonscan.com',
    apiRoute: 'api?module=contract&action=getabi',
  },
  56: {
    name: 'binance',
    baseUrl: 'https://api.bscscan.com',
    apiRoute: 'api?module=contract&action=getabi',
  },
  42220: {
    name: 'celo',
    baseUrl: 'https://api.celoscan.io',
    apiRoute: 'api?module=contract&action=getabi',
  },
  43114: {
    name: 'avalanche',
    baseUrl: 'https://api.snowtrace.io',
    apiRoute: 'api?module=contract&action=getabi',
  },
};

/** @internal */
export const EMPTY_WALLET_UID = Buffer.alloc(32);

/** @internal */
export const DEFAULT_ACTIVE_WALLETS: ActiveWallets = {
  internal: {
    uid: EMPTY_WALLET_UID,
    external: false,
    name: Buffer.alloc(0),
    capabilities: 0,
  },
  external: {
    uid: EMPTY_WALLET_UID,
    external: true,
    name: Buffer.alloc(0),
    capabilities: 0,
  },
};

/** @internal */
export const DEFAULT_ETH_DERIVATION = [
  HARDENED_OFFSET + 44,
  HARDENED_OFFSET + 60,
  HARDENED_OFFSET,
  0,
  0,
];

/** @internal */
export const BTC_LEGACY_DERIVATION = [
  HARDENED_OFFSET + 44,
  HARDENED_OFFSET + 0,
  HARDENED_OFFSET,
  0,
  0,
];

/** @internal */
export const BTC_SEGWIT_DERIVATION = [
  HARDENED_OFFSET + 84,
  HARDENED_OFFSET,
  HARDENED_OFFSET,
  0,
  0,
];

/** @internal */
export const BTC_WRAPPED_SEGWIT_DERIVATION = [
  HARDENED_OFFSET + 49,
  HARDENED_OFFSET,
  HARDENED_OFFSET,
  0,
  0,
];

/** @internal */
export const SOLANA_DERIVATION = [
  HARDENED_OFFSET + 44,
  HARDENED_OFFSET + 501,
  HARDENED_OFFSET,
  HARDENED_OFFSET,
];

/** @internal */
export const LEDGER_LIVE_DERIVATION = [
  HARDENED_OFFSET + 49,
  HARDENED_OFFSET + 60,
  HARDENED_OFFSET,
  0,
  0,
];

/** @internal */
export const LEDGER_LEGACY_DERIVATION = [
  HARDENED_OFFSET + 49,
  HARDENED_OFFSET + 60,
  HARDENED_OFFSET,
  0,
];

export {
  ASCII_REGEX,
  getFwVersionConst,
  BIP_CONSTANTS,
  BASE_URL,
  CURRENCIES,
  MAX_ADDR,
  NETWORKS_BY_CHAIN_ID,
  EXTERNAL_NETWORKS_BY_CHAIN_ID_URL,
  addressSizes,
  ethMsgProtocol,
  signingSchema,
  REQUEST_TYPE_BYTE,
  VERSION_BYTE,
  HARDENED_OFFSET,
  HANDLE_LARGER_CHAIN_ID,
  MAX_CHAIN_ID_BYTES,
  ETH_ABI_LATTICE_FW_TYPE_MAP,
  EXTERNAL as PUBLIC,
};
