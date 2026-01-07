/**
 * Test BLS key derivation and signatures as well as EIP2335
 * keystore export.
 * Note that all signingtests use the NUL DST, which is not used
 * for ETH2 stuff (that uses POP). However, we are just trying to
 * validate the BLS cryptography.
 *
 * For ETH2-specific operations, see `lattice-eth2-utils`:
 * https://github.com/GridPlus/lattice-eth2-utils
 *
 * REQUIRED TEST MNEMONIC:
 * These tests require a SafeCard loaded with the standard test mnemonic:
 * "test test test test test test test test test test test junk"
 *
 * Running with a different mnemonic will cause test failures due to
 * incorrect key derivations.
 */
import {
  create as createKeystore,
  decrypt as decryptKeystore,
  isValidKeystore,
  verifyPassword,
} from '@chainsafe/bls-keystore';
import { getPublicKey, sign } from '@noble/bls12-381';
import { deriveSeedTree } from 'bls12-381-keygen';
import { question } from 'readline-sync';

import { Constants } from '../../../index';
import { getPathStr } from '../../../shared/utilities';
import { setupClient } from '../../utils/setup';
import { getEncPw } from '../../utils/getters';
import { buildPath } from '../../utils/helpers';
import { TEST_SEED } from '../../utils/testConstants';

let client, encPw, supportsBLS;
const DEPOSIT_PATH = [12381, 3600, 0, 0, 0];
const WITHDRAWAL_PATH = [12381, 3600, 0, 0];
// Number of signers to test for each of deposit and withdrawal paths
const N_TEST_SIGS = 5;
const KNOWN_SEED = TEST_SEED;

describe('[BLS keys]', () => {
  beforeAll(async () => {
    client = await setupClient();
    if (process.env.CI) {
      encPw = process.env.ENC_PW;
    } else {
      encPw = getEncPw();
      if (!encPw) {
        encPw = await question('Enter your Lattice encryption password: ');
      }
    }

    // Check if firmware supports BLS (requires >= 0.17.0)
    const fwVersion = client.fwVersion;
    const versionStr =
      fwVersion && fwVersion.length >= 3
        ? `${fwVersion[2]}.${fwVersion[1]}.${fwVersion[0]}`
        : 'unknown';

    console.log(`\n[BLS Test] Firmware version: ${versionStr}`);
    console.log(`[BLS Test] Raw fwVersion buffer:`, fwVersion);

    const fwConstants = client.getFwConstants();
    console.log(`[BLS Test] getAddressFlags:`, fwConstants?.getAddressFlags);
    console.log(
      `[BLS Test] BLS12_381_G1_PUB constant:`,
      Constants.GET_ADDR_FLAGS.BLS12_381_G1_PUB,
    );

    supportsBLS = fwConstants?.getAddressFlags?.includes(
      Constants.GET_ADDR_FLAGS.BLS12_381_G1_PUB,
    );

    console.log(`[BLS Test] supportsBLS: ${supportsBLS}\n`);

    if (!supportsBLS) {
      console.warn(
        `\nSkipping BLS tests: Firmware version ${versionStr} does not support BLS operations.\n` +
          `BLS support requires firmware version >= 0.17.0\n`,
      );
    }
  });

  it('Should validate exported EIP2335 keystores', async (ctx) => {
    if (!supportsBLS) {
      ctx.skip();
      return;
    }
    const req = {
      schema: Constants.ENC_DATA.SCHEMAS.BLS_KEYSTORE_EIP2335_PBKDF_V4,
      params: {
        path: WITHDRAWAL_PATH,
        c: 999, // if this is not specified, the default value will be used
      },
    };
    let encData;
    // Test custom iteration count (c)
    encData = await client.fetchEncryptedData(req);
    await validateExportedKeystore(KNOWN_SEED, req.params.path, encPw, encData);
    // Test different paths
    req.params.path = DEPOSIT_PATH;
    encData = await client.fetchEncryptedData(req);
    await validateExportedKeystore(KNOWN_SEED, req.params.path, encPw, encData);
    req.params.path[4] = 1847;
    encData = await client.fetchEncryptedData(req);
    await validateExportedKeystore(KNOWN_SEED, req.params.path, encPw, encData);
    // Test default values
    req.params.path = DEPOSIT_PATH;
    req.params.c = undefined;
    encData = await client.fetchEncryptedData(req);
    await validateExportedKeystore(KNOWN_SEED, req.params.path, encPw, encData);
  });

  for (let i = 0; i < N_TEST_SIGS; i++) {
    describe(`[Validate Derived Signature #${i + 1}/${N_TEST_SIGS}]`, () => {
      it(`Should validate derivation and signing at deposit index #${
        i + 1
      }`, async (ctx) => {
        if (!supportsBLS) {
          ctx.skip();
          return;
        }
        const depositPath = JSON.parse(JSON.stringify(DEPOSIT_PATH));
        depositPath[2] = i;
        await testBLSDerivationAndSig(KNOWN_SEED, depositPath);
      });

      it(`Should validate derivation and signing at withdrawal index #${
        i + 1
      }`, async (ctx) => {
        if (!supportsBLS) {
          ctx.skip();
          return;
        }
        const withdrawalPath = JSON.parse(JSON.stringify(WITHDRAWAL_PATH));
        withdrawalPath[2] = i;
        await testBLSDerivationAndSig(KNOWN_SEED, withdrawalPath);
      });
    });
  }
});

//=========================================================
// INTERNAL HELPERS
//=========================================================
async function getBLSPub(startPath) {
  const pubs = await client.getAddresses({
    startPath,
    flag: Constants.GET_ADDR_FLAGS.BLS12_381_G1_PUB,
  });
  return pubs[0];
}

async function signBLS(signerPath, message) {
  const signReq = {
    data: {
      signerPath,
      curveType: Constants.SIGNING.CURVES.BLS12_381_G2,
      hashType: Constants.SIGNING.HASHES.NONE,
      encodingType: Constants.SIGNING.ENCODINGS.NONE,
      payload: message,
    },
  };
  return await client.sign(signReq);
}

async function testBLSDerivationAndSig(seed, signerPath) {
  const msg = Buffer.from('64726e3da8', 'hex');
  const priv = deriveSeedTree(seed, buildPath(signerPath));
  const latticePub = await getBLSPub(signerPath);
  const latticeSig = await signBLS(signerPath, msg);
  const refPub = getPublicKey(priv);
  const refPubStr = Buffer.from(refPub).toString('hex');
  const refSig = await sign(msg, priv);
  const refSigStr = Buffer.from(refSig).toString('hex');
  expect(latticePub.toString('hex')).to.equal(
    refPubStr,
    'Deposit public key mismatch',
  );
  expect(latticeSig.pubkey.toString('hex')).to.equal(
    refPubStr,
    'Lattice signature returned wrong pubkey',
  );
  expect(latticeSig.sig.toString('hex')).to.equal(
    refSigStr,
    'Signature mismatch',
  );
}
async function validateExportedKeystore(seed, path, pw, expKeystoreBuffer) {
  const exportedKeystore = JSON.parse(expKeystoreBuffer.toString());
  const priv = deriveSeedTree(seed, buildPath(path));
  const pub = getPublicKey(priv);

  // Validate the keystore in isolation
  expect(isValidKeystore(exportedKeystore)).to.equal(
    true,
    'Exported keystore invalid!',
  );
  const expPwVerified = await verifyPassword(exportedKeystore, pw);
  expect(expPwVerified).to.equal(
    true,
    `Password could not be verified in exported keystore. Expected "${pw}"`,
  );
  const expDec = await decryptKeystore(exportedKeystore, pw);
  expect(Buffer.from(expDec).toString('hex')).to.equal(
    Buffer.from(priv).toString('hex'),
    'Exported keystore did not properly encrypt key!',
  );
  expect(exportedKeystore.pubkey).to.equal(
    Buffer.from(pub).toString('hex'),
    'Wrong public key exported from Lattice',
  );

  // Generate an independent keystore and compare decrypted contents
  const genKeystore = await createKeystore(pw, priv, pub, getPathStr(path));
  expect(isValidKeystore(genKeystore)).to.equal(
    true,
    'Generated keystore invalid?',
  );
  const genPwVerified = await verifyPassword(genKeystore, pw);
  expect(genPwVerified).to.equal(
    true,
    'Password could not be verified in generated keystore?',
  );
  const genDec = await decryptKeystore(genKeystore, pw);
  expect(Buffer.from(expDec).toString('hex')).to.equal(
    Buffer.from(genDec).toString('hex'),
    'Exported encrypted privkey did not match factory test example...',
  );
}
