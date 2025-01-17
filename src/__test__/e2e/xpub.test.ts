/* eslint-disable quotes */
import { question } from 'readline-sync';
import { fetchAddressesByDerivationPath, pair } from '../../api';
import { setupClient } from '../utils/setup';
import { LatticeGetAddressesFlag } from '../../protocol';

describe('XPUB', () => {
  test('pair', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      console.log('secret', secret);
      await pair(secret.toUpperCase());
    }
  });

    test('fetch bitcoin xpub', async () => {
    const xpub = await fetchAddressesByDerivationPath("44'/0'/0'", {
      flag: LatticeGetAddressesFlag.secp256k1Xpub,
    });
    expect(xpub).toHaveLength(1);
    expect(xpub[0].startsWith('xpub')).toBe(true);
  });
});
