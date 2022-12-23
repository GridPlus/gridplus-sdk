import {
  encryptedSecureRequest,
  LatticeSecureEncryptedRequestType,
} from '../protocol';
import {
  validateConnectedClient
} from '../shared/validators';

export async function getKvRecords (
  req: GetKvRecordsRequestFunctionParams
): Promise<GetKvRecordsData> {
  // Validate request params
  validateGetKvRequest(req);
  // Build data for this request
  const data = encodeGetKvRecordsRequest(req);
  // Make the request
  const decRespPayloadData = await encryptedSecureRequest(
    req.client,
    data,
    LatticeSecureEncryptedRequestType.getKvRecords
  );
  // Decode the response data and return
  return decodeGetKvRecordsResponse(
    decRespPayloadData, 
    req.client.getFwConstants()
  );
}

export const validateGetKvRequest = (
  req: GetKvRecordsRequestFunctionParams
) => {
  validateConnectedClient(req.client)
  const fwConstants = req.client.getFwConstants();
  if (!fwConstants.kvActionsAllowed) {
    throw new Error('Unsupported. Please update firmware.');
  }
  if (!req.n || req.n < 1) {
    throw new Error('You must request at least one record.');
  }
  if (req.n > fwConstants.kvActionMaxNum) {
    throw new Error(
      `You may only request up to ${fwConstants.kvActionMaxNum} records at once.`,
    );
  }
  if (req.type !== 0 && !req.type) {
    throw new Error('You must specify a type.');
  }
  if (req.start !== 0 && !req.start) {
    throw new Error('You must specify a type.');
  }
};

export const encodeGetKvRecordsRequest = (
  req: GetKvRecordsRequestFunctionParams
) => {
  // Build teh payload
  const payload = Buffer.alloc(9);
  payload.writeUInt32LE(req.type, 0);
  payload.writeUInt8(req.n, 4);
  payload.writeUInt32LE(req.start, 5);
  return payload;
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
