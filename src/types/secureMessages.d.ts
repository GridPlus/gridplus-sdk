interface LatticeSecureRequest {
  // Message header
  header: LatticeMessageHeader;
  // Request data
  payload: LatticeSecureRequestPayload;
}

interface LatticeSecureRequestPayload {
  // Indicates whether this is a connect (0x01) or
  // encrypted (0x02) secure request
  // [uint8]
  requestType: LatticeSecureMsgType;
  // Request data
  // [1700 bytes]
  data: Buffer;
}

interface LatticeSecureResponse {
  // Message header
  header: LatticeMessageHeader;
  // Response data
  // [3393 bytes]
  payload: LatticeSecureResponsePayload;
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

interface LatticeSecureDecryptedResponse {
  // ECDSA public key that should replace the client's ephemeral key
  // [65 bytes]
  ephemeralPub: Buffer;
  // Decrypted response data
  // [Variable size]
  data: Buffer;
  // Checksum on response data (ephemeralKey | data)
  // [uint32]
  checksum: number;
}