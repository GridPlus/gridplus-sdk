/**
 * Export encrypted data from the Lattice. Data must conform
 * to known schema, e.g. EIP2335 derived privkey export.
 */
import { v4 as uuidV4 } from 'uuid';

import {
  decResLengths,
  EXTERNAL,
} from '../constants';
import {
  decryptResponse,
  encryptRequest,
  request,
} from '../shared/functions';
import { getPathStr } from '../shared/utilities';
import {
  validateFwVersion,
  validateSharedSecret,
  validateStartPath,
  validateUrl,
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
  }
}

export async function exportEncData (req: ExportEncDataRequestFunctionParams): Promise<Buffer> {
  const params = validateExportEncDataRequest(req);
  const payload = encodeExportEncDataRequest(req.schema, params);
  const encryptedPayload = encryptExportEncDataRequest({
    payload,
    sharedSecret: req.client.sharedSecret,
  });
  const encryptedResponse = await request({ 
    payload: encryptedPayload, 
    url: req.client.url 
  });
  const { decryptedData, newEphemeralPub } = decryptResponse(
    encryptedResponse,
    decResLengths.fetchEncryptedData,
    req.client.sharedSecret,
  );
  req.client.ephemeralPub = newEphemeralPub;
  return decodeExportEncData(decryptedData, req);
}

export const validateExportEncDataRequest = (req: ExportEncDataRequestFunctionParams): EIP2335KeyExportReq => {
  const { schema, params, client } = req;
  // Validate client state
  const wallet = client.getActiveWallet();
  validateFwVersion(client.fwVersion);
  validateWallet(wallet);
  validateSharedSecret(client.sharedSecret);
  validateUrl(client.url);
  // Check firmware version
  if (client.fwVersion.major < 1 && client.fwVersion.minor < 17) {
    throw new Error('Firmware version >=v0.17.0 is required for encrypted data export.');
  }
  // Validate params depending on what type of data is being exported
  if (schema === ENC_DATA.SCHEMAS.BLS_KEYSTORE_EIP2335_PBKDF_V4) {
    // EIP2335 key export
    validateStartPath(params.path);
    // Set the wallet UID to the client's current active wallet
    params.walletUID = wallet.uid;
    // Return updated params
    return params;
  } else {
    throw new Error(ENC_DATA_ERR_STR);
  }
}

export const encodeExportEncDataRequest = (
  schema: number,
  params: EIP2335KeyExportReq,
) => {
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
      payload.writeUInt32LE(params.c, off)
    }
    off += 4;
    return payload;
  } else {
    throw new Error(ENC_DATA_ERR_STR)
  }
}

export const encryptExportEncDataRequest = ({
  payload,
  sharedSecret,
}: EncrypterParams) => {
  return encryptRequest({
    requestCode: 'EXPORT_ENC_DATA',
    payload,
    sharedSecret,
  });
}

export const decodeExportEncData = (data: Buffer, req: ExportEncDataRequestFunctionParams): Buffer => {
  let off = 65; // Skip 65 byte pubkey prefix
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