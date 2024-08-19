/* eslint-disable quotes */
import { question } from 'readline-sync';
import { fetchAddresses, pair } from '../../api';
import { setupClient } from '../utils/setup';

describe('address fetching', () => {
  test('pair', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }
  });

  describe('iteration index', () => {
    test('different indexes should not have the same addresses', async () => {
      const addresses1 = await fetchAddresses({ iterIdx: 1 });
      const addresses2 = await fetchAddresses({ iterIdx: 2 });
      expect(addresses1).not.toEqual(addresses2);
    });
  });
});
