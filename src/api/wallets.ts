import { queue } from './utilities';

/**
 * Fetches the active wallets
 */
export const fetchActiveWallets = async (): Promise<ActiveWallets> => {
  return queue((client) => client.fetchActiveWallet());
};
