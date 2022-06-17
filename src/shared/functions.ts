import { sha256 } from 'hash.js/lib/hash/sha';
import superagent from 'superagent';
import bitcoin from '../bitcoin';
import {
  deviceCodes,
  encReqCodes,
  ENC_MSG_LEN,
  EXTERNAL,
  REQUEST_TYPE_BYTE,
  VERSION_BYTE,
} from '../constants';
import ethereum from '../ethereum';
import { buildGenericSigningMsgRequest } from '../genericSigning';
import {
  aes256_decrypt,
  aes256_encrypt,
  checksum,
  getP256KeyPairFromPub,
  parseLattice1Response,
  randomBytes,
} from '../util';
import { shouldUseEVMLegacyConverter } from './predicates';
import {
  validateChecksum,
  validateRequestError,
  validateResponse,
} from './validators';


/**
 * Build a request to send to the device.
 * @internal
 * @param request_code {uint8} - 8-bit unsigned integer representing the message request code
 * @param id {buffer} - 4 byte identifier (comes from HSM for subsequent encrypted reqs)
 * @param payload {buffer} - serialized payload
 * @returns {buffer}
 */
export const buildRequest = (request_code: number, payload: Buffer) => {
  // Length of payload; we add 1 to the payload length to account for the request_code byte
  let L = payload && Buffer.isBuffer(payload) ? payload.length + 1 : 1;
  if (request_code === deviceCodes.ENCRYPTED_REQUEST) {
    L = 1 + payload.length;
  }
  let i = 0;
  const preReq = Buffer.alloc(L + 8);
  // Build the header
  i = preReq.writeUInt8(VERSION_BYTE, i);
  i = preReq.writeUInt8(REQUEST_TYPE_BYTE, i);
  const id = randomBytes(4);
  i = preReq.writeUInt32BE(parseInt(`0x${id.toString('hex')}`), i);
  i = preReq.writeUInt16BE(L, i);
  // Build the payload
  i = preReq.writeUInt8(request_code, i);
  if (L > 1) i = payload.copy(preReq, i);
  // Add the checksum
  const cs = checksum(preReq);
  const req = Buffer.alloc(preReq.length + 4); // 4-byte checksum
  i = preReq.copy(req);
  req.writeUInt32BE(cs, i);
  return req;
};

/**
 * Builds an encrypted request
 * @internal
 */
export const encryptRequest = ({
  payload,
  requestCode,
  sharedSecret,
}: EncryptRequestParams) => {
  // Get the ephemeral id - all encrypted requests require there to be an ephemeral public key in
  // order to send
  const ephemeralId = getEphemeralId(sharedSecret);
  const requestCodeValue = encReqCodes[requestCode];
  // Build the payload and checksum
  const payloadPreCs = Buffer.concat([
    Buffer.from([requestCodeValue]),
    payload,
  ]);
  const cs = checksum(payloadPreCs);
  const payloadBuf = Buffer.alloc(payloadPreCs.length + 4);

  // Lattice validates checksums in little endian
  payloadPreCs.copy(payloadBuf, 0);
  payloadBuf.writeUInt32LE(cs, payloadPreCs.length);
  // Encrypt this payload
  const newEncPayload = aes256_encrypt(payloadBuf, sharedSecret);

  // Write to the overall payload. We must use the same length for every encrypted request and
  // must include a 32-bit ephemId along with the encrypted data
  const newPayload = Buffer.alloc(ENC_MSG_LEN + 4);
  // First 4 bytes are the ephemeral id (in little endian)
  newPayload.writeUInt32LE(ephemeralId, 0);
  // Next N bytes
  newEncPayload.copy(newPayload, 4);
  return buildRequest(deviceCodes.ENCRYPTED_REQUEST, newPayload);
};

export const buildTransaction = ({
  data,
  currency,
  fwConstants,
}: {
  data: any;
  currency?: Currency;
  fwConstants: FirmwareConstants;
}) => {
  // All transaction requests must be put into the same sized buffer. This comes from
  // sizeof(GpTransactionRequest_t), but note we remove the 2-byte schemaId since it is not
  // returned from our resolver. Note that different firmware versions may have different data
  // sizes.

  // TEMPORARY BRIDGE -- DEPRECATE ME In v0.15.0 Lattice firmware removed the legacy ETH
  // signing path, so we need to convert such requests to general signing requests using the
  // EVM decoder. NOTE: Not every request can be converted, so users should switch to using
  // general signing requests for newer firmware versions. EIP1559 and EIP155 legacy
  // requests will convert, but others may not.
  if (currency === 'ETH' && shouldUseEVMLegacyConverter(fwConstants)) {
    console.log('Using the legacy ETH signing path. This will soon be deprecated. ' +
      'Please switch to general signing request.',
    );
    let payload;
    try {
      payload = ethereum.ethConvertLegacyToGenericReq(data);
    } catch (err) {
      throw new Error(
        'Could not convert legacy request. Please switch to a general signing ' +
        'request. See gridplus-sdk docs for more information.',
      );
    }
    data = {
      fwConstants,
      encodingType: EXTERNAL.SIGNING.ENCODINGS.EVM,
      curveType: EXTERNAL.SIGNING.CURVES.SECP256K1,
      hashType: EXTERNAL.SIGNING.HASHES.KECCAK256,
      signerPath: data.signerPath,
      payload,
    };
    return { request: buildGenericSigningMsgRequest({ ...data, fwConstants }), isGeneric: true }
  } else if (currency === 'ETH') {
    // Legacy signing pathway -- should deprecate in the future
    return { request: ethereum.buildEthereumTxRequest({ ...data, fwConstants }), isGeneric: false }
  } else if (currency === 'ETH_MSG') {
    return { request: ethereum.buildEthereumMsgRequest({ ...data, fwConstants }), isGeneric: false }
  } else if (currency === 'BTC') {
    return { request: bitcoin.buildBitcoinTxRequest({ ...data, fwConstants }), isGeneric: false }
  }
  return { request: buildGenericSigningMsgRequest({ ...data, fwConstants }), isGeneric: true }
};

const defaultTimeout = {
  //TODO Test
  response: 50000, // Wait 5 seconds for the server to respond
  deadline: 600000, // but allow 1 minute for the user to accept
};

interface LatticeRequest extends superagent.Response {
  body: {
    status: number;
    message: string;
  };
}

export const request = async ({
  url,
  payload,
  timeout = defaultTimeout,
  retries = 3,
}: RequestParams) => {
  const res: LatticeRequest | void = await superagent
    .post(url)
    .timeout(timeout)
    .retry(retries)
    .send({ data: payload })
    .catch((err: LatticeError) => {
      validateRequestError(err);
    });

  // Handle formatting or generic HTTP errors
  if (!res || !res.body) {
    throw new Error(`Invalid response:  ${res}`);
  } else if (res.body.status !== 200) {
    throw new Error(`Error code ${res.body.status}: ${res.body.message}`);
  }

  const { responseCode, err, data } = parseLattice1Response(res.body.message);

  if (err) {

    //TODO: Handle response codes
    throw new Error(
      // `Request Failed\nResponse Code: ${responseCode}\nError Message: ${err}`,
      `${err}`,
    );
  }

  return data;
};

/**
 * All encrypted responses must be decrypted with the previous shared secret. Per specification,
 * decrypted responses will all contain a 65-byte public key as the prefix, which becomes the new
 * `ephemeralPub`.
 * @category Device Response
 * @internal
 */
export const decryptResponse = (
  encryptedResponse: Buffer, //TODO: add type for responses
  length: number,
  sharedSecret: Buffer,
): { decryptedData: Buffer, newEphemeralPub: Buffer } => {
  // Decrypt response
  const encData = encryptedResponse.slice(0, ENC_MSG_LEN);
  const decryptedData = aes256_decrypt(encData, sharedSecret);

  validateResponse(decryptedData);

  // length does not include a 65-byte pubkey that prefixes each response
  length += 65;

  validateChecksum(decryptedData, length);

  // First 65 bytes is the next ephemeral pubkey
  const pub = decryptedData.slice(0, 65).toString('hex');
  const newEphemeralPub = getP256KeyPairFromPub(pub);
  return { decryptedData, newEphemeralPub };
};

/**
 * Get the ephemeral id, which is the first 4 bytes of the shared secret generated from the local
 * private key and the ephemeral public key from the device.
 * @internal
 * @returns Buffer
 */
export const getEphemeralId = (sharedSecret: Buffer) => {
  // EphemId is the first 4 bytes of the hash of the shared secret
  const hash = Buffer.from(sha256().update(sharedSecret).digest('hex'), 'hex');
  return parseInt(hash.slice(0, 4).toString('hex'), 16);
};
