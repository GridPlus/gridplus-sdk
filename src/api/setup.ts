import { Utils } from '..';
import { Client } from '../client';
import { setSaveClient, setLoadClient, saveClient, loadClient } from './state';
import { buildLoadClientFn, buildSaveClientFn, queue } from './utilities';

/**
 * @interface {Object} SetupParameters - paramaters for the setup function
 * @prop {string} SetupParameters.deviceId - the device id of the client
 * @prop {string} SetupParameters.password - the password of the client
 * @prop {string} SetupParameters.name - the name of the client
 * @prop {Function} SetupParameters.getStoredClient - a function that returns the stored client data
 * @prop {Function} SetupParameters.setStoredClient - a function that stores the client data
 */
type SetupParameters = {
  deviceId: string;
  password: string;
  name: string;
  getStoredClient: () => string;
  setStoredClient: (clientData: string | null) => void;
};

/**
 * `setup` initializes the Client and executes `connect()` if necessary. It returns a promise that
 * resolves to a boolean that indicates whether the Client is paired to the application to which it's
 * attempting to connect.
 *
 * @param {Object} SetupParameters - paramaters for the setup function
 * @param {string} SetupParameters.deviceId - the device id of the client
 * @param {string} SetupParameters.password - the password of the client
 * @param {string} SetupParameters.name - the name of the client
 * @param {Function} SetupParameters.getStoredClient - a function that returns the stored client data
 * @param {Function} SetupParameters.setStoredClient - a function that stores the client data
 * @returns {Promise<boolean>} - a promise that resolves to a boolean that indicates whether the Client is paired to the application to which it's attempting to connect
 *
 */
export const setup = async ({
  deviceId,
  password,
  name,
  getStoredClient,
  setStoredClient,
}: SetupParameters): Promise<boolean> => {
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

export const connect = async (deviceId: string): Promise<boolean> => {
  return queue((client) => client.connect(deviceId));
};

export const pair = async (pairingCode: string): Promise<boolean> => {
  return queue((client) => client.pair(pairingCode));
};
