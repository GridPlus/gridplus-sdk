/**
 * Export encrypted data from the Lattice. Data must conform
 * to known schema, e.g. EIP2335 derived privkey export.
 */
import { v4 as uuidV4 } from 'uuid';
import { EXTERNAL } from '../constants';
import {
  encryptedSecureRequest,
  LatticeSecureEncryptedRequestType,
} from '../protocol';
import { getPathStr } from '../shared/utilities';
import {
  validateConnectedClient,
  validateStartPath,
  validateWallet,
} from '../shared/validators';

const { ENC_DATA } = EXTERNAL;
const ENC_DATA_ERR_STR = 'Unknown encrypted data export type requested. Exiting.';
const ENC_DATA_REQ_DATA_SZ = 1025;
const ENC_DATA_RESP_SZ = {
  EIP2335: {
    CIPHERTEXT: 32,
    SALT: 32,
    CHECKSUM: 32,
    IV: 16,
    PUBKEY: 48,
  },
} as const;

export async function fetchEncData({
  client,
  schema,
  params,
}: FetchEncDataRequestFunctionParams): Promise<Buffer> {
  const { url, sharedSecret, ephemeralPub, fwVersion } =
    validateConnectedClient(client);
  const activeWallet = validateWallet(client.getActiveWallet());
  validateFetchEncDataRequest({ params });

  const data = encodeFetchEncDataRequest({
    schema,
    params,
    fwVersion,
    activeWallet,
  });

  const { decryptedData, newEphemeralPub } = await encryptedSecureRequest({
    data,
    requestType: LatticeSecureEncryptedRequestType.fetchEncryptedData,
    sharedSecret,
    ephemeralPub,
    url,
  });

  client.mutate({
    ephemeralPub: newEphemeralPub,
  });

  return decodeFetchEncData({ data: decryptedData, schema, params });
}

export const validateFetchEncDataRequest = ({
  params,
}: {
  params: EIP2335KeyExportReq;
}) => {
  // Validate derivation path
  validateStartPath(params.path);
};

export const encodeFetchEncDataRequest = ({
  schema,
  params,
  fwVersion,
  activeWallet,
}: {
  schema: number;
  params: EIP2335KeyExportReq;
  fwVersion: FirmwareVersion;
  activeWallet: Wallet;
}) => {
  // Check firmware version
  if (fwVersion.major < 1 && fwVersion.minor < 17) {
    throw new Error(
      'Firmware version >=v0.17.0 is required for encrypted data export.',
    );
  }
  // Update params depending on what type of data is being exported
  if (schema === ENC_DATA.SCHEMAS.BLS_KEYSTORE_EIP2335_PBKDF_V4) {
    // Set the wallet UID to the client's current active wallet
    params.walletUID = activeWallet.uid;
  } else {
    throw new Error(ENC_DATA_ERR_STR);
  }
  // Build the payload data
  const payload = Buffer.alloc(ENC_DATA_REQ_DATA_SZ);
  let off = 0;
  payload.writeUInt8(schema, off);
  off += 1;
  if (schema === ENC_DATA.SCHEMAS.BLS_KEYSTORE_EIP2335_PBKDF_V4) {
    params.walletUID.copy(payload, off);
    off += params.walletUID.length;
    payload.writeUInt8(params.path.length, off);
    off += 1;
    for (let i = 0; i < 5; i++) {
      if (i <= params.path.length) {
        payload.writeUInt32LE(params.path[i], off);
      }
      off += 4;
    }
    if (params.c) {
      payload.writeUInt32LE(params.c, off);
    }
    off += 4;
    return payload;
  } else {
    throw new Error(ENC_DATA_ERR_STR);
  }
};

export const decodeFetchEncData = ({
  data,
  schema,
  params,
}: {
  schema: number;
  params: EIP2335KeyExportReq;
  data: Buffer;
}): Buffer => {
  let off = 0;
  if (schema === ENC_DATA.SCHEMAS.BLS_KEYSTORE_EIP2335_PBKDF_V4) {
    const respData = {} as EIP2335KeyExportData;
    const { CIPHERTEXT, SALT, CHECKSUM, IV, PUBKEY } = ENC_DATA_RESP_SZ.EIP2335;
    const expectedSz =
      4 + // iterations = u32
      CIPHERTEXT +
      SALT +
      CHECKSUM +
      IV +
      PUBKEY;
    const dataSz = data.readUInt32LE(off);
    off += 4;
    if (dataSz !== expectedSz) {
      throw new Error(
        'Invalid data returned from Lattice. Expected EIP2335 data.',
      );
    }
    respData.iterations = data.readUInt32LE(off);
    off += 4;
    respData.cipherText = data.slice(off, off + CIPHERTEXT);
    off += CIPHERTEXT;
    respData.salt = data.slice(off, off + SALT);
    off += SALT;
    respData.checksum = data.slice(off, off + CHECKSUM);
    off += CHECKSUM;
    respData.iv = data.slice(off, off + IV);
    off += IV;
    respData.pubkey = data.slice(off, off + PUBKEY);
    off += PUBKEY;
    return formatEIP2335ExportData(respData, params.path);
  } else {
    throw new Error(ENC_DATA_ERR_STR);
  }
}

const formatEIP2335ExportData = (resp: EIP2335KeyExportData, path: number[]): Buffer => {
  try {
    const { iterations, salt, checksum, iv, cipherText, pubkey } = resp;
    return Buffer.from(JSON.stringify({
      'version': 4,
      'uuid': uuidV4(),
      'path': getPathStr(path),
      'pubkey': pubkey.toString('hex'),
      'crypto': {
        'kdf': {
          'function': 'pbkdf2',
          'params': {
            'dklen': 32,
            'c': iterations,
            'prf': 'hmac-sha256',
            'salt': salt.toString('hex'),
          },
          'message': ''
        },
        'checksum': {
          'function': 'sha256',
          'params': {},
          'message': checksum.toString('hex'),
        },
        'cipher': {
          'function': 'aes-128-ctr',
          'params': {
            'iv': iv.toString('hex'),
          },
          'message': cipherText.toString('hex')
        }
      }
    }));
  } catch (err) {
    throw Error(`Failed to format EIP2335 return data: ${err.toString()}`);
  }
}