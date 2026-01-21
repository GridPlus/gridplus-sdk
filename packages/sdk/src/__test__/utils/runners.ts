import type { Client } from '../../client';
import { getEncodedPayload } from '../../genericSigning';
import type { SigningPayload, SignRequestParams, TestRequestPayload } from '../../types';
import { parseWalletJobResp, validateGenericSig } from './helpers';
import { TEST_SEED } from './testConstants';
import { testRequest } from './testRequest';

export async function runTestCase(payload: TestRequestPayload, expectedCode: number) {
  const res = await testRequest(payload);
  //@ts-expect-error - Accessing private property
  const fwVersion = payload.client.fwVersion;
  const parsedRes = parseWalletJobResp(res, fwVersion);
  expect(parsedRes.resultStatus).toEqual(expectedCode);
  return parsedRes;
}

export async function runGeneric(request: SignRequestParams, client: Client) {
  const response = await client.sign(request);
  // runGeneric is only used for generic signing, not Bitcoin
  const data = request.data as SigningPayload;
  // If no encoding type is specified we encode in hex or ascii
  const encodingType = data.encodingType || null;
  const allowedEncodings = client.getFwConstants().genericSigning.encodingTypes;
  const { payloadBuf } = getEncodedPayload(data.payload, encodingType, allowedEncodings);
  const seed = TEST_SEED;
  validateGenericSig(seed, response.sig, payloadBuf, data, response.pubkey);
  return response;
}

export const runEthMsg = async (req: SignRequestParams, client: Client) => {
  const sig = await client.sign(req);
  expect(sig.sig).not.toEqual(null);
};
