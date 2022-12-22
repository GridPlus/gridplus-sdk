import {
  encryptedSecureRequest,
  LatticeSecureEncryptedRequestType,
} from '../protocol';
import {
  validateConnectedClient,
  validateKvRecord,
  validateKvRecords,
} from '../shared/validators';

/**
 * `addKvRecords` takes in a set of key-value records and sends a request to add them to the
 * Lattice.
 * @category Lattice
 * @returns A callback with an error or null.
 */
export async function addKvRecords (
  req: AddKvRecordsRequestFunctionParams
): Promise<Buffer> {
  const { type = 0, caseSensitive = false } = req;
  // Validate request params
  validateAddKvRequest(req);
  // Build the data for this request
  const data = encodeAddKvRecordsRequest({
    records: req.records,
    fwConstants: req.client.getFwConstants(),
    type,
    caseSensitive,
  });
  // Make the request
  return await encryptedSecureRequest(
    req.client,
    data,
    LatticeSecureEncryptedRequestType.addKvRecords
  );
}

export const validateAddKvRequest = (
  req: AddKvRecordsRequestFunctionParams
) => {
  validateConnectedClient(req.client);
  validateKvRecords(req.records, req.client.getFwConstants())
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