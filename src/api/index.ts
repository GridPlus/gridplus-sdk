import { KVRecords } from './../../dist/types/shared.d';
import { Transaction } from '@ethereumjs/tx';
import { HARDENED_OFFSET } from '../constants';
import { Client, Constants, Utils } from '../index';

let client: Client;
let clientStorageCallback: (clientData: any) => any;

const DEFAULT_ETH_DERIVATION = [
  HARDENED_OFFSET + 44,
  HARDENED_OFFSET + 60,
  HARDENED_OFFSET,
  0,
  0,
];

export const setup = ({
  deviceId,
  password,
  name,
  storedClient,
  storeClient,
}: any) => {
  if (storedClient) {
    client = new Client({ stateData: storedClient });
  } else {
    const privKey = Utils.generateAppSecret(deviceId, password, name);
    client = new Client({ deviceId, privKey, name });
  }
  if (storeClient) {
    clientStorageCallback = storeClient;
  }
  return client.connect(client.deviceId).then((res) => {
    clientStorageCallback(client.getStateData());
    return res;
  });
};

export const getClient = () => client;

const validateClient = () => {
  if (!getClient()) throw new Error('Client not initialized');
};

export const pair = async (pairingCode: string) => {
  validateClient();
  const res = await client.pair(pairingCode);
  clientStorageCallback(client.getStateData());
  return res;
};

export const fetchAddresses = async (overrides?: any) => {
  validateClient();
  const res = await client.getAddresses({
    startPath: DEFAULT_ETH_DERIVATION,
    n: 10,
    ...overrides,
  });
  clientStorageCallback(client.getStateData());
  return res;
};

export const addAddressTags = async (tags: [{ [key: string]: string }]) => {
  validateClient();
  // convert an array of objects to an object
  const records = tags.reduce((acc, tag) => {
    const key = Object.keys(tag)[0];
    acc[key] = tag[key];
    return acc;
  }, {});

  const res = await client.addKvRecords({ records });
  clientStorageCallback(client.getStateData());
  return res;
};

export const fetchAddressTags = async (overrides?: any) => {
  validateClient();
  const res = await client.getKvRecords({
    n: 10,
    ...overrides,
  });
  clientStorageCallback(client.getStateData());
  return res.records;
};

export const sign = async (payload: any, overrides?: any) => {
  validateClient();
  const tx = {
    data: {
      signerPath: DEFAULT_ETH_DERIVATION,
      curveType: Constants.SIGNING.CURVES.SECP256K1,
      hashType: Constants.SIGNING.HASHES.KECCAK256,
      payload,
      ...overrides,
    },
  };
  const res = await client.sign(tx);
  clientStorageCallback(client.getStateData());
  return res;
};

export const signMessage = async (payload: string, overrides?: any) => {
  validateClient();
  const tx = {
    data: {
      signerPath: DEFAULT_ETH_DERIVATION,
      curveType: Constants.SIGNING.CURVES.SECP256K1,
      hashType: Constants.SIGNING.HASHES.KECCAK256,
      payload,
      ...overrides,
    },
  };
  const res = await client.sign(tx);
  clientStorageCallback(client.getStateData());
  return res;
};
