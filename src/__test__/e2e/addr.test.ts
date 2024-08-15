/* eslint-disable quotes */
import { question } from 'readline-sync';
import { fetchAddresses, pair } from '../../api';
import { setupClient } from '../utils/setup';

describe('addr test', () => {
  test('pair', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }
  });

  describe('addresses', () => {
    describe('fetchAddresses', () => {
      test('fetchAddresses', async () => {
        const addresses = await fetchAddresses();
        console.log(addresses);
        const addresses2 = await fetchAddresses({ iterIdx: 1 });
        console.log(addresses2);
        expect(addresses).toHaveLength(10);
      });
    });
  });
});
