/* eslint-disable quotes */
import { question } from 'readline-sync';
import { fetchAddresses, pair } from '../../api';
import { setupClient } from '../utils/setup';
import { HARDENED_OFFSET } from '../../constants';

describe('bug', () => {
  test('pair', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }
  });

  test('fetch cosmos', async () => {
    await fetchAddresses({
      startPath: [
        HARDENED_OFFSET + 1852,
        HARDENED_OFFSET + 1815,
        HARDENED_OFFSET,
        0,
        0,
      ],
    });
  });
});
