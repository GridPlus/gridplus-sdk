// Tests for internal Lattice Wallet Jobs
// NOTE: You must run the following BEFORE executing these tests:
//
// 1. Connect with the same deviceID you specfied in 1:
//
//    env DEVICE_ID='<your_device_id>' npm test
//
// After you do the above, you can run this test with `env DEVICE_ID='<your_device_id>' npm run test-wallet-jobs`
//
// NOTE: It is highly suggested that you set `AUTO_SIGN_DEV_ONLY=1` in the firmware
//        root CMakeLists.txt file (for dev units)
// To run these tests you will need a dev Lattice with: `FEATURE_TEST_RUNNER=1`

import { Byte } from "bitwise/types";
import { signingSchema } from "../src/constants";

const { expect } = require('chai');
const Sdk = require('../src/index');
const crypto = require('crypto');
const question = require('readline-sync').question;
import helpers from './testUtil/helpers';

const REUSABLE_KEY = '3fb53b677f73e4d2b8c89c303f6f6b349f0075ad88ea126cb9f6632085815dca';

//------------------------------------------------------------------------------
// Connect & Pair – HELPER
//------------------------------------------------------------------------------
const CONNECT_AND_PAIR_LATTICE = (
    env     = process.env,
    appName = 'Chaos Monkey [Test]',
    baseUrl = env.baseUrl || 'https://signing.gridpl.us',
    id      = () => env.DEVICE_ID || question('~ Enter Device ID: '),
    passwrd = () => env.REUSE_KEY == "1" ? REUSABLE_KEY : question('~ Enter device password: ', {hideEchoBack: true}),
    secret  = () => question('~ Enter pairing code: ')
) => new Promise((res, rej) => {
  console.log("~ Base URL: ", baseUrl);
  //--------------------------------------------------------------------------
  // Retrieve 'device ID'
  //--------------------------------------------------------------------------
  const deviceId = id()

  //--------------------------------------------------------------------------
  // Retrieve 'private key'
  //--------------------------------------------------------------------------
  const privateKey = (() =>  {
    const password = passwrd()
    const privKeyPreImage = Buffer.concat(
      [
        Buffer.from(deviceId),
        Buffer.from(password),
        Buffer.from(appName)
      ]
    )
    return crypto
      .createHash('sha256')
      .update(privKeyPreImage)
      .digest()
  })()

  //--------------------------------------------------------------------------
  // Create 'client'
  //--------------------------------------------------------------------------
  const clientOpts = {
    name: appName,
    baseUrl: baseUrl,
    crypto,
    timeout: 180000,
    privKey: privateKey
  }
  const client = new Sdk.Client(clientOpts)

  //--------------------------------------------------------------------------
  // Connect
  //--------------------------------------------------------------------------
  client.connect(deviceId, (err, isPaired) => {
    if (err) {
      rej(err)
    } else {
      if (!isPaired) {
        //--------------------------------------------------------------
        // Retrieve 'secret pairing code'
        //--------------------------------------------------------------
        const pairingCode = secret().toUpperCase()

        //--------------------------------------------------------------
        // Pair
        //--------------------------------------------------------------
        client.pair(pairingCode, (err, isActive) => {
          if (err || !isActive) {
            rej(err || new Error("No active wallet found!"))
          } else {
            res({ client, deviceId })
          }
        })
      } else {
        res({ client, deviceId })
      }
    }
  })
})

const CREATE_HDPATH = (hardened = true, coinType: number = 60, account = 0, index = 0): number[] => {
  const HARDENED_OFFSET: number = 0x80000000;
  return `m/44'/${coinType}'/0'/0/0`
    .split("/")
    .filter((component) => component != "m")
    .map((component) => {
      return Number(component.endsWith('\'') ? Number(component.slice(0, component.length - 1)) + HARDENED_OFFSET : component)
    })
}

const SIGN_MESSAGE = (message: string): Promise<any> => {
  return new Promise((resolved, rejected) => {
      CONNECT_AND_PAIR_LATTICE().then(context => {
          const data = {
              protocol: 'signPersonal',
              payload: message,
              signerPath: CREATE_HDPATH(),
          };
          const signOpts = {
              currency: 'ETH_MSG',
              data: data
          }

          //@ts-ignore
          context.client.sign(signOpts, (err: any, signedTx: Object) => {
              if (err) rejected(err)
              else resolved(signedTx)
          })
      })
  })
}

const GET_ADDRESSES = (): Promise<string[]> => {
  return new Promise((resolved, rejected) => {
      CONNECT_AND_PAIR_LATTICE().then((context) => {
        const req = {
          startPath: CREATE_HDPATH(),
          n: 2,
        };
        console.log(JSON.stringify(req, null, 2))

        //@ts-ignore
        context.client.getAddresses(req, (err: any, addresses: Object) => {
          if (err) rejected(err);
          else resolved(addresses as string[]);
        });
      });
  })
}

describe("Chaos Monkey", () => {
  it("Should 1", async () => {
    const signing   = async () => await SIGN_MESSAGE("This is a message")
    const addresses = async () => await GET_ADDRESSES()
    const answer = question(
      `
      ~ Run which test? (Timeout in 10 seconds)
      ~  1. Signature
      ~  2. Addresses
      ~  3. Quit
      `
    )
    switch(answer) {
      case "1": { await signing().then((res) => console.log(`${JSON.stringify(res, null, 2)}`)); return }
      case "2": { await addresses().then((res) => console.log(JSON.stringify(res, null, 2))); return }
      default:
    }
  });
});