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
    'NEW_EPHEM_KEY': 1,
    'START_PAIRING_MODE': 2,
    'PAIR': 3,
}
  
const responseCodes = {
    '80': 'Device Busy',
    '81': 'Invalid Request',
    '82': 'Pairing Failure' 
}
 

const deviceResponses = {
    START_CODE_IDX: 1, // Beginning of 4-byte status code in Lattice response
    START_DATA_IDX: 5, // Beginning of data field for Lattice responses
}


const SUCCESS_RESPONSE_CODE = 0;
const VERSION_BYTE = 0;
const REQUEST_TYPE_BYTE = 0x02; // For all HSM-bound requests

module.exports = {
    dict,
    OPs,
    deviceCodes,
    responseCodes,
    deviceResponses,
    SUCCESS_RESPONSE_CODE,
    REQUEST_TYPE_BYTE,
    VERSION_BYTE,
}