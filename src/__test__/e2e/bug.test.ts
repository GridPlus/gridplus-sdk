/* eslint-disable quotes */
import { question } from 'readline-sync';
import { fetchAddressesByDerivationPath, pair } from '../../api';
import { setupClient } from '../utils/setup';

describe('bug', () => {
  test('pair', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }
  });

  test('fetch cosmos', async () => {
    await fetchAddressesByDerivationPath(`1852'/1815'/0'/0/0`);
  });
});
