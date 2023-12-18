import { Utils, connect } from '..';
import { Client } from '../client';
import {
  getFunctionQueue,
  loadClient,
  saveClient,
  setFunctionQueue,
  setLoadClient,
  setSaveClient,
} from './state';

/**
 * `setup` initializes the Client and executes `connect()` if necessary. It returns a promise that
 * resolves to a boolean that indicates whether the Client is paired to the application to which it's
 * attempting to connect.
 */
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
  setSaveClient(buildSaveClientFn(setStoredClient));

  if (!setStoredClient) throw new Error('Client data setter required');
  setLoadClient(buildLoadClientFn(getStoredClient));

  if (deviceId && password && name) {
    const privKey = Utils.generateAppSecret(deviceId, password, name);
    const client = new Client({ deviceId, privKey, name });
    return client.connect(deviceId).then((isPaired) => {
      saveClient(client.getStateData());
      return isPaired;
    });
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

/**
 * `queue` is a function that wraps all functional API calls. It limits the number of concurrent
 * requests to the server to 1, and ensures that the client state data is saved after each call.
 * This is necessary because the ephemeral public key must be updated after each successful request,
 * and two concurrent requests could result in the same key being used twice or the wrong key being
 * written to memory locally.
 */
export const queue = (fn: (client: Client) => Promise<any>) => {
  const client = loadClient();
  if (!client) throw new Error('Client not initialized');
  if (!getFunctionQueue()) {
    setFunctionQueue(Promise.resolve());
  }
  setFunctionQueue(
    getFunctionQueue().then(() =>
      fn(client)
        .catch((err) => {
          // Empty the queue if any function call fails
          setFunctionQueue(Promise.resolve());
          throw err;
        })
        .then((returnValue) => {
          saveClient(client.getStateData());
          return returnValue;
        }),
    ),
  );
  return getFunctionQueue();
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
    if (!clientData) return undefined;
    const stateData = decodeClientData(clientData);
    if (!stateData) return undefined;
    const client = new Client({ stateData });
    if (!client) throw new Error('Client not initialized');
    return client;
  };
};

export const getStartPath = (
  defaultStartPath: number[],
  addressIndex = 0, // The value to increment `defaultStartPath`
  pathIndex = 4, // Which index in `defaultStartPath` array to increment
): number[] => {
  const startPath = defaultStartPath;
  if (addressIndex > 0) {
    startPath[pathIndex] = defaultStartPath[pathIndex] + addressIndex;
  }
  return startPath;
};

export const isEIP712Payload = (payload: any) =>
  typeof payload !== 'string' &&
  'types' in payload &&
  'domain' in payload &&
  'primaryType' in payload &&
  'message' in payload;
