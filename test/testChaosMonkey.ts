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

import { sha256 } from 'hash.js/lib/hash/sha';
import { Client } from '../src/index';
import { question } from 'readline-sync';

const REUSABLE_KEY =
  '3fb53b677f73e4d2b8c89c303f6f6b349f0075ad88ea126cb9f6632085815dca';

//------------------------------------------------------------------------------
// Connect & Pair - HELPER
//------------------------------------------------------------------------------
const CONNECT_AND_PAIR_LATTICE = (
  env = process.env,
  appName = 'Chaos Monkey [Test]',
  baseUrl = env.baseUrl || 'https://signing.gridpl.us',
  id = () => env.DEVICE_ID || question('~ Enter Device ID: '),
  passwrd = () =>
    env.REUSE_KEY === '1'
      ? REUSABLE_KEY
      : question('~ Enter device password: ', { hideEchoBack: true }),
  secret = () => question('~ Enter pairing code: '),
) =>
  new Promise((res, rej) => {
    console.log('~ Base URL: ', baseUrl);
    //--------------------------------------------------------------------------
    // Retrieve 'device ID'
    //--------------------------------------------------------------------------
    const deviceId = id();

    //--------------------------------------------------------------------------
    // Retrieve 'private key'
    //--------------------------------------------------------------------------
    const privateKey = (() => {
      const password = passwrd();
      const privKeyPreImage = Buffer.concat([
        Buffer.from(deviceId),
        Buffer.from(password),
        Buffer.from(appName),
      ]);
      return Buffer.from(sha256().update(privKeyPreImage).digest('hex'), 'hex');
    })();

    //--------------------------------------------------------------------------
    // Create 'client'
    //--------------------------------------------------------------------------
    const clientOpts = {
      name: appName,
      baseUrl: baseUrl,
      timeout: 180000,
      privKey: privateKey,
      skipRetryOnWrongWallet: false,
    };
    // @ts-expect-error - Wrong buffer type
    const client = new Client(clientOpts);

    //--------------------------------------------------------------------------
    // Connect
    //--------------------------------------------------------------------------
    client.connect(deviceId, (err: any, isPaired: any) => {
      if (err) {
        rej(err);
      } else {
        if (!isPaired) {
          //--------------------------------------------------------------
          // Retrieve 'secret pairing code'
          //--------------------------------------------------------------
          const pairingCode = secret().toUpperCase();

          //--------------------------------------------------------------
          // Pair
          //--------------------------------------------------------------
          client.pair(pairingCode, (err: any, isActive: any) => {
            if (err || !isActive) {
              rej(err || new Error('No active wallet found!'));
            } else {
              res({ client, deviceId });
            }
          });
        } else {
          res({ client, deviceId });
        }
      }
    });
  });

const CREATE_HDPATH = (
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

const SIGN_MESSAGE = (message: string): Promise<any> => {
  return new Promise((resolved, rejected) => {
    CONNECT_AND_PAIR_LATTICE().then((context: any) => {
      const data = {
        protocol: 'signPersonal',
        payload: message,
        signerPath: CREATE_HDPATH(),
      };
      const signOpts = {
        currency: 'ETH_MSG',
        data: data,
      };

      context.client.sign(signOpts, (err: any, signedTx: any) => {
        if (err) rejected(err);
        else resolved(signedTx);
      });
    });
  });
};

const GET_ADDRESSES = (): Promise<string[]> => {
  return new Promise((resolved, rejected) => {
    CONNECT_AND_PAIR_LATTICE().then((context: any) => {
      const req = {
        startPath: CREATE_HDPATH(),
        n: 2,
      };
      console.log(JSON.stringify(req, null, 2));

      context.client.getAddresses(req, (err: any, addresses: any) => {
        if (err) rejected(err);
        else resolved(addresses as string[]);
      });
    });
  });
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
        await SIGN_MESSAGE('This is a message')
          .catch(console.error)
          .then((res) => console.log(`${JSON.stringify(res, null, 2)}`));
        return;
      }
      case '2': {
        await GET_ADDRESSES()
          .catch(console.error)
          .then((res) => console.log(JSON.stringify(res, null, 2)));
        return;
      }
      default:
    }
  });
});
