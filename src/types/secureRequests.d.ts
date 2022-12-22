interface LatticeSecureRequest {
  // Protocol version. Should always be 0x01
  // [uint8]
  protocolVersion: LatticeProtocolVersion;
  // Protocol request type. Should always be 0x02
  // for "secure" message type.
  // [uint8]
  msgType: LatticeMsgType;
  // Random message ID for internal tracking in firmware
  // [4 bytes]
  msgId: Buffer;
  // Length of payload data being used
  // For an encrypted request, this indicates the
  // size of the non-zero decrypted data.
  // [uint16]
  payloadLen: number;
  // Request data
  // [1701 bytes]
  payload: LatticeSecureRequestPayload;
  // Checksum over the full 1701 payload bytes
  // [uint32]
  checksum: number;
}

interface LatticeSecureRequestPayload {
  // Indicates whether this is a connect (0x01) or
  // encrypted (0x02) secure request
  // [uint8]
  requestType: LatticeSecureMsgType;
  // Request data
  // NOTE: This is twice as large as it *should* be due to
  // a firmware bug:
  // https://github.com/GridPlus/lattice-firmware/issues/2636
  // [uint8[3392]]
  data: Buffer;
}

interface LatticeSecureResponse {
  // Protocol version. Should always be 0x01
  // [uint8]
  protocolVersion: LatticeProtocolVersion;
  // Protocol request type. Should always be 0x00
  // for "response" message type.
  // [uint8]
  msgType: LatticeMsgType;
  // Same random ID as was created for the request
  // [4 bytes]
  msgId: Buffer;
  // Length of payload data being used
  // For an encrypted request, this indicates the
  // size of the non-zero decrypted data.
  // [uint16]
  payloadLen: number;
  // Response data
  // [3393 bytes]
  payload: LatticeSecureResponsePayload;
  // Checksum over the entire `LatticeSecureResponse`
  // (excluding the checksum param, though)
  // [uint32]
  checksum: number;
}

interface LatticeSecureResponsePayload {
  // Error code
  responseCode: LatticeResponseCode;
  // Response data
  // [3392 bytes]
  data: Buffer;
}

interface LatticeSecureConnectRequestPayloadData {
  // Public key corresponding to the static Client keypair
  // [65 bytes]
  pubkey: Buffer;
}

interface LatticeSecureEncryptedRequestPayloadData {
  // SHA256(sharedSecret).slice(0, 4)
  // [uint32]
  ephemeralId: number;
  // Encrypted data envelope
  // [1696 bytes]
  encryptedData: Buffer;
}