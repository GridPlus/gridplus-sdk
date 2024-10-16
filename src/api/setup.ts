import { Utils } from '..';
import { Client } from '../client';
import { setSaveClient, setLoadClient, saveClient, loadClient } from './state';
import { buildLoadClientFn, buildSaveClientFn, queue } from './utilities';

/**
 * @interface {Object} SetupParameters - parameters for the setup function
 * @prop {string} SetupParameters.deviceId - the device id of the client
 * @prop {string} SetupParameters.password - the password of the client
 * @prop {string} SetupParameters.name - the name of the client
 * @prop {string} SetupParameters.appSecret - the app secret of the client
 * @prop {Function} SetupParameters.getStoredClient - a function that returns the stored client data
 * @prop {Function} SetupParameters.setStoredClient - a function that stores the client data
 */
type SetupParameters =
  | {
      deviceId: string;
      password: string;
      name: string;
      appSecret?: string;
      getStoredClient: () => Promise<string>;
      setStoredClient: (clientData: string | null) => Promise<void>;
    }
  | {
      getStoredClient: () => Promise<string>;
      setStoredClient: (clientData: string | null) => Promise<void>;
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
 * @param {string} SetupParameters.appSecret - the app secret of the client
 * @param {Function} SetupParameters.getStoredClient - a function that returns the stored client data
 * @param {Function} SetupParameters.setStoredClient - a function that stores the client data
 * @returns {Promise<boolean>} - a promise that resolves to a boolean that indicates whether the Client is paired to the application to which it's attempting to connect
 *
 */
export const setup = async (params: SetupParameters): Promise<boolean> => {
  if (!params.getStoredClient) throw new Error('Client data getter required');
  setLoadClient(buildLoadClientFn(params.getStoredClient));

  if (!params.setStoredClient) throw new Error('Client data setter required');
  setSaveClient(buildSaveClientFn(params.setStoredClient));

  if ('deviceId' in params && 'password' in params && 'name' in params) {
    const privKey =
      params.appSecret ||
      Utils.generateAppSecret(params.deviceId, params.password, params.name);
    const client = new Client({
      deviceId: params.deviceId,
      privKey,
      name: params.name,
    });
    return client.connect(params.deviceId).then(async (isPaired) => {
      await saveClient(client.getStateData());
      return isPaired;
    });
  } else {
    const client = await loadClient();
    if (!client) throw new Error('Client not initialized');
    const deviceId = client.getDeviceId();
    if (!client.ephemeralPub && deviceId) {
      return connect(deviceId);
    } else {
      await saveClient(client.getStateData());
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
