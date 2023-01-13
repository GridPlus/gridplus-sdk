import {
  encryptedSecureRequest,
  LatticeSecureEncryptedRequestType,
} from '../protocol';
import { validateConnectedClient } from '../shared/validators';

/**
 * `removeKvRecords` takes in an array of ids and sends a request to remove them from the Lattice.
 * @category Lattice
 * @returns A callback with an error or null.
 */
export async function removeKvRecords({
  client,
  type: _type,
  ids: _ids,
}: RemoveKvRecordsRequestFunctionParams): Promise<Buffer> {
  const { url, sharedSecret, ephemeralPub, fwConstants } =
    validateConnectedClient(client);

  const { type, ids } = validateRemoveKvRequest({
    fwConstants,
    type: _type,
    ids: _ids,
  });

  const data = encodeRemoveKvRecordsRequest({
    type,
    ids,
    fwConstants,
  });

  const { decryptedData, newEphemeralPub } = await encryptedSecureRequest({
    data,
    requestType: LatticeSecureEncryptedRequestType.removeKvRecords,
    sharedSecret,
    ephemeralPub,
    url,
  });

  client.mutate({
    ephemeralPub: newEphemeralPub,
  });

  return decryptedData;
}

export const validateRemoveKvRequest = ({
  fwConstants,
  type,
  ids,
}: {
  fwConstants: FirmwareConstants;
  type?: number;
  ids?: string[];
}) => {
  if (!fwConstants.kvActionsAllowed) {
    throw new Error('Unsupported. Please update firmware.');
  }
  if (!Array.isArray(ids) || ids.length < 1) {
    throw new Error('You must include one or more `ids` to removed.');
  }
  if (ids.length > fwConstants.kvRemoveMaxNum) {
    throw new Error(
      `Only up to ${fwConstants.kvRemoveMaxNum} records may be removed at once.`,
    );
  }
  if (type !== 0 && !type) {
    throw new Error('You must specify a type.');
  }
  return { type, ids };
};

export const encodeRemoveKvRecordsRequest = ({
  fwConstants,
  type,
  ids,
}: {
  fwConstants: FirmwareConstants;
  type: number;
  ids: string[];
}) => {
  const payload = Buffer.alloc(5 + 4 * fwConstants.kvRemoveMaxNum);
  payload.writeUInt32LE(type, 0);
  payload.writeUInt8(ids.length, 4);
  for (let i = 0; i < ids.length; i++) {
    const id = parseInt(ids[i] as string);
    payload.writeUInt32LE(id, 5 + 4 * i);
  }
  return payload;
};
