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
  LATTICE_CONSTANTS as Constants,
  LatticeSecureMsgType,
  LatticeMsgType,
  LatticeProtocolVersion,
  LatticeResponseCode,
} from './latticeConstants';
import {
  aes256_encrypt,
  checksum,
  randomBytes,
} from '../util';
import {
  getEphemeralId,
} from '../shared/functions';
import {
  validateEphemeralPub,
} from '../shared/validators';

const { secure: msgSizes } = Constants.msgSizes;

/**
 * Serialize a Secure Request message for the Lattice.
 * All outgoing SDK requests are of this form.
 * @param client - Instance of the Client
 * @param secureRequestType - 0x01 for connect, 0x02 for encrypted
 * @param payloadData - Request data
 * @return {Buffer} Serialized message to be sent to Lattice
 */
export function serializeLatticeSecureRequestMsg(
  client: Client,
  secureRequestType: LatticeSecureMsgType,
  payloadData: Buffer,
): Buffer {
  // Sanity check request data
  const isValidRequestType = (
    secureRequestType === LatticeSecureMsgType.connect ||
    secureRequestType === LatticeSecureMsgType.encrypted
  );
  const isValidConnectMsgSz = (
    payloadData.length === msgSizes.connect.request.payloadData  
  );
  const isValidEncryptedMsgSz = (
    payloadData.length === msgSizes.encrypted.request.payloadData  
  );
  if (!isValidRequestType) {
    throw new Error('Invalid Lattice secure request type');
  } else if (!isValidConnectMsgSz && !isValidEncryptedMsgSz) {
    throw new Error('Invalid Lattice secure request payload size');
  }

  // Build payload
  let payload;
  const _payload = Buffer.alloc(msgSizes.requestPayload);
  payload[0] = secureRequestType;
  payloadData.copy(payload, 1);

  // Encrypt if needed
  if (isValidEncryptedMsgSz) {
    payload = aes256_encrypt(_payload, client.sharedSecret);
  } else {
    payload = _payload;
  }

  // Construct the object first
  const req: LatticeSecureRequest = {
    protocolVersion: LatticeProtocolVersion.v1,
    msgType: LatticeMsgType.secure,
    msgId: randomBytes(4),
    payloadLen: payload.length,
    payload,
    checksum: checksum(payload),
  };

  // Now serialize the whole message
  const msg = Buffer.alloc(msgSizes.requestMsg);
  let off = 0;
  // Header
  msg.writeUInt8(req.protocolVersion, off);
  off += 1;
  msg.writeUInt8(req.msgType, off);
  off += 1;
  req.msgId.copy(msg, off);
  off += req.msgId.length;
  msg.writeUInt16LE(req.payloadLen, off);
  off += 2;
  // Payload
  msg.writeUInt8(req.payload.requestType, off);
  off += 1;
  req.payload.data.copy(msg, off);
  off += req.payload.data.length;
  // Footer
  msg.writeUInt32LE(req.checksum, off);
  off += 4;

  // We have our serialized secure message!
  return msg;
}

/**
 * Deserialize a Lattice response and get the payload data
 * @param client - Instance of Client
 * @param msgId - 4 byte ID from the request; should match response
 * @param msg - Buffer received from the Lattice
 * @return {Buffer} 1696 bytes of payload data (may be encrypted)
 */
export function deserializeLatticeResponseMsgPayloadData(
  client: Client,
  msgId: Buffer,
  msg: Buffer,
): Buffer {
  // Sanity check on total message size
  if (msg.length !== msgSizes.responseMsg) {
    throw new Error('Wrong Lattice response message size');
  }

  // Deserialize the message
  const checksumOffset = 9 + msgSizes.responsePayloadData;
  const resp: LatticeSecureResponse = {
    protocolVersion: msg.readUInt8(0),
    msgType: msg.readUInt8(1),
    msgId: msg.slice(2, 6),
    payloadLen: msg.readUInt16LE(6),
    payload: {
      responseCode: msg.readUInt8(8),
      data: msg.slice(9, checksumOffset),
    },
    checksum: msg.readUInt32LE(checksumOffset)
  }

  // Validate message
  if (resp.protocolVersion !== LatticeProtocolVersion.v1) {
    throw new Error('Wrong protocol version in Lattice response');
  }
  if (resp.msgType !== LatticeMsgType.response) {
    throw new Error('Wrong message code in Lattice response')
  }
  if (!resp.msgId.equals(msgId)) {
    throw new Error('Mismatch in Lattice response message id - need resync');
  }
  if (resp.payloadLen > 1 + resp.payload.data.length) {
    throw new Error('Wrong payload length returned from Lattice');
  }
  if (
    resp.checksum !== checksum(msg.slice(0, checksumOffset))
  ) {
    throw new Error('Checksum mismatch in Lattice response');
  }
  // Throw an error if response is not successful
  if (resp.payload.responseCode !== LatticeResponseCode.success) {
    throw new Error(
      `Error from Lattice: ${Constants.responses.messages[resp.payload.responseCode]}`
    );
  }

  // Return response payload
  // Due to a bug we only consume the first half of the response payload data.
  // See msgSizes definition for more info.
  return resp.payload.data.slice(0, msgSizes.responsePayloadDataUsed);
}

/**
 * Serialize payload data for a Lattice secure request: connect
 * @param client - Instance of Client
 * @return {Buffer} - 1701 bytes, of which only 65 are used
 */
export function serializeLatticeSecureRequestConnectPayloadData(
  client: Client
): Buffer {
  const payloadData: LatticeSecureConnectRequestPayloadData = {
    pubkey: client.publicKey,
  };
  const serPayloadData = Buffer.alloc(msgSizes.requestPayload);
  payloadData.pubkey.copy(serPayloadData, 0);
  return serPayloadData;
}

/**
 * Serialize payload data for Lattice secure request: encrypted
 * @param client - Instance of Client
 * @param data - Raw (unencrypted) request data
 * @return {Buffer} - 1701 bytes, all of which should be used
 */
export function serializeLatticeSecureRequestEncryptedPayloadData(
  client: Client,
  data: Buffer,
): Buffer {
  // Sanity checks request size
  if (data.length > msgSizes.requestPayloadData) {
    throw new Error('Encrypted request data too large');
  }
  // Make sure we have a shared secret. An error will be thrown
  // if there is no ephemeral pub, indicating we need to reconnect.
  validateEphemeralPub(client.ephemeralPub);

  // Encrypt the data into a fixed size buffer
  const rawData = Buffer.alloc(msgSizes.requestPayloadData);
  data.copy(rawData);
  const encryptedData = aes256_encrypt(rawData, client.sharedSecret);

  // Calculate ephemeral ID
  const ephemeralId = getEphemeralId(client.sharedSecret);

  // Form the object
  const payloadData: LatticeSecureEncryptedRequestPayloadData = {
    ephemeralId,
    encryptedData,
  };

  // Now we will serialize the payload data.
  const serPayloadData = Buffer.alloc(msgSizes.requestPayload);
  serPayloadData.writeUInt32LE(payloadData.ephemeralId);
  encryptedData.copy(serPayloadData, 4);
  return serPayloadData;
}
