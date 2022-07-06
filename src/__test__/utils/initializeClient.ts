import { question } from 'readline-sync';
import { Client } from '../../client';
import { buildTestRequestPayload } from './builders';
import { getDeviceId } from './getters';
import {
  deserializeExportSeedJobResult,
  jobTypes,
  parseWalletJobResp,
  setupTestClient,
} from './helpers';
import { testRequest } from './testRequest';

export const initializeClient = () => {
  const id = getDeviceId();
  const client = setupTestClient();

  describe('Initializing client', () => {
    it('Connecting to Lattice', async () => {
      const _id = id
        ? id
        : question('Please enter the ID of your test device: ');
      const isPaired = await client.connect(_id);
      if (!isPaired) {
        expect(client.isPaired).toEqual(false);
        const secret = question('Please enter the pairing secret: ');
        await client.pair(secret.toUpperCase());
        expect(!!client.getActiveWallet()).toEqual(true);
      }
      expect(client.isPaired).toEqual(true);
      expect(!!client.getActiveWallet()).toEqual(true);
    });
  });

  return client;
};

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
