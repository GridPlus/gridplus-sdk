/**
* Exports containing utils that allow inclusion of calldata
* decoder info in signing requests. If calldata decoder info
* is packed into the request, it is used to decode the calldata
* in the request. It is optional.
*/
import { parseSolidityJSONABI, parseCanonicalName } from './evm';

export const DECODERS = {
  EVM: {
    type: 1,
    parsers: {
      parseSolidityJSONABI,
      parseCanonicalName
    }
  }
}