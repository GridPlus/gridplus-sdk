// Tests for Isolated & Fuzzy SDK testing NOTE: You must run the following BEFORE executing these
// tests:
//
// 1. Connect with the same deviceID you specfied in 1:
//
//    env DEVICE_ID='<your_device_id>' npm run test-chaos-money
//
// 2. You can optionally specify an `baseUrl`:
//
//    env DEVICE_ID='<your_device_id>' baseUrl='<http://local-ip:3000>' npm run test-chaos-money
//
// NOTE: It is highly suggested that you set `AUTO_SIGN_DEV_ONLY=1` in the firmware root
//        CMakeLists.txt file (for dev units) To run these tests you will need a dev Lattice with:
//        `FEATURE_TEST_RUNNER=1`

import { Client } from '../../client';
import { question } from 'readline-sync';
import { generateAppSecret } from '../../util';

const REUSABLE_KEY =
  '3fb53b677f73e4d2b8c89c303f6f6b349f0075ad88ea126cb9f6632085815dca';

//------------------------------------------------------------------------------
// Connect & Pair - HELPER
//------------------------------------------------------------------------------
const connectAndPairLattice = async (
  env = process.env,
  appName = 'Chaos Monkey [Test]',
  baseUrl = env.baseUrl || 'https://signing.gridpl.us',
  id = () => env.DEVICE_ID || question('~ Enter Device ID: '),
  password = () =>
    env.REUSE_KEY === '1'
      ? REUSABLE_KEY
      : question('~ Enter device password: ', { hideEchoBack: true }),
  secret = () => question('~ Enter pairing code: '),
) => {
  console.log('~ Base URL: ', baseUrl);
  const deviceId = id();
  const privateKey = (() => {
    const _password = password();
    const token = generateAppSecret(
      Buffer.from(deviceId),
      Buffer.from(_password),
      Buffer.from(appName),
    );
    return token;
  })();

  //--------------------------------------------------------------------------
  // Create 'client'
  //--------------------------------------------------------------------------
  const client = new Client({
    name: appName,
    baseUrl: baseUrl,
    timeout: 180000,
    privKey: privateKey,
    skipRetryOnWrongWallet: false,
  });

  await client.connect(deviceId).then(async (isPaired) => {
    if (!isPaired) {
      const pairingCode = secret().toUpperCase();
      await client.pair(pairingCode).then((isActive) => {
        if (!isActive) {
          throw new Error('No active wallet found!');
        }
      });
    }
  });

  return { client, deviceId };
};

const createHdPath = (
  // Unused params: hardened = true, account = 0, index = 0,
  coinType = 60,
): number[] => {
  const HARDENED_OFFSET = 0x80000000;
  return `m/44'/${coinType}'/0'/0/0`
    .split('/')
    .filter((component) => component !== 'm')
    .map((component) => {
      return Number(
        component.endsWith('\'')
          ? Number(component.slice(0, component.length - 1)) + HARDENED_OFFSET
          : component,
      );
    });
};

const signMessage = (message: string): Promise<any> => {
  return connectAndPairLattice().then(({ client }) =>
    client.sign({
      currency: 'ETH_MSG',
      data: {
        protocol: 'signPersonal',
        payload: message,
        signerPath: createHdPath(),
      },
    }),
  );
};

const getAddresses = (): Promise<string[] | Buffer[]> => {
  return connectAndPairLattice().then(({ client }) =>
    client.getAddresses({
      startPath: createHdPath(),
      n: 2,
    }),
  );
};

describe('Chaos Monkey', () => {
  it('Should 1', async () => {
    const answer = question(
      `
      ~ Run which test? (Timeout in 10 seconds)
      ~  1. Signature
      ~  2. Addresses
      ~  3. Quit
      `,
    );
    switch (answer) {
      case '1': {
        return signMessage('This is a message')
          .catch(console.error)
          .then((res) => console.log(`${JSON.stringify(res, null, 2)}`));
      }
      case '2': {
        return getAddresses()
          .catch(console.error)
          .then((res) => console.log(JSON.stringify(res, null, 2)));
      }
      default:
        return;
    }
  });
});
