import { getPublicKey, sign } from '@noble/bls12-381';
import {
  create as createKeystore,
  decrypt as decryptKeystore,
  verifyPassword,
  isValidKeystore,
} from '@chainsafe/bls-keystore';
import { mnemonicToSeedSync } from 'bip39';
import { deriveSeedTree } from 'bls12-381-keygen';
import { readFileSync } from 'fs';
import { jsonc } from 'jsonc';
import { question } from 'readline-sync';

import { getEncPw } from '../../utils/getters';
import { 
  initializeClient, 
  initializeSeed, 
} from '../../utils/initializeClient';
import { 
  buildPath, 
  copyBuffer,
  getCodeMsg,
  gpErrors, 
  jobTypes, 
  parseWalletJobResp, 
  serializeJobData 
} from '../../utils/helpers';
import { testRequest } from '../../utils/testRequest';
import { Constants, Utils } from '../../../index';
import { getPathStr } from '../../../shared/utilities';

const globalVectors = jsonc.parse(
  readFileSync(`${process.cwd()}/src/__test__/vectors.jsonc`).toString(),
);

let client, origWalletSeed, encPw;
const keystores = [];
const WITHDRAWAL_PATH = globalVectors.ethDeposit.depositData[0].withdrawalPath;
const DEPOSIT_PATH = globalVectors.ethDeposit.depositData[1].depositPath;
// Number of signers to test for each of deposit and withdrawal paths
const N_TEST_SIGS = 1;
// Number of deposit keys against which to validate deposit data
const N_TEST_DEPOSIT_DATA = 1;
const KNOWN_MNEMONIC = globalVectors.ethDeposit.mnemonic;
const KNOWN_SEED = mnemonicToSeedSync(KNOWN_MNEMONIC);

describe('[BLS keys]', () => {
  client = initializeClient();
  it('Should get the device encryption password', async () => {
    encPw = getEncPw();
    if (!encPw) {
      encPw = await question(
        'Enter your Lattice encryption password: '
      );
    }
  })

  /*
  it('Should get the current wallet seed', async () => {
    origWalletSeed = await initializeSeed(client);
  })

  it('Should remove the current seed and load a known one', async () => {
    // 1. Remove seed
    await removeSeed(client);
    // 2. Load known seed
    await loadSeed(client, KNOWN_SEED, KNOWN_MNEMONIC);
  })

  for (let i = 0; i < N_TEST_SIGS; i++) {
    const pathIdx = DEPOSIT_PATH;
    pathIdx[2] = i;
    it(`Should validate EIP2333 and signing at deposit index #${i}`, async () => {
      await testBLSDerivationAndSig(KNOWN_SEED, pathIdx);
    })
  }

  for (let i = 0; i < N_TEST_SIGS; i++) {
    const pathIdx = WITHDRAWAL_PATH;
    pathIdx[2] = i;
    it(`Should validate EIP2333 and signing at withdrawal index #${i}`, async () => {
      await testBLSDerivationAndSig(KNOWN_SEED, pathIdx);
    })
  }

  it('Should export encrypted withdrawal private keys', async () => {
    const req = {
      schema: Constants.ENC_DATA.SCHEMAS.BLS_KEYSTORE_EIP2335_PBKDF_V4,
      params: {
        path: WITHDRAWAL_PATH,
        c: 999, // if this is not specified, the default value will be used
      }
    }
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
   
    req.params.path[2] = 1;

  })
*/
  for (let i = 0; i < N_TEST_DEPOSIT_DATA; i++) {
    it(`Should get encrypted keystore #${i+1}/${N_TEST_DEPOSIT_DATA}`, async () => {
      const path = globalVectors.ethDeposit.depositData[i].depositPath; 
      const encData = await client.fetchEncryptedData({
        schema: Constants.ENC_DATA.SCHEMAS.BLS_KEYSTORE_EIP2335_PBKDF_V4,
        params: {
          path,
          c: 1000, // This should not affect deposit data but will make deriv faster
        }
      });
      await validateExportedKeystore(KNOWN_SEED, path, encPw, encData);
      keystores.push(encData);
    })

    it(`Should validate deposit data for keystore #${i+1}/${N_TEST_DEPOSIT_DATA} w/ BLS withdrawal`, async () => {
      const vec = globalVectors.ethDeposit.depositData[i];
      // Fetch withdrawal pubkey and convert to withdrawal credentials
      const depositPub = await getBLSPub(vec.depositPath);
      const withdrawalPub = await getBLSPub(vec.withdrawalPath);
      // Get deposit message root and validate against reference
      const depositMsgRoot = Utils.getEthDepositMessageRoot(depositPub, withdrawalPub);
      expect(depositMsgRoot.toString('hex').toLowerCase()).to.equal(vec.messageRoot);
      // Get signing root
      const signingRoot = Utils.getEthDepositSigningRoot(depositMsgRoot);
      console.log('signingRoot', signingRoot)
      // Sign root and validate against reference
      const sig = await signBLS(vec.depositPath, signingRoot);
      console.log('sig', sig)
    })

  }
})

//=========================================================
// INTERNAL HELPERS
//=========================================================
async function getBLSPub(startPath) {
  const pubs = await client.getAddresses({ 
    startPath, 
    flag: Constants.GET_ADDR_FLAGS.BLS12_381_G1_PUB 
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
    }
  };
  return await client.sign(signReq);
}

async function testBLSDerivationAndSig(seed, signerPath) {
  const msg = Buffer.from('64726e3da8', 'hex')
  const priv = deriveSeedTree(seed, buildPath(signerPath));
  const latticePub = await getBLSPub(signerPath);
  const latticeSig = await signBLS(signerPath, msg);
  const refPub = getPublicKey(priv);
  const refPubStr = Buffer.from(refPub).toString('hex')
  const refSig = await sign(msg, priv);
  const refSigStr = Buffer.from(refSig).toString('hex')
  expect(latticePub.toString('hex')).to.equal(
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

async function validateExportedKeystore(seed, path, pw, expKeystoreBuffer) {
  const exportedKeystore = JSON.parse(expKeystoreBuffer.toString());
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

async function loadSeed(client, seed, mnemonic=undefined) {
  const res = await testRequest({
    client,
    testID: 0,
    payload: serializeJobData(
      jobTypes.WALLET_JOB_LOAD_SEED,
      copyBuffer(client.getActiveWallet()?.uid), 
      {
        iface: 1, // external SafeCard interface
        mnemonic,
        seed,
        exportability: 2, // always exportable
      },
    ),
  });
  //@ts-expect-error - accessing private property
  const parsedRes = parseWalletJobResp(res, client.fwVersion);
  expect(parsedRes.resultStatus).toEqualElseLog(
    gpErrors.GP_SUCCESS,
    getCodeMsg(parsedRes.resultStatus, gpErrors.GP_SUCCESS),
  );
}

async function removeSeed(client) {
  const res = await testRequest({
    client,
    testID: 0,
    payload: serializeJobData(
      jobTypes.WALLET_JOB_DELETE_SEED, 
      copyBuffer(client.getActiveWallet()?.uid), 
      { iface: 1},
    ),
  });
  //@ts-expect-error - accessing private property
  const parsedRes = parseWalletJobResp(res, client.fwVersion);
  expect(parsedRes.resultStatus).toEqualElseLog(
    gpErrors.GP_SUCCESS,
    getCodeMsg(parsedRes.resultStatus, gpErrors.GP_SUCCESS),
  );
}