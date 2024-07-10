import { Client } from '../../client';
import { buildTestRequestPayload } from './builders';
import {
  deserializeExportSeedJobResult,
  jobTypes,
  parseWalletJobResp,
} from './helpers';
import { testRequest } from './testRequest';

export const initializeSeed = async (client: Client) => {
  const jobType = jobTypes.WALLET_JOB_EXPORT_SEED;
  const jobData = {};
  const testRequestPayload = buildTestRequestPayload(client, jobType, jobData);
  const res = await testRequest(testRequestPayload);
  const _res = parseWalletJobResp(res, client.getFwVersion());
  expect(_res.resultStatus).toEqual(0);
  const data = deserializeExportSeedJobResult(_res.result);
  return data.seed;
};
