import { HARDENED_OFFSET } from '../../src/constants';
import { Constants } from '../../src/index';
let test;

//---------------------------------------
// STATE DATA
//---------------------------------------
const DEFAULT_SIGNER = [
  HARDENED_OFFSET + 44,
  HARDENED_OFFSET + 60,
  HARDENED_OFFSET,
  0,
  0,
];
let req;

//---------------------------------------
// TESTS
//---------------------------------------
describe('Start unformatted signing tests', () => {
  test = global.test;
});

describe('[Unformatted]', () => {
  beforeEach(() => {
    test.expect(test.continue).to.equal(true, 'Error in previous test.');
    req = {
      data: {
        signerPath: DEFAULT_SIGNER,
        curveType: Constants.SIGNING.CURVES.SECP256K1,
        hashType: Constants.SIGNING.HASHES.KECCAK256,
        payload: null,
      },
    };
  });

  it('Should test pre-hashed messages', async () => {
    const { extraDataFrameSz, extraDataMaxFrames, genericSigning } =
      test.fwConstants;
    const { baseDataSz } = genericSigning;
    // Max size that won't be prehashed
    const maxSz = baseDataSz + extraDataMaxFrames * extraDataFrameSz;
    // Use extraData frames
    req.data.payload = `0x${test.helpers
      .prandomBuf(test.prng, maxSz, true)
      .toString('hex')}`;
    await test.runGeneric(req, test);
    if (!test.continue) {
      return;
    }
    // Prehash (keccak256)
    req.data.payload = `0x${test.helpers
      .prandomBuf(test.prng, maxSz + 1, true)
      .toString('hex')}`;
    await test.runGeneric(req, test);
    if (!test.continue) {
      return;
    }
    // Prehash (sha256)
    req.data.hashType = Constants.SIGNING.HASHES.SHA256;
    await test.runGeneric(req, test);
  });

  it('Should test ASCII text formatting', async () => {
    // Build a payload that uses spaces and newlines
    req.data.payload = JSON.stringify(
      {
        testPayload: 'json with spaces',
        anotherThing: -1,
      },
      null,
      2,
    );
    await test.runGeneric(req, test);
  });

  it('Should validate SECP256K1/KECCAK signature against dervied key', async () => {
    // ASCII message encoding
    req.data.payload = 'test';
    await test.runGeneric(req, test);
    if (!test.continue) {
      return;
    }
    // Hex message encoding
    req.data.payload = '0x123456';
    await test.runGeneric(req, test);
  });

  it('Should validate ED25519/NULL signature against dervied key', async () => {
    // Make generic signing request
    req.data.payload = '0x123456';
    req.data.curveType = Constants.SIGNING.CURVES.ED25519;
    req.data.hashType = Constants.SIGNING.HASHES.NONE;
    // ED25519 derivation requires hardened indices
    req.data.signerPath = DEFAULT_SIGNER.slice(0, 3);
    await test.runGeneric(req, test);
  });

  it('Should validate SECP256K1/KECCAK signature against ETH_MSG request (legacy)', async () => {
    // Generic request
    const msg = 'Testing personal_sign';
    const psMsg = test.helpers.ethPersonalSignMsg(msg);
    // NOTE: The request contains some non ASCII characters so it will get
    // encoded as hex automatically.
    req.data.payload = psMsg;
    // Legacy request
    const legacyReq = {
      currency: 'ETH_MSG',
      data: {
        signerPath: req.data.signerPath,
        payload: msg,
        protocol: 'signPersonal',
      },
    };
    const respGeneric = await test.runGeneric(req, test);
    const respLegacy = await test.client.sign(legacyReq);
    test.expect(!!respLegacy.err).to.equal(false, respLegacy.err);
    const genSig = `${respGeneric.sig.r.toString(
      'hex',
    )}${respGeneric.sig.s.toString('hex')}`;
    const legSig = `${respLegacy.sig.r.toString(
      'hex',
    )}${respLegacy.sig.s.toString('hex')}`;
    test
      .expect(genSig)
      .to.equal(legSig, 'Legacy and generic requests produced different sigs.');
  });

  it('Should test random payloads', async () => {
    for (let i = 0; i < test.numIter; i++) {
      req.data.payload = test.helpers.prandomBuf(
        test.prng,
        test.fwConstants.genericSigning.baseDataSz,
      );
      // 1. Secp256k1/keccak256
      req.data.curveType = Constants.SIGNING.CURVES.SECP256K1;
      req.data.hashType = Constants.SIGNING.HASHES.KECCAK256;
      await test.runGeneric(req, test);
      if (!test.continue) {
        return;
      }
      // 2. Secp256k1/sha256
      req.data.hashType = Constants.SIGNING.HASHES.SHA256;
      await test.runGeneric(req, test);
      if (!test.continue) {
        return;
      }
      // 3. Ed25519
      req.data.curveType = Constants.SIGNING.CURVES.ED25519;
      req.data.hashType = Constants.SIGNING.HASHES.NONE;
      req.data.signerPath = DEFAULT_SIGNER.slice(0, 3);
      await test.runGeneric(req, test);
      if (!test.continue) {
        return;
      }
    }
  });
});
