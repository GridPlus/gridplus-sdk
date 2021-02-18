// Consistent with Lattice's IV
const AES_IV = [0x6d, 0x79, 0x73, 0x65, 0x63, 0x72, 0x65, 0x74, 0x70, 0x61, 0x73, 0x73, 0x77, 0x6f, 0x72, 0x64]

const ADDR_STR_LEN = 129; // 128-char strings (null terminated)

// Decrypted response lengths will be fixed for any given message type.
// These are defined in the Lattice spec.
// Every decrypted response should have a 65-byte pubkey prefixing it (and a 4-byte request ID)
// These are NOT counted in `decResLengths`, meaning these values are 69-bytes smaller than the
// corresponding structs in firmware.
const decResLengths = {
    finalizePair: 0,                    // Only contains the pubkey
    getAddresses: 10 * ADDR_STR_LEN,    // 10x 129 byte strings (128 bytes + null terminator)
    sign: 1090,                         // 1 DER signature for ETH, 10 for BTC + change pubkeyhash
    getWallets: 142,                    // 71 bytes per wallet record (response contains internal and external)
    addAbiDefs: 8,
    test: 1646                          // Max size of test response payload
}

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
})
  
const deviceCodes = {
    'CONNECT': 1,
    'ENCRYPTED_REQUEST': 2,
}

const encReqCodes = {
    'FINALIZE_PAIRING': 0x00,
    'GET_ADDRESSES': 0x01,
    'ADD_PERMISSION': 0x02,
    'SIGN_TRANSACTION': 0x03,
    'GET_WALLETS': 0x04,
    'ADD_PERMISSION_V0': 0x05,
    'ADD_ABI_DEFS': 0x06,
    'TEST': 0x07,
}

const messageConstants = {
    'NOT_PAIRED': 0x00,
    'PAIRED': 0x01,
}

const addressSizes = {
    'BTC': 20,  // 20 byte pubkeyhash
    'ETH': 20,  // 20 byte address not including 0x prefix
}
  
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
    RESP_ERR_WALLET_NOT_PRESENT: 0x8a,
    RESP_ERR_DEV_LOCKED: 0x8b,
    RESP_ERR_DISABLED: 0x8c,
    RESP_ERR_ALREADY: 0x8d,
}

const responseMsgs = {
    [responseCodes.RESP_SUCCESS]: 0x00,
    [responseCodes.RESP_ERR_INVALID_MSG]: 'Invalid Request',
    [responseCodes.RESP_ERR_UNSUPPORTED_VER]: 'Unsupported Version',
    [responseCodes.RESP_ERR_DEV_BUSY]: 'Device Busy',
    [responseCodes.RESP_ERR_USER_TIMEOUT]: 'Timeout Waiting for User',
    [responseCodes.RESP_ERR_USER_DECLINED]: 'Request Declined by User',
    [responseCodes.RESP_ERR_PAIR_FAIL]: 'Pairing Failed',
    [responseCodes.RESP_ERR_PAIR_DISABLED]: 'Pairing is Currently Disabled',
    [responseCodes.RESP_ERR_PERMISSION_DISABLED]: 'Automated Signing is Currently Disabled',
    [responseCodes.RESP_ERR_INTERNAL]: 'Device Error',
    [responseCodes.RESP_ERR_GCE_TIMEOUT]: 'Timeout',
    [responseCodes.RESP_ERR_WALLET_NOT_PRESENT]: 'Incorrect Wallet UID Provided',
    [responseCodes.RESP_ERR_DEV_LOCKED]: 'Device Locked',
    [responseCodes.RESP_ERR_DISABLED]: 'Disabled',
    [responseCodes.RESP_ERR_ALREADY]: 'Record already exists. You must first remove it on your device.'
}
 

const signingSchema = {
    BTC_TRANSFER: 0,
    ETH_TRANSFER: 1,
    ERC20_TRANSFER: 2,
    ETH_MSG: 3,
}

const ethMsgProtocol = {
    SIGN_PERSONAL: 0,
}

const REQUEST_TYPE_BYTE = 0x02; // For all HSM-bound requests
const VERSION_BYTE = 1;
const HARDENED_OFFSET = 0x80000000; // Hardened offset
const HANDLE_LARGER_CHAIN_ID = 255; // ChainId value to signify larger chainID is in data buffer
const MAX_CHAIN_ID_BYTES = 8; // Max number of bytes to contain larger chainID in data buffer

const BASE_URL = 'https://signing.gridpl.us';

const ETH_ABI_LATTICE_FW_TYPE_MAP = {
    'address': 1,
    'bool': 2,
    'uint8': 3,
    'uint16': 4,
    'uint32': 5,
    'uint64': 6,
    'uint128': 7,
    'uint256': 8,
    // 'int8': 9,      // We do not support signed integer types in v1 because we can't display them
    // 'int16': 10,
    // 'int24': 11,
    // 'int64': 12,
    // 'int128': 13,
    // 'int256': 14,
    'uint': 15,
    // 'int': 16,
    'bytes1': 17,
    'bytes2': 18,
    'bytes3': 19,
    'bytes4': 20,
    'bytes5': 21,
    'bytes6': 22,
    'bytes7': 23,
    'bytes8': 24,
    'bytes9': 25,
    'bytes10': 26,
    'bytes11': 27,
    'bytes12': 28,
    'bytes13': 29,
    'bytes14': 30,
    'bytes15': 31,
    'bytes16': 32,
    'bytes17': 33,
    'bytes18': 34,
    'bytes19': 35,
    'bytes20': 36,
    'bytes21': 37,
    'bytes22': 38,
    'bytes23': 39,
    'bytes24': 40,
    'bytes25': 41,
    'bytes26': 42,
    'bytes27': 43,
    'bytes28': 44,
    'bytes29': 45,
    'bytes30': 46,
    'bytes31': 47,
    'bytes32': 48,
    'bytes': 49,
    'string': 50,
    'tuple1': 51,
    'tuple2': 52,
    'tuple3': 53,
    'tuple4': 54,
    'tuple5': 55,
    'tuple6': 56,
    'tuple7': 57,
    'tuple8': 58,
    'tuple9': 59,
    'tuple10': 60,
    'tuple11': 61,
    'tuple12': 62,
    'tuple13': 63,
    'tuple14': 64,
    'tuple15': 65,
    'tuple16': 66,
    'tuple17': 67,  // Firmware currently cannot support tuples larger than this
    // 'tuple18': 68,
    // 'tuple19': 69,
    // 'tuple20': 70,
};

function getFwVersionConst(v) {
    const c = {
        reqMaxDataSz: 1152,
    };
    if (v.length === 0 || (v[1] < 10 && v[2] === 0)) {
        c.ethMaxDataSz = c.reqMaxDataSz - 128;
        c.ethMaxMsgSz = c.ethMaxDataSz;
        c.ethMaxGasPrice = 500000000000; // 500 gwei
        c.addrFlagsAllowed = false;
    } else if (v[1] >= 10 && v[2] >= 0) {
        c.reqMaxDataSz = 1678;
        c.ethMaxDataSz = c.reqMaxDataSz - 128;
        c.ethMaxMsgSz = c.ethMaxDataSz;
        c.ethMaxGasPrice = 20000000000000; // 20000 gwei
        c.addrFlagsAllowed = true;
    }
    return c;
}

module.exports = {
    getFwVersionConst,
    ADDR_STR_LEN,
    AES_IV,
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
}