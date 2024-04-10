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

const numRandom = getN() ? getN() : 20; // Number of random tests to conduct

describe('ETH Messages', () => {
  const client = initializeClient();

  describe('Test ETH EIP712', function () {
    it('Should test an example from Blur NFT w/ 0 fees', async () => {
      const msg = {
        types: {
          Order: [
            {
              name: 'trader',
              type: 'address',
            },
            {
              name: 'collection',
              type: 'address',
            },
            {
              name: 'listingsRoot',
              type: 'bytes32',
            },
            {
              name: 'numberOfListings',
              type: 'uint256',
            },
            {
              name: 'expirationTime',
              type: 'uint256',
            },
            {
              name: 'assetType',
              type: 'uint8',
            },
            {
              name: 'makerFee',
              type: 'FeeRate',
            },
            {
              name: 'salt',
              type: 'uint256',
            },
            {
              name: 'orderType',
              type: 'uint8',
            },
            {
              name: 'nonce',
              type: 'uint256',
            },
          ],
          FeeRate: [
            {
              name: 'recipient',
              type: 'address',
            },
            {
              name: 'rate',
              type: 'uint16',
            },
          ],
          EIP712Domain: [
            {
              name: 'name',
              type: 'string',
            },
            {
              name: 'version',
              type: 'string',
            },
            {
              name: 'chainId',
              type: 'uint256',
            },
            {
              name: 'verifyingContract',
              type: 'address',
            },
          ],
        },
        primaryType: 'Order',
        domain: {
          name: 'Blur Exchange',
          version: '1.0',
          chainId: '0x1',
          verifyingContract: '0xb2ecfe4e4d61f8790bbb9de2d1259b9e2410cea5',
        },
        message: {
          trader: '0xda55a246f0c3bf5b2153943275ea509200d66376',
          collection: '0xbd3531da5cf5857e7cfaa92426877b022e612cf8',
          listingsRoot:
            '0xefb82bb3b2b7ba85730df87a05350c006581c68eb637de0aa3cf929b4aa8f9d9',
          numberOfListings: '1',
          expirationTime: '1744203096',
          assetType: '0',
          makerFee: {
            recipient: '0x0000000000000000000000000000000000000000',
            rate: '0',
          },
          salt: '63193264783498669264107221564265348747',
          orderType: '1',
          nonce: '0',
        },
      };
      await runEthMsg(buildEthMsgReq(msg, 'eip712'), client);
    });
  });
});
