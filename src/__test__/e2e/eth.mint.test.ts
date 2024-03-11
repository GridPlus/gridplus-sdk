import { getN } from '../utils/getters';
import { initializeClient } from '../utils/initializeClient';

describe('ETH Mint', () => {
  const client = initializeClient();

  describe('Test ETH Mint', function () {
    it('Should throw error when message contains non-ASCII characters', async () => {
      client.sign({
        data: {
          payload: {
            type: 'Buffer',
            data: [
              2, 242, 1, 107, 132, 1, 228, 17, 4, 133, 21, 146, 233, 144, 112,
              130, 124, 75, 148, 247, 13, 169, 120, 18, 203, 150, 172, 223, 129,
              7, 18, 170, 86, 45, 184, 223, 163, 219, 239, 135, 20, 218, 21,
              229, 168, 224, 88, 131, 23, 213, 97, 192,
            ],
          },
          curveType: 0,
          hashType: 1,
          encodingType: 4,
          signerPath: [2147483692, 2147483708, 2147483648, 0, 0],
        },
      });
    });
  });
});
