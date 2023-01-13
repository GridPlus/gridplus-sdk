import {
  encryptedSecureRequest,
  LatticeSecureEncryptedRequestType,
} from '../../protocol';

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
  const sharedSecret = client.sharedSecret;
  const ephemeralPub = client.ephemeralPub;
  const url = client.url;

  const TEST_DATA_SZ = 500;
  const data = Buffer.alloc(TEST_DATA_SZ + 6);
  data.writeUInt32BE(testID, 0);
  data.writeUInt16BE(payload.length, 4);
  payload.copy(data, 6);

  return await encryptedSecureRequest({
    data,
    requestType: LatticeSecureEncryptedRequestType.test,
    sharedSecret,
    ephemeralPub,
    url,
  });
};
