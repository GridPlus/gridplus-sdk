import { encryptedSecureRequest } from '../../protocol';
import { TestRequestPayload } from '../../types/utils';

/**
 * `test` takes a data object with a testID and a payload, and sends them to the device.
 * @category Lattice
 */
export const testRequest = async ({
  payload,
  testID,
  client,
}: TestRequestPayload) => {
  if (!payload) {
    throw new Error(
      'First argument must contain `testID` and `payload` fields.',
    );
  }
  const TEST_DATA_SZ = 500;
  const _payload = Buffer.alloc(TEST_DATA_SZ + 6);
  _payload.writeUInt32BE(testID, 0);
  _payload.writeUInt16BE(payload.length, 4);
  payload.copy(_payload, 6);
  return await encryptedSecureRequest(client, _payload);
};
