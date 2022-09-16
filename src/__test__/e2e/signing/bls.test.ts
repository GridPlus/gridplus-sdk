import { getPublicKey } from '@noble/bls12-381';
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

describe('[BLS]', () => {
  client = initializeClient();

  it('Should get the current wallet seed', async () => {
    seed = await initializeSeed(client);
  })

  it('Should test pubkey derivations (EIP2333 + EIP2334)', async () => {
    let latticePubs;
    const flag = Constants.GET_ADDR_FLAGS.BLS12_381_G1_PUB;
    // Test first 10 deposit keys
    for (let i = 0; i < 10; i++) {
      const pathIdx = DEPOSIT_PATH_IDX;
      pathIdx[2] = i;
      latticePubs = await client.getAddresses({ startPath: pathIdx, flag });
      const priv = deriveSeedTree(seed, buildPath(pathIdx));
      const pub = getPublicKey(priv);
      const pubStr = Buffer.from(pub).toString('hex')
      expect(latticePubs[0].toString('hex')).to.equal(pubStr, 'Deposit public key mismatch');
    }
    // Test first 10 withdrawal keys
    for (let i = 0; i < 10; i++) {
      const pathIdx = WITHDRAWAL_PATH_IDX;
      pathIdx[2] = i;
      latticePubs = await client.getAddresses({ startPath: pathIdx, flag });
      const priv = deriveSeedTree(seed, buildPath(pathIdx));
      const pub = getPublicKey(priv);
      const pubStr = Buffer.from(pub).toString('hex')
      expect(latticePubs[0].toString('hex')).to.equal(pubStr, 'Deposit public key mismatch');
    }
  })
})