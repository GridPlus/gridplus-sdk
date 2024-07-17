import { Constants } from '../../../..';
import { HARDENED_OFFSET } from '../../../../constants';
import { getPrng } from '../../../utils/getters';
import { setupClient } from '../../../utils/setup';

//---------------------------------------
// STATE DATA
//---------------------------------------
const DEFAULT_SOLANA_SIGNER = [
  HARDENED_OFFSET + 44,
  HARDENED_OFFSET + 501,
  HARDENED_OFFSET,
  HARDENED_OFFSET,
];
const prng = getPrng();

describe('[Solana]', () => {
  let client;

  test('pair', async () => {
    client = await setupClient();
  });

  const getReq = (overrides: any) => ({
    data: {
      curveType: Constants.SIGNING.CURVES.ED25519,
      hashType: Constants.SIGNING.HASHES.NONE,
      encodingType: Constants.SIGNING.ENCODINGS.SOLANA,
      payload: null,
      ...overrides,
    },
  });


});
