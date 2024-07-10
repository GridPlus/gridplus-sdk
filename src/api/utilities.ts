import { Client } from '../client';
import {
  getFunctionQueue,
  loadClient,
  saveClient,
  setFunctionQueue,
} from './state';

/**
 * `queue` is a function that wraps all functional API calls. It limits the number of concurrent
 * requests to the server to 1, and ensures that the client state data is saved after each call.
 * This is necessary because the ephemeral public key must be updated after each successful request,
 * and two concurrent requests could result in the same key being used twice or the wrong key being
 * written to memory locally.
 *
 * @internal
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

export const buildSaveClientFn = (
  setStoredClient: (clientData: string | null) => void,
) => {
  return (clientData: string | null) => {
    if (!clientData) return;
    const encodedData = encodeClientData(clientData);
    setStoredClient(encodedData);
  };
};

export const buildLoadClientFn = (getStoredClient: () => string) => {
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
