/* eslint-disable quotes */
import { fetchAddressesByDerivationPath, pair } from '../../api';
import { setupClient } from '../utils/clientStorage';
import { LatticeGetAddressesFlag } from '../../protocol';

describe('XPUB', () => {
  beforeAll(async () => {
    await setupClient();
  });

  test('fetch bitcoin xpub', async () => {
    const xpub = await fetchAddressesByDerivationPath("44'/0'/0'", {
      flag: LatticeGetAddressesFlag.secp256k1Xpub,
    });
    expect(xpub).toHaveLength(1);
    expect(xpub[0].startsWith('xpub')).toBe(true);
  });
});
