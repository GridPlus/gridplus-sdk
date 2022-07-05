import { decResLengths } from '../constants';
import { decryptResponse, encryptRequest, request } from '../shared/functions';
import {
  validateFwConstants,
  validateSharedSecret,
  validateUrl
} from '../shared/validators';

/**
 * `removeKvRecords` takes in an array of ids and sends a request to remove them from the Lattice.
 * @category Lattice
 * @returns A callback with an error or null.
 */
export async function removeKvRecords ({
  type: _type,
  ids: _ids,
  client,
}: RemoveKvRecordsRequestFunctionParams): Promise<Buffer> {
  const { url, sharedSecret, fwConstants, type, ids } = validateRemoveKvRequest(
    {
      url: client.url,
      fwConstants: client.getFwConstants(),
      sharedSecret: client.sharedSecret,
      type: _type,
      ids: _ids,
    },
  );

  const payload = encodeRemoveKvRecordsRequest({ type, ids, fwConstants });

  const encryptedPayload = encryptRemoveKvRecordsRequest({
    payload,
    sharedSecret,
  });

  const encryptedResponse = await requestRemoveKvRecords(encryptedPayload, url);

  const { decryptedData, newEphemeralPub } = decryptRemoveKvRecordsResponse(
    encryptedResponse,
    sharedSecret,
  );

  client.ephemeralPub = newEphemeralPub;

  return decryptedData;
}

export const validateRemoveKvRequest = ({
  url,
  fwConstants,
  sharedSecret,
  ids,
  type,
}: ValidateRemoveKvRequestParams): ValidatedRemoveKvRequest => {
  const validUrl = validateUrl(url);
  const validFwConstants = validateFwConstants(fwConstants);
  const validSharedSecret = validateSharedSecret(sharedSecret);

  if (!validFwConstants.kvActionsAllowed) {
    throw new Error('Unsupported. Please update firmware.');
  }
  if (!Array.isArray(ids) || ids.length < 1) {
    throw new Error('You must include one or more `ids` to removed.');
  }
  if (ids.length > validFwConstants.kvRemoveMaxNum) {
    throw new Error(
      `Only up to ${validFwConstants.kvRemoveMaxNum} records may be removed at once.`,
    );
  }
  if (type !== 0 && !type) {
    throw new Error('You must specify a type.');
  }

  return {
    url: validUrl,
    fwConstants: validFwConstants,
    sharedSecret: validSharedSecret,
    type,
    ids,
  };
};

export const encodeRemoveKvRecordsRequest = ({
  type,
  ids,
  fwConstants,
}: EncodeRemoveKvRecordsRequestParams) => {
  const payload = Buffer.alloc(5 + 4 * fwConstants.kvRemoveMaxNum);
  payload.writeUInt32LE(type, 0);
  payload.writeUInt8(ids.length, 4);
  for (let i = 0; i < ids.length; i++) {
    const id = parseInt(ids[i] as string);
    payload.writeUInt32LE(id, 5 + 4 * i);
  }
  return payload;
};

export const encryptRemoveKvRecordsRequest = ({
  payload,
  sharedSecret,
}: EncrypterParams) => {
  return encryptRequest({
    requestCode: 'REMOVE_KV_RECORDS',
    payload,
    sharedSecret,
  });
};

export const requestRemoveKvRecords = async (payload: Buffer, url: string) => {
  return request({ payload, url });
};

export const decryptRemoveKvRecordsResponse = (
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
