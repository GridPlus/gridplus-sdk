import { connect, Utils } from '..';
import { Client } from '../client';

let saveClient: (clientData: string | null) => void;
let loadClient: () => Client | undefined;

export const setup = async ({
  deviceId,
  password,
  name,
  getStoredClient,
  setStoredClient,
}: {
  deviceId?: string;
  password?: string;
  name?: string;
  getStoredClient: () => string;
  setStoredClient: (clientData: string | null) => void;
}) => {
  if (!getStoredClient) throw new Error('Client data getter required');
  saveClient = buildSaveClientFn(setStoredClient);

  if (!setStoredClient) throw new Error('Client data setter required');
  loadClient = buildLoadClientFn(getStoredClient);

  if (deviceId && password && name) {
    const privKey = Utils.generateAppSecret(deviceId, password, name);
    const client = new Client({ deviceId, privKey, name });
    saveClient(client.getStateData());
    return connect(deviceId);
  } else {
    const client = loadClient();
    if (!client) throw new Error('Client not initialized');
    const deviceId = client.getDeviceId();
    if (!client.ephemeralPub && deviceId) {
      return connect(deviceId);
    } else {
      saveClient(client.getStateData());
      return Promise.resolve(true);
    }
  }
};

let functionQueue: Promise<any>;

export const queue = (fn: (client: Client) => Promise<any>) => {
  const client = loadClient();
  if (!client) throw new Error('Client not initialized');
  if (!functionQueue) {
    functionQueue = Promise.resolve();
  }
  functionQueue = functionQueue.then(() =>
    fn(client)
      .catch((err) => {
        // Empty the queue if any function call fails
        functionQueue = Promise.resolve();
        throw err;
      })
      .finally(() => {
        saveClient(client.getStateData());
      }),
  );
  return functionQueue;
};

export const getClient = () => (loadClient ? loadClient() : null);

const encodeClientData = (clientData: string) => {
  return Buffer.from(clientData).toString('base64');
};

const decodeClientData = (clientData: string) => {
  return Buffer.from(clientData, 'base64').toString();
};

const buildSaveClientFn = (
  setStoredClient: (clientData: string | null) => void,
) => {
  return (clientData: string | null) => {
    if (!clientData) return;
    const encodedData = encodeClientData(clientData);
    setStoredClient(encodedData);
  };
};

const buildLoadClientFn = (getStoredClient: () => string) => {
  return () => {
    const clientData = getStoredClient();
    const stateData = decodeClientData(clientData);
    if (!stateData) return undefined;
    const client = new Client({ stateData });
    if (!client) throw new Error('Client not initialized');
    return client;
  };
};
