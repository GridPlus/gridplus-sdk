/**
 * All messages sent to the Lattice from this SDK will be
 * "secure messages", of which there are two types:
 *
 * 1. Connect requests are *unencrypted* and serve to establish
 *    a connection between the SDK Client instance and the target
 *    Lattice. If the client is already paired to the target Lattice,
 *    the response will indicate that. If the client has never paired
 *    with this Lattice, the Lattice will go into "pairing mode" and
 *    will expect a follow up `finalizePairing` request, which is
 *    an encrypted request. This will return an ephemeral public key,
 *    which is used to encrypt the next request.
 * 2. Encrypted requests are *encrypted* (obviously) and from a Lattice
 *    protocol perspective they are all constructed the same way:
 *    create a buffer of `payload` length and fill it with unencrypted
 *    data, then encrypt the entire payload (not just the data you filled)
 *    with the ECDH secret formed from the last ephemeral public key.
 *    The response to this request will contain a new ephemral public
 *    key, which you will need for the next encrypted request.
 */
import {
  ProtocolConstants as Constants,
  LatticeSecureMsgType,
  LatticeMsgType,
  LatticeProtocolVersion,
  LatticeSecureEncryptedRequestType,
} from './latticeConstants';
import {
  aes256_decrypt,
  aes256_encrypt,
  checksum,
  getP256KeyPairFromPub,
  randomBytes,
} from '../util';
import { getEphemeralId, request } from '../shared/functions';
import { validateEphemeralPub } from '../shared/validators';

const { msgSizes } = Constants;
const { secure: szs } = msgSizes;

/**
 * Build and make a request to connect to a specific Lattice
 * based on its `deviceId`.
 * @param deviceId - Device ID for the target Lattice. Must be in
 *                   the same `client.baseUrl` domain to be found.
 * @return {Buffer} - Connection response payload data, which contains
 *                    information about the connected Lattice.
 */
export async function connectSecureRequest({
  url,
  pubkey,
}: {
  url: string;
  pubkey: Buffer;
}): Promise<Buffer> {
  // Build the secure request message
  const payloadData = serializeSecureRequestConnectPayloadData({
    pubkey: pubkey,
  });
  const msgId = randomBytes(4);
  const msg = serializeSecureRequestMsg(
    msgId,
    LatticeSecureMsgType.connect,
    payloadData,
  );
  // Send request to the Lattice
  const resp = await request({ url, payload: msg });
  if (resp.length !== szs.payload.response.connect - 1) {
    throw new Error('Wrong Lattice response message size.');
  }

  return resp;
}

/**
 * Build an encrypted secure request using raw data,
 * then send that request to the target Lattice, handle
 * the response, and return the *decrypted* response
 * payload data.
 * Also updates ephemeral public key in the client.
 * This is a wrapper around several local util functions.
 * @param data - Unencrypted raw calldata for function
 * @param requestType - Type of encrypted reques to make
 * @return {Buffer} Decrypted response data (excluding metadata)
 */
export async function encryptedSecureRequest({
  data,
  requestType,
  sharedSecret,
  ephemeralPub,
  url,
}: {
  data: Buffer;
  requestType: LatticeSecureEncryptedRequestType;
  sharedSecret: Buffer;
  ephemeralPub: Buffer;
  url: string;
}): Promise<DecryptedResponse> {
  // Generate a random message id for internal tracking
  // of this specific request (internal on both sides).
  const msgId = randomBytes(4);

  // Serialize the request data into encrypted request
  // payload data.
  const payloadData = serializeSecureRequestEncryptedPayloadData({
    data,
    requestType,
    ephemeralPub,
    sharedSecret,
  });

  // Serialize the payload data into an encrypted secure
  // request message.
  const msg = serializeSecureRequestMsg(
    msgId,
    LatticeSecureMsgType.encrypted,
    payloadData,
  );

  // Send request to Lattice
  const resp = await request({
    url,
    payload: msg,
  });

  // Deserialize the response payload data
  if (resp.length !== szs.payload.response.encrypted - 1) {
    throw new Error('Wrong Lattice response message size.');
  }

  const encPayloadData = resp.slice(
    0,
    szs.data.response.encrypted.encryptedData,
  );

  // Return decrypted response payload data
  return decryptEncryptedLatticeResponseData({
    encPayloadData,
    requestType,
    sharedSecret,
  });
}

/**
 * @internal
 * Serialize a Secure Request message for the Lattice.
 * All outgoing SDK requests are of this form.
 * @param msgId - Random 4 bytes of data for internally tracking this message
 * @param secureRequestType - 0x01 for connect, 0x02 for encrypted
 * @param payloadData - Request data
 * @return {Buffer} Serialized message to be sent to Lattice
 */
function serializeSecureRequestMsg(
  msgId: Buffer,
  secureRequestType: LatticeSecureMsgType,
  payloadData: Buffer,
): Buffer {
  // Sanity check request data
  if (msgId.length !== 4) {
    throw new Error('msgId must be four bytes');
  }
  if (
    secureRequestType !== LatticeSecureMsgType.connect &&
    secureRequestType !== LatticeSecureMsgType.encrypted
  ) {
    throw new Error('Invalid Lattice secure request type');
  }

  // Validate the incoming payload data size. Note that the payload
  // data is prepended with a secure request type byte, so the
  // payload data size is one less than the expected size.
  const isValidConnectPayloadDataSz =
    secureRequestType === LatticeSecureMsgType.connect &&
    payloadData.length === szs.payload.request.connect - 1;
  const isValidEncryptedPayloadDataSz =
    secureRequestType === LatticeSecureMsgType.encrypted &&
    payloadData.length === szs.payload.request.encrypted - 1;

  // Build payload and size
  let msgSz = msgSizes.header + msgSizes.checksum;
  let payloadLen;
  const payload: LatticeSecureRequestPayload = {
    requestType: secureRequestType,
    data: payloadData,
  };
  if (isValidConnectPayloadDataSz) {
    payloadLen = szs.payload.request.connect;
  } else if (isValidEncryptedPayloadDataSz) {
    payloadLen = szs.payload.request.encrypted;
  } else {
    throw new Error('Invalid Lattice secure request payload size');
  }
  msgSz += payloadLen;

  // Construct the request in object form
  const header: LatticeMessageHeader = {
    version: LatticeProtocolVersion.v1,
    type: LatticeMsgType.secure,
    id: msgId,
    len: payloadLen,
  };
  const req: LatticeSecureRequest = {
    header,
    payload,
  };

  // Now serialize the whole message
  // Header | requestType | payloadData | checksum
  const msg = Buffer.alloc(msgSz);
  let off = 0;
  // Header
  msg.writeUInt8(req.header.version, off);
  off += 1;
  msg.writeUInt8(req.header.type, off);
  off += 1;
  req.header.id.copy(msg, off);
  off += req.header.id.length;
  msg.writeUInt16BE(req.header.len, off);
  off += 2;
  // Payload
  msg.writeUInt8(req.payload.requestType, off);
  off += 1;
  req.payload.data.copy(msg, off);
  off += req.payload.data.length;
  // Checksum
  msg.writeUInt32BE(checksum(msg.slice(0, off)), off);
  off += 4;
  if (off !== msgSz) {
    throw new Error('Failed to build request message');
  }

  // We have our serialized secure message!
  return msg;
}

/**
 * @internal
 * Serialize payload data for a Lattice secure request: connect
 * @return {Buffer} - 1700 bytes, of which only 65 are used
 */
function serializeSecureRequestConnectPayloadData(
  payloadData: LatticeSecureConnectRequestPayloadData,
): Buffer {
  const serPayloadData = Buffer.alloc(szs.data.request.connect);
  payloadData.pubkey.copy(serPayloadData, 0);
  return serPayloadData;
}

/**
 * @internal
 * Serialize payload data for Lattice secure request: encrypted
 * @param data - Raw (unencrypted) request data
 * @return {Buffer} - 1700 bytes, all of which should be used
 */
function serializeSecureRequestEncryptedPayloadData({
  data,
  requestType,
  ephemeralPub,
  sharedSecret,
}: {
  data: Buffer;
  requestType: LatticeSecureEncryptedRequestType;
  ephemeralPub: Buffer;
  sharedSecret: Buffer;
}): Buffer {
  // Sanity checks request size
  if (data.length > szs.data.request.encrypted.encryptedData) {
    throw new Error('Encrypted request data too large');
  }
  // Make sure we have a shared secret. An error will be thrown
  // if there is no ephemeral pub, indicating we need to reconnect.
  validateEphemeralPub(ephemeralPub);

  // Validate the request data size matches the desired request
  const requestDataSize = szs.data.request.encrypted[requestType];
  if (data.length !== requestDataSize) {
    throw new Error(
      `Invalid request datasize (wanted ${requestDataSize}, got ${data.length})`,
    );
  }

  // Build the pre-encrypted data payload, which variable sized and of form:
  // encryptedRequestType | data | checksum
  const preEncryptedData = Buffer.alloc(1 + requestDataSize);
  preEncryptedData[0] = requestType;
  data.copy(preEncryptedData, 1);
  const preEncryptedDataChecksum = checksum(preEncryptedData);

  // Encrypt the data into a fixed size buffer. The buffer size should
  // equal to the full message request less the 4-byte ephemeral id.
  const _encryptedData = Buffer.alloc(szs.data.request.encrypted.encryptedData);
  preEncryptedData.copy(_encryptedData, 0);
  _encryptedData.writeUInt32LE(
    preEncryptedDataChecksum,
    preEncryptedData.length,
  );
  const encryptedData = aes256_encrypt(_encryptedData, sharedSecret);

  // Calculate ephemeral ID
  const ephemeralId = getEphemeralId(sharedSecret);

  // Now we will serialize the payload data.
  const serPayloadData = Buffer.alloc(szs.payload.request.encrypted - 1);
  serPayloadData.writeUInt32LE(ephemeralId);
  encryptedData.copy(serPayloadData, 4);
  return serPayloadData;
}

/**
 * @internal
 * Decrypt the response data from an encrypted request.
 * @param encPayloadData - Encrypted payload data in response
 * @return {Buffer} Decrypted response data (excluding metadata)
 */
function decryptEncryptedLatticeResponseData({
  encPayloadData,
  requestType,
  sharedSecret,
}: {
  encPayloadData: Buffer;
  requestType: LatticeSecureEncryptedRequestType;
  sharedSecret: Buffer;
}) {
  // Decrypt data using the *current* shared secret
  const decData = aes256_decrypt(encPayloadData, sharedSecret);

  // Bulid the object
  const ephemeralPubSz = 65; // secp256r1 pubkey
  const checksumOffset =
    ephemeralPubSz + szs.data.response.encrypted[requestType];
  const respData: LatticeSecureDecryptedResponse = {
    ephemeralPub: decData.slice(0, ephemeralPubSz),
    data: decData.slice(ephemeralPubSz, checksumOffset),
    checksum: decData.readUInt32BE(checksumOffset),
  };

  // Validate the checksum
  const validChecksum = checksum(decData.slice(0, checksumOffset));
  if (respData.checksum !== validChecksum) {
    throw new Error('Checksum mismatch in decrypted Lattice data');
  }

  // Validate the response data size
  const validSz = szs.data.response.encrypted[requestType];
  if (respData.data.length !== validSz) {
    throw new Error('Incorrect response data returned from Lattice');
  }

  const newEphemeralPub = getP256KeyPairFromPub(respData.ephemeralPub);

  // Returned the decrypted data
  return { decryptedData: respData.data, newEphemeralPub };
}
