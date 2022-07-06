import { decResLengths } from '../constants';
import { decryptResponse, encryptRequest, request } from '../shared/functions';
import {
  validateFwConstants,
  validateKvRecord,
  validateKvRecords,
  validateSharedSecret,
  validateUrl,
} from '../shared/validators';

/**
 * `addKvRecords` takes in a set of key-value records and sends a request to add them to the
 * Lattice.
 * @category Lattice
 * @returns A callback with an error or null.
 */
export async function addKvRecords ({
  type = 0,
  records,
  caseSensitive = false,
  client,
}: AddKvRecordsRequestFunctionParams): Promise<Buffer> {
  const { url, sharedSecret, fwConstants, validRecords } = validateAddKvRequest(
    {
      url: client.url,
      fwConstants: client.getFwConstants(),
      sharedSecret: client.sharedSecret,
      records,
    },
  );

  const payload = encodeAddKvRecordsRequest({
    records: validRecords,
    fwConstants,
    type,
    caseSensitive,
  });

  const encryptedPayload = encryptAddKvRecordsRequest({
    payload,
    sharedSecret,
  });

  const encryptedResponse = await requestAddKvRecords(encryptedPayload, url);

  const { decryptedData, newEphemeralPub } = decryptAddKvRecordsResponse(
    encryptedResponse,
    sharedSecret,
  );

  client.ephemeralPub = newEphemeralPub;

  return decryptedData;
}

export const validateAddKvRequest = ({
  url,
  fwConstants,
  sharedSecret,
  records,
}: ValidateAddKvRequestParams) => {
  const validUrl = validateUrl(url);
  const validFwConstants = validateFwConstants(fwConstants);
  const validSharedSecret = validateSharedSecret(sharedSecret);
  const validRecords = validateKvRecords(records, validFwConstants);

  return {
    url: validUrl,
    fwConstants: validFwConstants,
    sharedSecret: validSharedSecret,
    validRecords,
  };
};

export const encodeAddKvRecordsRequest = ({
  records,
  fwConstants,
  type,
  caseSensitive,
}: EncodeAddKvRecordsRequestParams) => {
  const payload = Buffer.alloc(1 + 139 * fwConstants.kvActionMaxNum);
  payload.writeUInt8(Object.keys(records).length, 0);
  let off = 1;
  Object.entries(records).forEach(([_key, _val]) => {
    const { key, val } = validateKvRecord(
      { key: _key, val: _val },
      fwConstants,
    );
    // Skip the ID portion. This will get added by firmware.
    payload.writeUInt32LE(0, off);
    off += 4;
    payload.writeUInt32LE(type, off);
    off += 4;
    payload.writeUInt8(caseSensitive ? 1 : 0, off);
    off += 1;
    payload.writeUInt8(String(key).length + 1, off);
    off += 1;
    Buffer.from(String(key)).copy(payload, off);
    off += fwConstants.kvKeyMaxStrSz + 1;
    payload.writeUInt8(String(val).length + 1, off);
    off += 1;
    Buffer.from(String(val)).copy(payload, off);
    off += fwConstants.kvValMaxStrSz + 1;
  });
  return payload;
};

export const encryptAddKvRecordsRequest = ({
  payload,
  sharedSecret,
}: EncrypterParams) => {
  return encryptRequest({
    requestCode: 'ADD_KV_RECORDS',
    payload,
    sharedSecret,
  });
};

export const requestAddKvRecords = async (payload: Buffer, url: string) => {
  return request({ payload, url });
};

export const decryptAddKvRecordsResponse = (
  response: Buffer,
  sharedSecret: Buffer,
) => {
  const { decryptedData, newEphemeralPub } = decryptResponse(
    response,
    decResLengths.empty,
    sharedSecret,
  );
  return { decryptedData, newEphemeralPub };
};
