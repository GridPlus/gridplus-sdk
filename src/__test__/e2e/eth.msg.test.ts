/** Tests for ETH transaction edge cases
 * NOTE: You must run the following BEFORE executing these tests:
 *
 * 1. Pair with the device once. This will ask you for your deviceID, which will act as a salt for
 *    your pairing:
 *
 *    env REUSE_KEY=1 npm run test
 *
 * 2. Connect with the same deviceID you specfied in 1:
 *
 *    env DEVICE_ID='<your_device_id>' npm test
 *
 * After you do the above, you can run this test with `npm run test-eth`
 *
 * NOTE: It is highly suggested that you set `AUTO_SIGN_DEV_ONLY=1` in the firmware root
 *        CMakeLists.txt file (for dev units)
 */

import { HARDENED_OFFSET } from '../../constants';
import { randomBytes } from '../../util';
import { buildEthMsgReq, buildRandomMsg } from '../utils/builders';
import { getN } from '../utils/getters';
import { initializeClient } from '../utils/initializeClient';
import { runEthMsg } from '../utils/runners';

describe('ETH Messages', () => {
  const client = initializeClient();

  describe('Test ETH EIP712', function () {
    it('Should test Vertex message', async () => {
      const msg = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Order: [
            { name: 'sender', type: 'bytes32' },
            { name: 'priceX18', type: 'int128' },
            { name: 'amount', type: 'int128' },
            { name: 'expiration', type: 'uint64' },
            { name: 'nonce', type: 'uint64' },
          ],
        },
        primaryType: 'Order',
        domain: {
          name: 'Vertex',
          version: '0.0.1',
          chainId: '42161',
          verifyingContract: '0xf03f457a30e598d5020164a339727ef40f2b8fbc',
        },
        message: {
          sender:
            '0x841fe4876763357975d60da128d8a54bb045d76a64656661756c740000000000',
          priceX18: '28898000000000000000000',
          amount: '-10000000000000000',
          expiration: '4611687701117784255',
          nonce: '1764428860167815857',
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });
  });
});
