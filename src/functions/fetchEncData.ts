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
  }
}

export async function fetchEncData (
  req: FetchEncDataRequestFunctionParams,
): Promise<Buffer> {
  // Validate request params
  validateFetchEncDataRequest(req);
  // Build data for this request
  const data = encodeFetchEncDataRequest(req);
  // Make the request
  const decRespPayloadData = await encryptedSecureRequest(
    req.client,
    data,
    LatticeSecureEncryptedRequestType.fetchEncryptedData
  );
  // Decode response data and return
  return decodeFetchEncData(decRespPayloadData, req);
}

export const validateFetchEncDataRequest = (
  req: FetchEncDataRequestFunctionParams
) => {
  // Validate client state
  validateConnectedClient(req.client);
  // Validate derivation path
  validateStartPath(req.params.path);
}

export const encodeFetchEncDataRequest = (
  req: FetchEncDataRequestFunctionParams
) => {
  // Check firmware version
  if (req.client.fwVersion.major < 1 && req.client.fwVersion.minor < 17) {
    throw new Error('Firmware version >=v0.17.0 is required for encrypted data export.');
  }
  // Update params depending on what type of data is being exported
  if (req.schema === ENC_DATA.SCHEMAS.BLS_KEYSTORE_EIP2335_PBKDF_V4) {
    // Set the wallet UID to the client's current active wallet
    req.params.walletUID = req.client.getActiveWallet().uid;
  } else {
    throw new Error(ENC_DATA_ERR_STR);
  }
  // Build the payload data
  const payload = Buffer.alloc(ENC_DATA_REQ_DATA_SZ);
  let off = 0;
  payload.writeUInt8(req.schema, off);
  off += 1;
  if (req.schema === ENC_DATA.SCHEMAS.BLS_KEYSTORE_EIP2335_PBKDF_V4) {
    req.params.walletUID.copy(payload, off);
    off += req.params.walletUID.length;
    payload.writeUInt8(req.params.path.length, off);
    off += 1;
    for (let i = 0; i < 5; i++) {
      if (i <= req.params.path.length) {
        payload.writeUInt32LE(req.params.path[i], off);
      }
      off += 4;
    }
    if (req.params.c) {
      payload.writeUInt32LE(req.params.c, off)
    }
    off += 4;
    return payload;
  } else {
    throw new Error(ENC_DATA_ERR_STR)
  }
}

export const decodeFetchEncData = (data: Buffer, req: FetchEncDataRequestFunctionParams): Buffer => {
  let off = 0;
  if (req.schema === ENC_DATA.SCHEMAS.BLS_KEYSTORE_EIP2335_PBKDF_V4) {
    const respData = {} as EIP2335KeyExportData;
    const { CIPHERTEXT, SALT, CHECKSUM, IV, PUBKEY } = ENC_DATA_RESP_SZ.EIP2335;
    const expectedSz =  4 + // iterations = u32
                        CIPHERTEXT +  SALT + CHECKSUM + IV + PUBKEY;
    const dataSz = data.readUInt32LE(off);
    off += 4;
    if (dataSz !== expectedSz) {
      throw new Error('Invalid data returned from Lattice. Expected EIP2335 data.');
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
    return formatEIP2335ExportData(respData, req.params.path);
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