export const dict = [ 
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 
    'L', 'M', 'N', 'P', 'Q'
];
  
export const OPs = {
    'a9': 'OP_HASH160',
    '76': 'OP_DUP',
    '87': 'OP_EQUAL',
    'ac': 'OP_CHECKSIG',
}
  
export const deviceCodes = {
    'ENCRYPTED_REQUEST': '00',
    'NEW_EPHEM_KEY': '01',
    'START_PAIRING_MODE': '02',
    'PAIR': '03',
}
  
export const responseCodes = {
    '80': 'Device Busy',
    '81': 'Invalid Request',
    '82': 'Pairing Failure' 
}
  
export const SUCCESS_RESPONSE_CODE = '00';
  
export const deviceResponses = {
    START_CODE_IDX: 1, // Beginning of 4-byte status code in Lattice response
    START_DATA_IDX: 5, // Beginning of data field for Lattice responses
}