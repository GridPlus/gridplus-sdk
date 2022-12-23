export enum LatticeResponseCode {
  success = 0x00,
  invalidMsg = 0x80,
  unsupportedVersion = 0x81,
  deviceBusy = 0x82,
  userTimeout = 0x83,
  userDeclined = 0x84,
  pairFailed = 0x85,
  pairDisabled = 0x86,
  permissionDisabled = 0x87,
  internalError = 0x88,
  gceTimeout = 0x89,
  wrongWallet = 0x8a,
  deviceLocked = 0x8b,
  disabled = 0x8c,
  already = 0x8d,
  invalidEphemId = 0x8e,
}

export enum LatticeSecureMsgType {
  connect = 0x01,
  encrypted = 0x02,
}

export enum LatticeProtocolVersion {
  v1 = 0x01,
}

export enum LatticeMsgType {
  response = 0x00,
  secure = 0x02,
}

export enum LatticeSecureEncryptedRequestType {
  finalizePairing = 0,
  getAddresses = 1,
  sign = 3,
  getWallets = 4,
  getKvRecords = 7,
  addKvRecords = 8,
  removeKvRecords = 9,
  fetchEncryptedData = 12,
  test = 13,
}

export const ProtocolConstants = {
  // Lattice firmware uses a static initialization vector for
  // message encryption/decryption. This is generally considered
  // fine because each encryption/decryption uses a unique encryption
  // secret (derived from the per-message ephemeral key pair).
  aesIv: [
    0x6d, 0x79, 0x73, 0x65, 0x63, 0x72, 0x65, 0x74, 
    0x70, 0x61, 0x73, 0x73, 0x77, 0x6f, 0x72, 0x64,
  ],
  // Constant size of address buffers from the Lattice.
  // Note that this size also captures public keys returned
  // by the Lattice (addresses = strings, pubkeys = buffers)
  addrStrLen: 129,
  // Status of the client's pairing with the target Lattice
  pairingStatus: {
    notPaired: 0x00,
    paired: 0x01,
  },
  // Response types, codes, and error messages
  responseMsg: {
    [LatticeResponseCode.success]: 
      '',
    [LatticeResponseCode.invalidMsg]: 
      'Invalid Request',
    [LatticeResponseCode.unsupportedVersion]: 
      'Unsupported Version',
    [LatticeResponseCode.deviceBusy]: 
      'Device Busy',
    [LatticeResponseCode.userTimeout]: 
      'Timeout waiting for user',
    [LatticeResponseCode.userDeclined]: 
      'Request declined by user',
    [LatticeResponseCode.pairFailed]: 
      'Pairing failed',
    [LatticeResponseCode.pairDisabled]: 
      'Pairing is currently disabled',
    [LatticeResponseCode.permissionDisabled]: 
      'Automated signing is currently disabled',
    [LatticeResponseCode.internalError]: 
      'Device Error',
    [LatticeResponseCode.gceTimeout]: 
      'Device Timeout',
    [LatticeResponseCode.wrongWallet]: 
      'Active wallet does not match request',
    [LatticeResponseCode.deviceLocked]: 
      'Device Locked',
    [LatticeResponseCode.disabled]: 
      'Feature Disabled',
    [LatticeResponseCode.already]: 
      'Record already exists on device',
    [LatticeResponseCode.invalidEphemId]: 
      'Request failed - needs resync',
  },
  msgSizes: {
    secure: {
      requestMsg: 1713,
      requestPayload: 1701,
      requestPayloadData: 1700,
      responseMsg: 3405,
      responsePayload: 3393,
      // NOTE: Only the first 1696 of these bytes are used
      // by firmware. The data is larger due to a bug
      // in a firmware type which causes the type to be
      // twice as large as it should be. The latter half
      // of the response data is always empty.
      // https://github.com/GridPlus/lattice-firmware/issues/2636
      responsePayloadData: 3392,
      responsePayloadDataUsed: 1696,
      connect: {
        request: {
          data: 65,
        },
        response: {
          data: 215,
        },
      },
      encrypted: {
        request: {
          data: 1700,
        },
        response: {
          // Once decrypted, the data size of the response
          // payload will be determined by the request type.
          // NOTE: Data sizes should mostly correspond to specific
          // encrypted request types, though some responses are
          // empty, so we re-use the "empty" size.
          data: {
            empty: 0,
            [LatticeSecureEncryptedRequestType.getAddresses]: 1290,
            [LatticeSecureEncryptedRequestType.sign]: 1090,
            [LatticeSecureEncryptedRequestType.getWallets]: 142,
            [LatticeSecureEncryptedRequestType.getKvRecords]: 1395,
            [LatticeSecureEncryptedRequestType.fetchEncryptedData]: 1608,
            [LatticeSecureEncryptedRequestType.test]: 1646,
          }
        }
      }
    }
  }
}