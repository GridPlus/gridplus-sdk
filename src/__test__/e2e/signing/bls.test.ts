import { getPublicKey, sign } from '@noble/bls12-381';
import { deriveSeedTree } from 'bls12-381-keygen';
import { initializeClient, initializeSeed } from '../../utils/initializeClient';
import { buildPath } from '../../utils/helpers'
import { Constants } from '../../../index'

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

describe('[BLS]', () => {
  client = initializeClient();

  it('Should get the current wallet seed', async () => {
    seed = await initializeSeed(client);
  })
/*
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
*/
  it('Should export encrypted withdrawal private key', async () => {
    const req = {
      schema: Constants.ENC_DATA.SCHEMAS.BLS_KEYSTORE_EIP2335,
      params: {
        path: WITHDRAWAL_PATH_IDX,
        c: 21704,
      }
    }
    const encData = await client.exportEncryptedData(req);
    console.log('encData', encData)
  })
})