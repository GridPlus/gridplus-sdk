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
  // [connect = 65 bytes, encrypted = 1732] 
  data: Buffer;
}

interface LatticeSecureConnectResponsePayload {
  // [214 bytes]
  data: Buffer;
}

interface LatticeSecureEncryptedResponsePayload {
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
  // [1728 bytes]
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