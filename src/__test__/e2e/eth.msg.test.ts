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
import { SigningPath } from '../../types';
import { randomBytes } from '../../util';
import { buildEthMsgReq, buildRandomMsg } from '../utils/builders';
import { runEthMsg } from '../utils/runners';
import { setupClient } from '../utils/setup';

describe('ETH Messages', () => {
  let client;

  test('pair', async () => {
    client = await setupClient();
  });

  it('Should test ASCII buffers', async () => {
    await runEthMsg(
      buildEthMsgReq(Buffer.from('i am an ascii buffer'), 'signPersonal'),
      client,
    );
    await runEthMsg(
      buildEthMsgReq(Buffer.from('{\n\ttest: foo\n}'), 'signPersonal'),
      client,
    );
  });
});
