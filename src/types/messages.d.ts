interface LatticeMessageHeader {
  // Protocol version. Should always be 0x01
  // [uint8]
  version: number;
  // Protocol request type. Should always be 0x02
  // for "secure" message type.
  // [uint8]
  type: LatticeMsgType;
  // Random message ID for internal tracking in firmware
  // [4 bytes]
  id: Buffer;
  // Length of payload data being used
  // For an encrypted request, this indicates the
  // size of the non-zero decrypted data.
  // [uint16]
  len: number;
}
