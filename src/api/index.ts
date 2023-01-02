export { getClient, setup } from './utilities';
import { queue } from './utilities';

export const connect = async (deviceId: string): Promise<boolean> => {
  return queue((client) => client.connect(deviceId));
};

export const pair = async (pairingCode: string): Promise<boolean> => {
  return queue((client) => client.pair(pairingCode));
};

export const fetchActiveWallets = async (): Promise<ActiveWallets> => {
  return queue((client) => client.fetchActiveWallet());
};

export * from './addresses';
export * from './addressTags';
export * from './signing';
