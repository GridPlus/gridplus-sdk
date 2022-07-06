import { decResLengths } from '../constants';
import { decryptResponse, encryptRequest, request } from '../shared/functions';
import {
  validateFwConstants,
  validateSharedSecret,
  validateUrl,
} from '../shared/validators';

export async function getKvRecords ({
  type: _type,
  n: _n,
  start: _start,
  client,
}: GetKvRecordsRequestFunctionParams): Promise<GetKvRecordsData> {
  const { url, sharedSecret, fwConstants, type, n, start } =
    validateGetKvRequest({
      url: client.url,
      fwConstants: client.getFwConstants(),
      sharedSecret: client.sharedSecret,
      type: _type,
      n: _n,
      start: _start,
    });

  const payload = encodeGetKvRecordsRequest({ type, n, start });

  const encryptedPayload = encryptGetKvRecordsRequest({
    payload,
    sharedSecret,
  });

  const encryptedResponse = await requestGetKvRecords(encryptedPayload, url);

  const { decryptedData, newEphemeralPub } = decryptGetKvRecordsResponse(
    encryptedResponse,
    sharedSecret,
  );

  client.ephemeralPub = newEphemeralPub;

  const records = decodeGetKvRecordsResponse(decryptedData, fwConstants);

  return records;
}

export const validateGetKvRequest = ({
  url,
  fwConstants,
  sharedSecret,
  n,
  type,
  start,
}: ValidateGetKvRequestParams) => {
  const validUrl = validateUrl(url);
  const validFwConstants = validateFwConstants(fwConstants);
  const validSharedSecret = validateSharedSecret(sharedSecret);

  if (!validFwConstants.kvActionsAllowed) {
    throw new Error('Unsupported. Please update firmware.');
  }
  if (!n || n < 1) {
    throw new Error('You must request at least one record.');
  }
  if (n > validFwConstants.kvActionMaxNum) {
    throw new Error(
      `You may only request up to ${validFwConstants.kvActionMaxNum} records at once.`,
    );
  }
  if (type !== 0 && !type) {
    throw new Error('You must specify a type.');
  }
  if (start !== 0 && !start) {
    throw new Error('You must specify a type.');
  }

  return {
    url: validUrl,
    fwConstants: validFwConstants,
    sharedSecret: validSharedSecret,
    type,
    n,
    start,
  };
};

export const encodeGetKvRecordsRequest = ({
  type,
  n,
  start,
}: EncodeGetKvRecordsRequestParams) => {
  const payload = Buffer.alloc(9);
  payload.writeUInt32LE(type, 0);
  payload.writeUInt8(n, 4);
  payload.writeUInt32LE(start, 5);
  return payload;
};

export const encryptGetKvRecordsRequest = ({
  payload,
  sharedSecret,
}: EncrypterParams) => {
  return encryptRequest({
    requestCode: 'GET_KV_RECORDS',
    payload,
    sharedSecret,
  });
};

export const requestGetKvRecords = async (payload: Buffer, url: string) => {
  return request({ payload, url });
};

export const decryptGetKvRecordsResponse = (
  response: Buffer,
  sharedSecret: Buffer,
) => {
  const { decryptedData, newEphemeralPub } = decryptResponse(
    response,
    decResLengths.getKvRecords,
    sharedSecret,
  );
  return { decryptedData, newEphemeralPub };
};

export const decodeGetKvRecordsResponse = (
  data: Buffer,
  fwConstants: FirmwareConstants,
) => {
  let off = 65; // Skip 65 byte pubkey prefix
  const nTotal = parseInt(data.slice(off, off + 4).toString('hex'), 16);
  off += 4;
  const nFetched = parseInt(data.slice(off, off + 1).toString('hex'), 16);
  off += 1;
  if (nFetched > fwConstants.kvActionMaxNum)
    throw new Error('Too many records fetched. Firmware error.');
  const records: any = [];
  for (let i = 0; i < nFetched; i++) {
    const r: any = {};
    r.id = parseInt(data.slice(off, off + 4).toString('hex'), 16);
    off += 4;
    r.type = parseInt(data.slice(off, off + 4).toString('hex'), 16);
    off += 4;
    r.caseSensitive =
      parseInt(data.slice(off, off + 1).toString('hex'), 16) === 1
        ? true
        : false;
    off += 1;
    const keySz = parseInt(data.slice(off, off + 1).toString('hex'), 16);
    off += 1;
    r.key = data.slice(off, off + keySz - 1).toString();
    off += fwConstants.kvKeyMaxStrSz + 1;
    const valSz = parseInt(data.slice(off, off + 1).toString('hex'), 16);
    off += 1;
    r.val = data.slice(off, off + valSz - 1).toString();
    off += fwConstants.kvValMaxStrSz + 1;
    records.push(r);
  }
  return {
    records,
    total: nTotal,
    fetched: nFetched,
  };
};
