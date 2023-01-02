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

export enum LatticeGetAddressesFlag {
  none = 0, // For formatted addresses
  secp256k1Pubkey = 3,
  ed25519Pubkey = 4,
  bls12_381Pubkey = 5,
}

export enum LatticeSignSchema {
  bitcoin = 0,
  ethereum = 1, // Deprecated
  ethereumMsg = 3,
  extraData = 4,
  generic = 5,
}

export enum LatticeSignHash {
  none = 0,
  keccak256 = 1,
  sha256 = 2,
}

export enum LatticeSignCurve {
  secp256k1 = 0,
  ed25519 = 1,
  bls12_381 = 2,
}

export enum LatticeSignEncoding {
  none = 1,
  solana = 2,
  evm = 4,
  eth_deposit = 5,
}

export enum LatticeSignBlsDst {
  NUL = 1,
  POP = 2,
}

export enum LatticeEncDataSchema {
  eip2335 = 0,
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
    // General message header size. Valid for all Lattice messages
    header: 8,
    // Checksum must be appended to each message
    checksum: 4,
    // Lattice secure message constants. All requests from this SDK
    // are secure messages.
    secure: {
      // Sizes of full payloads for secure messages
      payload: {
        request: {
          // [ requestType (1 byte) | pubkey (65 bytes) ]
          connect: 66,
          // [ requestType (1 byte) | ephemeralId (4 bytes) | encryptedData (1728 bytes) ]
          encrypted: 1733,
        },
        // Note that the response payload always has status code as the
        // first byte. This byte is removed as part of `request`, inside
        // `parseLattice1Response`. These constants include the status 
        // code byte.
        response: {
          connect: 215,
          // Encrypted responses are as follows:
          // encryptedData (1728) | empty (1728)
          // The latter half is empty due to an invalid type definition
          // in Lattice firmware. (Someone made a C `struct` instead of
          // a `union`, oops).
          encrypted: 3457,
        }
      },
      // Sizes for data inside secure message payloads
      data: {
        // All requests also have a `requestCode`, which is omitted 
        // from these constants.
        request: {
          connect: 65,
          encrypted: {
            // All encrypted requests are encrypted into a 1728 byte buffer
            encryptedData: 1728,
            // Individual request types have different data sizes.
            [LatticeSecureEncryptedRequestType.finalizePairing]: 99,
            [LatticeSecureEncryptedRequestType.getAddresses]: 54,
            [LatticeSecureEncryptedRequestType.sign]: 1680,
            [LatticeSecureEncryptedRequestType.getWallets]: 0,
            [LatticeSecureEncryptedRequestType.getKvRecords]: 9,
            [LatticeSecureEncryptedRequestType.addKvRecords]: 1391,
            [LatticeSecureEncryptedRequestType.removeKvRecords]: 405,
            [LatticeSecureEncryptedRequestType.fetchEncryptedData]: 1025,
            [LatticeSecureEncryptedRequestType.test]: 506,
          }
        },
        // All responses also have a `responseCode`, which is omitted
        // from these constants.
        response: {
          encrypted: {
            encryptedData: 1728,
            // Once decrypted, the data size of the response
            // payload will be determined by the request type.
            // NOTE: All requests also have ephemeralPublicKey (65 bytes) and
            // checksum (4 bytes), which are excluded from these sizes.
            [LatticeSecureEncryptedRequestType.finalizePairing]: 0,
            [LatticeSecureEncryptedRequestType.getAddresses]: 1290,
            [LatticeSecureEncryptedRequestType.sign]: 1090,
            [LatticeSecureEncryptedRequestType.getWallets]: 142,
            [LatticeSecureEncryptedRequestType.getKvRecords]: 1395,
            [LatticeSecureEncryptedRequestType.addKvRecords]: 0,
            [LatticeSecureEncryptedRequestType.removeKvRecords]: 0,
            [LatticeSecureEncryptedRequestType.fetchEncryptedData]: 1608,
            [LatticeSecureEncryptedRequestType.test]: 1646,
          }
        }
      }
    }
  }
}