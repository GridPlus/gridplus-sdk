// Consistent with Lattice's IV
const AES_IV = [
  0x6d, 0x79, 0x73, 0x65, 0x63, 0x72, 0x65, 0x74, 0x70, 0x61, 0x73, 0x73, 0x77,
  0x6f, 0x72, 0x64,
];

const ADDR_STR_LEN = 129; // 128-char strings (null terminated)

// Decrypted response lengths will be fixed for any given message type.
// These are defined in the Lattice spec.
// Every decrypted response should have a 65-byte pubkey prefixing it (and a 4-byte request ID)
// These are NOT counted in `decResLengths`, meaning these values are 69-bytes smaller than the
// corresponding structs in firmware.
const decResLengths = {
  empty: 0, // Only contains the pubkey
  getAddresses: 10 * ADDR_STR_LEN, // 10x 129 byte strings (128 bytes + null terminator)
  sign: 1090, // 1 DER signature for ETH, 10 for BTC + change pubkeyhash
  getWallets: 142, // 71 bytes per wallet record (response contains internal and external)
  addAbiDefs: 8,
  getKvRecords: 1395,
  getAbiRecords: 1215,
  removeAbiRecords: 1,
  test: 1646, // Max size of test response payload
};

// Every corresponding decrypted response struct in firmware has a pubkey
// and checksum added. These are not included in `decResLengths`
const DES_RES_EXTRADATA_LEN = 69;

// Encrypted responses also have metadata
// Prefix:
// * protocol version (1 byte)
// * response type, reserved (1 byte) -- not used
// * response id (4 bytes) -- not used
// * payload length (2 bytes)
// * response code (1 byte)
// Suffix:
// * checksum (4 bytes) -- NOT the same checksum as inside the decrypted msg
const ENC_MSG_METADATA_LEN = 13;

const ENC_MSG_EXTRA_LEN = DES_RES_EXTRADATA_LEN + ENC_MSG_METADATA_LEN;
// Per Lattice spec, all encrypted messages must fit in a buffer of this size.
// The length comes from the largest request/response data type size
// We also add the prefix length
let ENC_MSG_LEN = 0;
Object.keys(decResLengths).forEach((k) => {
  if (decResLengths[k] + ENC_MSG_EXTRA_LEN > ENC_MSG_LEN)
    ENC_MSG_LEN = decResLengths[k] + ENC_MSG_EXTRA_LEN;
});

const deviceCodes = {
  CONNECT: 1,
  ENCRYPTED_REQUEST: 2,
};

const encReqCodes = {
  FINALIZE_PAIRING: 0,
  GET_ADDRESSES: 1,
  ADD_PERMISSION: 2,
  SIGN_TRANSACTION: 3,
  GET_WALLETS: 4,
  ADD_PERMISSION_V0: 5,
  ADD_ABI_DEFS: 6,
  GET_KV_RECORDS: 7,
  ADD_KV_RECORDS: 8,
  REMOVE_KV_RECORDS: 9,
  GET_ABI_RECORDS: 10,
  REMOVE_ABI_RECORDS: 11,
  TEST: 12,
};

const messageConstants = {
  NOT_PAIRED: 0x00,
  PAIRED: 0x01,
};

const addressSizes = {
  BTC: 20, // 20 byte pubkeyhash
  ETH: 20, // 20 byte address not including 0x prefix
};

const responseCodes = {
  RESP_SUCCESS: 0x00,
  RESP_ERR_INVALID_MSG: 0x80,
  RESP_ERR_UNSUPPORTED_VER: 0x81,
  RESP_ERR_DEV_BUSY: 0x82,
  RESP_ERR_USER_TIMEOUT: 0x83,
  RESP_ERR_USER_DECLINED: 0x84,
  RESP_ERR_PAIR_FAIL: 0x85,
  RESP_ERR_PAIR_DISABLED: 0x86,
  RESP_ERR_PERMISSION_DISABLED: 0x87,
  RESP_ERR_INTERNAL: 0x88,
  RESP_ERR_GCE_TIMEOUT: 0x89,
  RESP_ERR_WRONG_WALLET: 0x8a,
  RESP_ERR_DEV_LOCKED: 0x8b,
  RESP_ERR_DISABLED: 0x8c,
  RESP_ERR_ALREADY: 0x8d,
  RESP_ERR_INVALID_EPHEM_ID: 0x8e,
};

const responseMsgs = {
  [responseCodes.RESP_SUCCESS]: 0x00,
  [responseCodes.RESP_ERR_INVALID_MSG]: 'Invalid Request',
  [responseCodes.RESP_ERR_UNSUPPORTED_VER]: 'Unsupported Version',
  [responseCodes.RESP_ERR_DEV_BUSY]: 'Device Busy',
  [responseCodes.RESP_ERR_USER_TIMEOUT]: 'Timeout Waiting for User',
  [responseCodes.RESP_ERR_USER_DECLINED]: 'Request Declined by User',
  [responseCodes.RESP_ERR_PAIR_FAIL]: 'Pairing Failed',
  [responseCodes.RESP_ERR_PAIR_DISABLED]: 'Pairing is Currently Disabled',
  [responseCodes.RESP_ERR_PERMISSION_DISABLED]:
    'Automated Signing is Currently Disabled',
  [responseCodes.RESP_ERR_INTERNAL]: 'Device Error',
  [responseCodes.RESP_ERR_GCE_TIMEOUT]: 'Timeout',
  [responseCodes.RESP_ERR_WRONG_WALLET]: 'Incorrect Wallet UID Provided',
  [responseCodes.RESP_ERR_DEV_LOCKED]: 'Device Locked',
  [responseCodes.RESP_ERR_DISABLED]: 'Disabled',
  [responseCodes.RESP_ERR_ALREADY]:
    'Record already exists. You must first remove it on your device.',
  [responseCodes.RESP_ERR_INVALID_EPHEM_ID]:
    'Could not find requester. Please reconnect.',
};

const signingSchema = {
  BTC_TRANSFER: 0,
  ETH_TRANSFER: 1,
  ERC20_TRANSFER: 2,
  ETH_MSG: 3,
  EXTRA_DATA: 4,
  GENERAL_SIGNING: 5,
};

const HARDENED_OFFSET = 0x80000000; // Hardened offset
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
};

const REQUEST_TYPE_BYTE = 0x02; // For all HSM-bound requests
const VERSION_BYTE = 1;
const HANDLE_LARGER_CHAIN_ID = 255; // ChainId value to signify larger chainID is in data buffer
const MAX_CHAIN_ID_BYTES = 8; // Max number of bytes to contain larger chainID in data buffer

const BASE_URL = 'https://signing.gridpl.us';

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

function getFwVersionConst(v) {
  const c: any = {
    extraDataFrameSz: 0,
    extraDataMaxFrames: 0,
  };
  function gte(v, exp) {
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

  // EXTRA FIELDS ADDED IN LATER VERSIONS
  //-------------------------------------

  // V0.14.0 added support for a more robust API around ABI definitions
  // and generic signing functionality
  if (!legacy && gte(v, [0, 14, 0])) {
    // Size of `category` buffer. Inclusive of null terminator byte.
    c.abiCategorySz = 32;
    c.abiMaxRmv = 200;  // Max number of ABI defs that can be removed with
                        // a single request
    if (!c.genericSigning) {
      c.genericSigning = {};
    }
    // See `sizeof(GenericSigningRequest_t)` in firmware
    c.genericSigning.baseReqSz = 1552;
    // See `GENERIC_SIGNING_BASE_MSG_SZ` in firmware
    c.genericSigning.baseDataSz = 1519;
    c.genericSigning.hashTypes = [ 'NONE', 'KECCAK256', 'SHA256' ];
    c.genericSigning.curveTypes = [ 'SECP256K1', 'ED25519' ];
    c.genericSigning.encodingTypes = [ 'ASCII', 'HEX' ];

    // We updated the max number of params in EIP712 types
    c.eip712MaxTypeParams = 36;
  }

  // V0.13.0 added native segwit addresses and fixed a bug in exporting
  // legacy bitcoin addresses
  if (!legacy && gte(v, [0, 13, 0])) {
    c.allowBtcLegacyAndSegwitAddrs = true;
    // Random address to be used when trying to deploy a contract
    c.contractDeployKey = '0x08002e0fec8e6acf00835f43c9764f7364fa3f42';
  }

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

  // V0.11.2 changed how messages are displayed. For personal_sign messages
  // we now write the header (`Signer: <path>`) into the main body of the screen.
  // This means personal sign message max size is slightly smaller than for
  // EIP712 messages because in the latter case there is no header
  // Note that `<path>` has max size of 62 bytes (`m/X/X/...`)
  if (!legacy && gte(v, [0, 11, 2])) {
    c.personalSignHeaderSz = 72;
  }

  // V0.11.0 allows new ETH transaction types
  if (!legacy && gte(v, [0, 11, 0])) {
    c.allowedEthTxTypesVersion = 1;
    c.allowedEthTxTypes = [
      1, // eip2930
      2, // eip1559
    ];
    c.totalExtraEthTxDataSz = 10;
  }

  // V0.10.10 allows a user to sign a prehashed ETH message if payload too big
  if (!legacy && gte(v, [0, 10, 10])) {
    c.ethMsgPreHashAllowed = true;
  }

  // V0.10.8 allows a user to sign a prehashed transaction if the payload
  // is too big
  if (!legacy && gte(v, [0, 10, 8])) {
    c.prehashAllowed = true;
  }
  // V0.10.5 added the ability to use flexible address path sizes, which
  // changes the `getAddress` API. It also added support for EIP712
  if (!legacy && gte(v, [0, 10, 5])) {
    c.varAddrPathSzAllowed = true;
    c.eip712Supported = true;
  }
  // V0.10.4 introduced the ability to send signing requests over multiple
  // data frames (i.e. in multiple requests)
  if (!legacy && gte(v, [0, 10, 4])) {
    c.extraDataFrameSz = 1500; // 1500 bytes per frame of extraData allowed
    c.extraDataMaxFrames = 1; // 1 frame of extraData allowed
  }

  return c;
}
const ASCII_REGEX = /^[\x00-\x7F]+$/;

export {
  ASCII_REGEX,
  getFwVersionConst,
  ADDR_STR_LEN,
  AES_IV,
  BIP_CONSTANTS,
  BASE_URL,
  ENC_MSG_LEN,
  addressSizes,
  decResLengths,
  deviceCodes,
  encReqCodes,
  ethMsgProtocol,
  messageConstants,
  responseCodes,
  responseMsgs,
  signingSchema,
  REQUEST_TYPE_BYTE,
  VERSION_BYTE,
  HARDENED_OFFSET,
  HANDLE_LARGER_CHAIN_ID,
  MAX_CHAIN_ID_BYTES,
  ETH_ABI_LATTICE_FW_TYPE_MAP,
};
