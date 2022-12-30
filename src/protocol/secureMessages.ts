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
  Client
} from '../index'
import {
  ProtocolConstants as Constants,
  LatticeSecureMsgType,
  LatticeMsgType,
  LatticeProtocolVersion,
  LatticeResponseCode,
  LatticeSecureEncryptedRequestType,
} from './latticeConstants';
import {
  aes256_decrypt,
  aes256_encrypt,
  checksum,
  randomBytes,
} from '../util';
import {
  getEphemeralId,
  request,
} from '../shared/functions';
import {
  validateEphemeralPub,
} from '../shared/validators';

const { secure: szs } = Constants.msgSizes;

/**
 * Build and make a request to connect to a specific Lattice
 * based on its `deviceId`.
 * @param client - Instance of (unconnected) client
 * @param deviceId - Device ID for the target Lattice. Must be in
 *                   the same `client.baseUrl` domain to be found.
 * @return {Buffer} - Connection response payload data, which contains
 *                    information about the connected Lattice.
 */
export async function connectSecureRequest(
  client: Client,
  deviceId: string,
): Promise<Buffer> {
  // Build the secure request message
  const payloadData = serializeSecureRequestConnectPayloadData(client);
  const msgId = randomBytes(4);
  const msg = serializeSecureRequestMsg(
    client, 
    msgId, 
    LatticeSecureMsgType.connect, 
    payloadData
  );
  // Send request to the Lattice
  const url = `${client.baseUrl}/${deviceId}`;
  const resp = await request({ url, payload: msg });
  // Deserialize the response payload data
  return deserializeResponseMsgPayloadData(
    client, 
    msgId, 
    resp
  );
}

/**
 * Build an encrypted secure request using raw data,
 * then send that request to the target Lattice, handle
 * the response, and return the *decrypted* response
 * payload data.
 * Also updates ephemeral public key in the client.
 * This is a wrapper around several local util functions.
 * @param client - Instance of Client
 * @param data - Unencrypted raw calldata for function
 * @param requestType - Type of encrypted reques to make
 * @return {Buffer} Decrypted response data (excluding metadata)
 */
export async function encryptedSecureRequest(
  client: Client,
  data: Buffer,
  requestType: LatticeSecureEncryptedRequestType
): Promise<Buffer> {
  // Generate a random message id for internal tracking
  // of this specific request (internal on both sides).
  const msgId = randomBytes(4);
  // Serialize the request data into encrypted request
  // payload data.
  const payloadData = serializeSecureRequestEncryptedPayloadData(
    client,
    data,
    requestType
  );
  // Serialize the payload data into an encrypted secure
  // request message.
  const msg = serializeSecureRequestMsg(
    client,
    msgId,
    LatticeSecureMsgType.encrypted,
    payloadData
  );
  // Send request to Lattice
  const resp = await request({ 
    url: client.url, 
    payload: msg 
  });
  // Deserialize the response payload data
  const encRespPayloadData = deserializeResponseMsgPayloadData(
    client,
    msgId,
    resp
  );
  // Return decrypted response payload data
  return decryptEncryptedLatticeResponseData(
    client, 
    encRespPayloadData,
    requestType
  );
}

/**
 * @internal
 * Serialize a Secure Request message for the Lattice.
 * All outgoing SDK requests are of this form.
 * @param client - Instance of the Client
 * @param msgId - Random 4 bytes of data for internally tracking this message
 * @param secureRequestType - 0x01 for connect, 0x02 for encrypted
 * @param payloadData - Request data
 * @return {Buffer} Serialized message to be sent to Lattice
 */
function serializeSecureRequestMsg(
  client: Client,
  msgId: Buffer,
  secureRequestType: LatticeSecureMsgType,
  payloadData: Buffer,
): Buffer {
  // Sanity check request data
  if (msgId.length !== 4) {
    throw new Error('msgId must be four bytes');
  }
  const isValidRequestType = (
    secureRequestType === LatticeSecureMsgType.connect ||
    secureRequestType === LatticeSecureMsgType.encrypted
  );
  const isValidConnectPayloadDataSz = (
    payloadData.length === szs.connect.request.data  
  );
  const isValidEncryptedPayloadDataSz = (
    payloadData.length === szs.requestPayloadData  
  );
  const isValidPayloadDataSz = (
    isValidConnectPayloadDataSz || isValidEncryptedPayloadDataSz
  ); 
  if (!isValidRequestType) {
    throw new Error('Invalid Lattice secure request type');
  } else if (!isValidPayloadDataSz) {
    throw new Error('Invalid Lattice secure request payload size');
  }

  // Build payload
  let payload;
  const _payload = Buffer.alloc(szs.requestPayload);
  payload[0] = secureRequestType;
  payloadData.copy(payload, 1);

  // Encrypt if needed
  if (isValidEncryptedPayloadDataSz) {
    payload = aes256_encrypt(_payload, client.sharedSecret);
  } else {
    payload = _payload;
  }

  // Construct the request in object form
  const header: LatticeMessageHeader = {
    version: LatticeProtocolVersion.v1,
    type: LatticeMsgType.secure,
    id: msgId,
    len: payload.length,
  };
  const req: LatticeSecureRequest = {
    header,
    payload,
  };

  // Now serialize the whole message
  const msg = Buffer.alloc(szs.requestMsg);
  let off = 0;
  // Header
  msg.writeUInt8(req.header.version, off);
  off += 1;
  msg.writeUInt8(req.header.type, off);
  off += 1;
  req.header.id.copy(msg, off);
  off += req.header.id.length;
  msg.writeUInt16LE(req.header.len, off);
  off += 2;
  // Payload
  msg.writeUInt8(req.payload.requestType, off);
  off += 1;
  req.payload.data.copy(msg, off);
  off += req.payload.data.length;

  // We have our serialized secure message!
  return msg;
}

/**
 * @internal
 * Deserialize a Lattice response and get the payload data
 * @param client - Instance of Client
 * @param msgId - 4 byte ID from the request; should match response
 * @param msg - Buffer received from the Lattice
 * @return {Buffer} 1696 bytes of payload data (may be encrypted)
 */
function deserializeResponseMsgPayloadData(
  client: Client,
  msgId: Buffer,
  msg: Buffer,
): Buffer {
  // Sanity check on total message size
  if (msg.length !== szs.responseMsg) {
    throw new Error('Wrong Lattice response message size');
  }

  // Deserialize the message
  const checksumOffset = 9 + szs.responsePayloadData;
  const respHeader: LatticeMessageHeader = {
    version: msg.readUInt8(0),
    type: msg.readUInt8(1),
    id: msg.slice(2, 6),
    len: msg.readUInt16LE(6),
  };
  const resp: LatticeSecureResponse = {
    header: respHeader,
    payload: {
      responseCode: msg.readUInt8(8),
      data: msg.slice(9, checksumOffset),
    }
  }

  // Validate message
  if (resp.header.version !== LatticeProtocolVersion.v1) {
    throw new Error('Wrong protocol version in Lattice response');
  }
  if (resp.header.type !== LatticeMsgType.response) {
    throw new Error('Wrong message code in Lattice response')
  }
  if (!resp.header.id.equals(msgId)) {
    throw new Error('Mismatch in Lattice response message id - need resync');
  }
  if (resp.header.len > 1 + resp.payload.data.length) {
    throw new Error('Wrong payload length returned from Lattice');
  }
  // Throw an error if response is not successful
  if (resp.payload.responseCode !== LatticeResponseCode.success) {
    throw new Error(
      `Error from Lattice: ${Constants.responseMsg[resp.payload.responseCode]}`
    );
  }

  // Return response payload
  // Due to a bug we only consume the first half of the response payload data.
  // See msgSizes definition for more info.
  return resp.payload.data.slice(0, szs.responsePayloadDataUsed);
}

/**
 * @internal
 * Serialize payload data for a Lattice secure request: connect
 * @param client - Instance of Client
 * @return {Buffer} - 1700 bytes, of which only 65 are used
 */
function serializeSecureRequestConnectPayloadData(
  client: Client
): Buffer {
  const payloadData: LatticeSecureConnectRequestPayloadData = {
    pubkey: client.publicKey,
  };
  const serPayloadData = Buffer.alloc(szs.requestPayloadData);
  payloadData.pubkey.copy(serPayloadData, 0);
  return serPayloadData;
}

/**
 * @internal
 * Serialize payload data for Lattice secure request: encrypted
 * @param client - Instance of Client
 * @param data - Raw (unencrypted) request data
 * @return {Buffer} - 1701 bytes, all of which should be used
 */
function serializeSecureRequestEncryptedPayloadData(
  client: Client,
  data: Buffer,
  requestType: LatticeSecureEncryptedRequestType
): Buffer {
  // Sanity checks request size
  // NOTE: The -1 accounts for the 1 byte request type
  if (data.length > szs.requestPayloadData - 1) {
    throw new Error('Encrypted request data too large');
  }
  // Make sure we have a shared secret. An error will be thrown
  // if there is no ephemeral pub, indicating we need to reconnect.
  validateEphemeralPub(client.ephemeralPub);
  
  // Validate the request data size matches the desired request
  const validSz = szs.encrypted.request.data[requestType];
  if (data.length !== validSz) {
    throw new Error(
      `Invalid request datasize (wanted ${validSz}, got ${data.length})`
    );
  }

  // Encrypt the data into a fixed size buffer
  const rawData = Buffer.alloc(szs.requestPayloadData);
  rawData[0] = requestType;
  data.copy(rawData, 1);
  const rawDataChecksum = checksum(rawData);
  rawData.writeUInt32LE(rawDataChecksum, data.length + 1);
  const encryptedData = aes256_encrypt(rawData, client.sharedSecret);

  // Calculate ephemeral ID
  const ephemeralId = getEphemeralId(client.sharedSecret);

  // Form the object
  const payloadData: LatticeSecureEncryptedRequestPayloadData = {
    ephemeralId,
    encryptedData,
  };

  // Now we will serialize the payload data.
  const serPayloadData = Buffer.alloc(szs.requestPayloadData);
  serPayloadData.writeUInt32LE(payloadData.ephemeralId);
  encryptedData.copy(serPayloadData, 4);
  return serPayloadData;
}

/**
 * @internal
 * Decrypt the response data from an encrypted request.
 * This will update the client's ephemeral public key.
 * @param client - Instance of Client
 * @param encPayloadData - Encrypted payload data in response
 * @return {Buffer} Decrypted response data (excluding metadata)
 */
function decryptEncryptedLatticeResponseData(
  client: Client,
  encPayloadData: Buffer,
  requestType: LatticeSecureEncryptedRequestType
): Buffer {
  // Decrypt data using the *current* shared secret
  const decData = aes256_decrypt(encPayloadData, client.sharedSecret);
  // Bulid the object
  const checksumOffset = decData.length - 4;
  const respData: LatticeSecureDecryptedResponse = {
    ephemeralPub: decData.slice(0, 65),
    data: decData.slice(65, checksumOffset),
    checksum: decData.readUInt32LE(checksumOffset)
  };
  // Validate the checksum
  const validChecksum = checksum(decData.slice(0, checksumOffset));
  if (respData.checksum !== validChecksum) {
    throw new Error('Checksum mismatch in decrypted Lattice data');
  }
  // Validate the response data size
  const validSz = szs.encrypted.response.data[requestType];
  if (respData.data.length !== validSz) {
    throw new Error('Incorrect response data returned from Lattice');
  }
  // Update client's ephemeral key
  client.ephemeralPub = respData.ephemeralPub;
  // Returned the decrypted data
  return respData.data;
}
