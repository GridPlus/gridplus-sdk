import {
  encryptedSecureRequest,
  LatticeSecureEncryptedRequestType,
} from '../protocol';
import { validateConnectedClient } from '../shared/validators';

export async function getKvRecords({
  client,
  type: _type,
  n: _n,
  start: _start,
}: GetKvRecordsRequestFunctionParams): Promise<GetKvRecordsData> {
  const { url, sharedSecret, ephemeralPub, fwConstants } =
    validateConnectedClient(client);

  const { type, n, start } = validateGetKvRequest({
    type: _type,
    n: _n,
    start: _start,
    fwConstants,
  });

  const data = encodeGetKvRecordsRequest({ type, n, start });

  const { decryptedData, newEphemeralPub } = await encryptedSecureRequest({
    data,
    requestType: LatticeSecureEncryptedRequestType.getKvRecords,
    sharedSecret,
    ephemeralPub,
    url,
  });

  client.mutate({
    ephemeralPub: newEphemeralPub,
  });

  return decodeGetKvRecordsResponse(decryptedData, fwConstants);
}

export const validateGetKvRequest = ({
  fwConstants,
  n,
  type,
  start,
}: {
  fwConstants: FirmwareConstants;
  n?: number;
  type?: number;
  start?: number;
}) => {
  if (!fwConstants.kvActionsAllowed) {
    throw new Error('Unsupported. Please update firmware.');
  }
  if (!n || n < 1) {
    throw new Error('You must request at least one record.');
  }
  if (n > fwConstants.kvActionMaxNum) {
    throw new Error(
      `You may only request up to ${fwConstants.kvActionMaxNum} records at once.`,
    );
  }
  if (type !== 0 && !type) {
    throw new Error('You must specify a type.');
  }
  if (start !== 0 && !start) {
    throw new Error('You must specify a type.');
  }

  return { fwConstants, n, type, start };
};

export const encodeGetKvRecordsRequest = ({
  type,
  n,
  start,
}: {
  type: number;
  n: number;
  start: number;
}) => {
  const payload = Buffer.alloc(9);
  payload.writeUInt32LE(type, 0);
  payload.writeUInt8(n, 4);
  payload.writeUInt32LE(start, 5);
  return payload;
};

export const decodeGetKvRecordsResponse = (
  data: Buffer,
  fwConstants: FirmwareConstants,
) => {
  let off = 0;
  const nTotal = data.readUInt32BE(off);
  off += 4;
  const nFetched = parseInt(data.slice(off, off + 1).toString('hex'), 16);
  off += 1;
  if (nFetched > fwConstants.kvActionMaxNum)
    throw new Error('Too many records fetched. Firmware error.');
  const records: any = [];
  for (let i = 0; i < nFetched; i++) {
    const r: any = {};
    r.id = data.readUInt32BE(off);
    off += 4;
    r.type = data.readUInt32BE(off);
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
