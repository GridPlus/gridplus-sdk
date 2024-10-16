import { fetchActiveWallets, setup } from '../../api';
import { getDeviceId } from '../utils/getters';
import { setupTestClient } from '../utils/helpers';
import { getStoredClient, setStoredClient } from '../utils/setup';

/**
 * This test is used to test the interoperability between the Class-based API and the Functional API.
 */
describe('client interop', () => {
  it('should setup the Client, then use that client data to', async () => {
    const client = setupTestClient();
    const isPaired = await client.connect(getDeviceId());
    expect(isPaired).toBe(true);

    await setup({
      getStoredClient,
      setStoredClient,
    });

    const activeWallets = await fetchActiveWallets();
    expect(activeWallets).toBeTruthy();
  });
});
