import { expect } from 'chai';
import seedrandom from 'seedrandom';
import helpers from './testUtil/helpers';
import { getFwVersionConst, HARDENED_OFFSET } from '../src/constants'

let client, req, continueTests = true;;
// const prng = new seedrandom(process.env.SEED || 'myrandomseed');
// let numRandom = process.env.N || 20;
const DEFAULT_SIGNER = [
  helpers.BTC_PURPOSE_P2PKH,
  helpers.ETH_COIN,
  HARDENED_OFFSET,
  0,
  0,
];

describe('Setup client', () => {
  it('Should setup the test client', () => {
    client = helpers.setupTestClient(process.env);
    expect(client).to.not.equal(null);
  });

  it('Should connect to a Lattice and make sure it is already paired.', async () => {
    // Again, we assume that if an `id` has already been set, we are paired
    // with the hardcoded privkey above.
    expect(process.env.DEVICE_ID).to.not.equal(null);
    const connectErr = await helpers.connect(client, process.env.DEVICE_ID);
    expect(connectErr).to.equal(null);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);
    // Set the correct max gas price based on firmware version
    const fwConstants = getFwVersionConst(client.fwVersion);
    if (!fwConstants.genericSigning) {
      continueTests = false;
      expect(true).to.equal(false, 'Firmware must be updated to run this test.')
    }
  });
});

describe('Test generic signing limits', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Error in previous test.');
    req = {
      data: {
        signerPath: DEFAULT_SIGNER,
        curveType: 'SECP256K1',
        hashType: 'KECCAK256',
        payload: null,
      }
    };
  })

  it('Should test a generic message', async () => {
    req.data.payload = '0x123456'
    const resp = await helpers.execute(client, 'sign', req)
    console.log(resp)
  })
})

