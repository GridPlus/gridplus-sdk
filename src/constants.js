
// Consistent with Lattice's IV
const AES_IV = [0x6d, 0x79, 0x73, 0x65, 0x63, 0x72, 0x65, 0x74, 0x70, 0x61, 0x73, 0x73, 0x77, 0x6f, 0x72, 0x64]

// Per Lattice spec, all encrypted messages must fit in a 272 byte buffer
const ENC_MSG_LEN = 272;
  
const OPs = {
    'a9': 'OP_HASH160',
    '76': 'OP_DUP',
    '87': 'OP_EQUAL',
    'ac': 'OP_CHECKSIG',
}
  
const deviceCodes = {
    'CONNECT': 1,
    'ENCRYPTED_REQUEST': 2,
}

const encReqCodes = {
    'FINALIZE_PAIRING': 1,
    'GET_ADDRESSES': 2,
    'ADD_PERMISSION': 3,
    'SIGN_TRANSACTION': 4,
}

const messageConstants = {
    'NOT_PAIRED': 0x01,
    'PAIRED': 0x00,
}
  
const responseCodes = {
    'SUCCESS': 0x00,
    0x80: 'Invalid Request',
    0x81: 'Unsupported Version',
    0x82: 'Device Busy',
    0x83: 'Timeout Waiting for User',
    0x84: 'Request Declined by User',
    0x85: 'Pairing Failed',
    0x86: 'Pairing is Currently Disabled',
    0x87: 'Automated Signing is Currently Disabled',
    0x88: 'Device Error', 
}
 

const deviceResponses = {
    START_CODE_IDX: 1, // Beginning of 4-byte status code in Lattice response
    START_DATA_IDX: 5, // Beginning of data field for Lattice responses
}

const VERSION_BYTE = 1;
const REQUEST_TYPE_BYTE = 0x02; // For all HSM-bound requests

module.exports = {
    AES_IV,
    ENC_MSG_LEN,
    OPs,
    deviceCodes,
    encReqCodes,
    messageConstants,
    responseCodes,
    deviceResponses,
    REQUEST_TYPE_BYTE,
    VERSION_BYTE,
}