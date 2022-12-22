import {
  decryptEncryptedLatticeResponseData,
  deserializeResponseMsgPayloadData,
  serializeSecureRequestMsg,
  serializeSecureRequestEncryptedPayloadData,
  LatticeSecureEncryptedRequestType,
  LatticeSecureMsgType,
} from '../protocol';
import { request } from '../shared/functions';
import {
  validateConnectedClient
} from '../shared/validators';
import { randomBytes } from '../util';

/**
 * `removeKvRecords` takes in an array of ids and sends a request to remove them from the Lattice.
 * @category Lattice
 * @returns A callback with an error or null.
 */
export async function removeKvRecords (
  req: RemoveKvRecordsRequestFunctionParams
): Promise<Buffer> {
  // Validate request params
  validateRemoveKvRequest(req);
  // Build data for this request
  const data = encodeRemoveKvRecordsRequest(req);
  // Build the secure request message
  const msgId = randomBytes(4);
  const payloadData = serializeSecureRequestEncryptedPayloadData(
    req.client,
    data,
    LatticeSecureEncryptedRequestType.fetchEncryptedData
  );
  const msg = serializeSecureRequestMsg(
    req.client,
    msgId,
    LatticeSecureMsgType.encrypted,
    payloadData
  );
  // Send request to Lattice
  const resp = await request({ 
    url: req.client.url, 
    payload: msg 
  });
  // Deserialize the response payload data
  const encRespPayloadData = deserializeResponseMsgPayloadData(
    req.client,
    msgId,
    resp
  );
  // Decrypt and return data
  return decryptEncryptedLatticeResponseData(
    req.client, 
    encRespPayloadData
  );
}

export const validateRemoveKvRequest = (
  req: RemoveKvRecordsRequestFunctionParams
) => {
  validateConnectedClient(req.client);
  const fwConstants = req.client.getFwConstants();
  if (!fwConstants.kvActionsAllowed) {
    throw new Error('Unsupported. Please update firmware.');
  }
  if (!Array.isArray(req.ids) || req.ids.length < 1) {
    throw new Error('You must include one or more `ids` to removed.');
  }
  if (req.ids.length > fwConstants.kvRemoveMaxNum) {
    throw new Error(
      `Only up to ${fwConstants.kvRemoveMaxNum} records may be removed at once.`,
    );
  }
  if (req.type !== 0 && !req.type) {
    throw new Error('You must specify a type.');
  }
};

export const encodeRemoveKvRecordsRequest = (
  req: RemoveKvRecordsRequestFunctionParams
) => {
  const fwConstants = req.client.getFwConstants();
  const payload = Buffer.alloc(5 + 4 * fwConstants.kvRemoveMaxNum);
  payload.writeUInt32LE(req.type, 0);
  payload.writeUInt8(req.ids.length, 4);
  for (let i = 0; i < req.ids.length; i++) {
    const id = parseInt(req.ids[i] as string);
    payload.writeUInt32LE(id, 5 + 4 * i);
  }
  return payload;
};