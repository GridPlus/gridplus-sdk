const dict = [ 
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 
    'L', 'M', 'N', 'P', 'Q'
];
  
const OPs = {
    'a9': 'OP_HASH160',
    '76': 'OP_DUP',
    '87': 'OP_EQUAL',
    'ac': 'OP_CHECKSIG',
}
  
const deviceCodes = {
    'ENCRYPTED_REQUEST': 0,
    'CONNECT': 1,
    'FINALIZE_PAIRING': 2,
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
    dict,
    OPs,
    deviceCodes,
    responseCodes,
    deviceResponses,
    REQUEST_TYPE_BYTE,
    VERSION_BYTE,
}