import { getPublicKey, sign } from '@noble/bls12-381';
import {
  create as createKeystore,
  decrypt as decryptKeystore,
  verifyPassword,
  isValidKeystore,
} from '@chainsafe/bls-keystore';
import { deriveSeedTree } from 'bls12-381-keygen';
import { question } from 'readline-sync';

import { 
  initializeClient, 
  initializeSeed, 
} from '../../utils/initializeClient';
import { buildPath } from '../../utils/helpers'
import { Constants } from '../../../index'
import { getPathStr } from '../../../shared/utilities'

let client, seed;
const WITHDRAWAL_PATH_IDX = [
  12381, 3600, 0, 0
];
const DEPOSIT_PATH_IDX = [
  12381, 3600, 0, 0, 0
];
const N = 1;

async function testBLSDerivationAndSig(signerPath) {
  const signReq = {
    data: {
      signerPath,
      curveType: Constants.SIGNING.CURVES.BLS12_381_G2,
      hashType: Constants.SIGNING.HASHES.NONE,
      encodingType: Constants.SIGNING.ENCODINGS.NONE,
      payload: null,
    }
  }
  const msg = Buffer.from('64726e3da8', 'hex')
  signReq.data.payload = msg;
  const flag = Constants.GET_ADDR_FLAGS.BLS12_381_G1_PUB;
  const latticePubs = await client.getAddresses({ startPath: signerPath, flag });
  const latticeSig = await client.sign(signReq)
  const priv = deriveSeedTree(seed, buildPath(signerPath));
  const refPub = getPublicKey(priv);
  const refPubStr = Buffer.from(refPub).toString('hex')
  const refSig = await sign(msg, priv);
  const refSigStr = Buffer.from(refSig).toString('hex')
  expect(latticePubs[0].toString('hex')).to.equal(
    refPubStr, 
    'Deposit public key mismatch'
  );
  expect(latticeSig.pubkey.toString('hex')).to.equal(
    refPubStr, 
    'Lattice signature returned wrong pubkey'
  );
  expect(latticeSig.sig.toString('hex')).to.equal(
    refSigStr, 
    'Signature mismatch'
  );
}

async function validateExportedKeystore(path, pw, exportedKeystore) {
  const priv = deriveSeedTree(seed, buildPath(path));
  const pub = getPublicKey(priv);

  // Validate the keystore in isolation
  expect(isValidKeystore(exportedKeystore)).to.equal(true, 'Exported keystore invalid!');
  const expPwVerified = await verifyPassword(exportedKeystore, pw);
  expect(expPwVerified).to.equal(
    true, 
    `Password could not be verified in exported keystore. Expected "${pw}"`
  );
  const expDec = await decryptKeystore(exportedKeystore, pw);
  expect(Buffer.from(expDec).toString('hex')).to.equal(
    Buffer.from(priv).toString('hex'),
    'Exported keystore did not properly encrypt key!'
  );
  expect(exportedKeystore.pubkey).to.equal(
    Buffer.from(pub).toString('hex'),
    'Wrong public key exported from Lattice'
  );

  // Generate an independent keystore and compare decrypted contents
  const genKeystore = await createKeystore(pw, priv, pub, getPathStr(path));
  expect(isValidKeystore(genKeystore)).to.equal(true, 'Generated keystore invalid?');
  const genPwVerified = await verifyPassword(genKeystore, pw);
  expect(genPwVerified).to.equal(true, 'Password could not be verified in generated keystore?');
  const genDec = await decryptKeystore(genKeystore, pw);
  expect(Buffer.from(expDec).toString('hex')).to.equal(
    Buffer.from(genDec).toString('hex'),
    'Exported encrypted privkey did not match factory test example...'
  );
}

describe('[BLS]', () => {
  client = initializeClient();

  it('Should get the current wallet seed', async () => {
    seed = await initializeSeed(client);
  })

  // Test first 5 deposit keys
  for (let i = 0; i < N; i++) {
    const pathIdx = DEPOSIT_PATH_IDX;
    pathIdx[2] = i;
    it(`Should validate EIP2333 and signing at deposit index #${i}`, async () => {
      await testBLSDerivationAndSig(pathIdx);
    })
  }
  // Test first 5 withdrawal keys
  for (let i = 0; i < N; i++) {
    const pathIdx = WITHDRAWAL_PATH_IDX;
    pathIdx[2] = i;
    it(`Should validate EIP2333 and signing at withdrawal index #${i}`, async () => {
      await testBLSDerivationAndSig(pathIdx);
    })
  }

  it('Should export encrypted withdrawal private keys', async () => {
    const req = {
      schema: Constants.ENC_DATA.SCHEMAS.BLS_KEYSTORE_EIP2335_PBKDF_V4,
      params: {
        path: WITHDRAWAL_PATH_IDX,
        c: 999, // if this is not specified, the default value will be used
      }
    }
    // Get the device's encryption password
    const pw = await question(
      'Enter your Lattice encryption password: '
    );

    let encData;
    // Test custom iteration count (c)
    encData = await client.exportEncryptedData(req);
    await validateExportedKeystore(req.params.path, pw, encData);
    // Test different paths
    req.params.path = DEPOSIT_PATH_IDX;
    encData = await client.exportEncryptedData(req);
    await validateExportedKeystore(req.params.path, pw, encData);
    req.params.path[4] = 1847;
    encData = await client.exportEncryptedData(req);
    await validateExportedKeystore(req.params.path, pw, encData);
    // Test default iteration count
    req.params.c = undefined;
    encData = await client.exportEncryptedData(req);
    await validateExportedKeystore(req.params.path, pw, encData);
  })
})