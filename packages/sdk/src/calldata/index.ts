/**
 * Exports containing utils that allow inclusion of calldata decoder info in signing requests. If
 * calldata decoder info is packed into the request, it is used to decode the calldata in the
 * request. It is optional.
 */
import {
  getNestedCalldata,
  parseCanonicalName,
  parseSolidityJSONABI,
  replaceNestedDefs,
} from './evm';
import {
  bytesToHex,
  decodeTransaction,
  extractMessageFromTransaction,
  fromBase58Bytes,
  hexToBytes,
  injectSignature,
  readCompactU16,
  toEd25519Bytes,
} from './solana';

export const CALLDATA = {
  EVM: {
    type: 1,
    parsers: {
      parseSolidityJSONABI,
      parseCanonicalName,
    },
    processors: {
      getNestedCalldata,
      replaceNestedDefs,
    },
  },
  SOLANA: {
    type: 2,
    parsers: {
      /** Decode a transaction from base64 encoding */
      decodeTransaction,
      /** Wrap pre-decoded base58 bytes */
      fromBase58Bytes,
      /** Read a compact-u16 value from buffer */
      readCompactU16,
    },
    processors: {
      /** Extract the message portion from a full transaction */
      extractMessageFromTransaction,
      /** Inject a signature into a transaction */
      injectSignature,
    },
    utils: {
      /** Convert Ed25519 public key to normalized bytes */
      toEd25519Bytes,
      /** Convert bytes to hex string */
      bytesToHex,
      /** Convert hex string to bytes */
      hexToBytes,
    },
  },
};
