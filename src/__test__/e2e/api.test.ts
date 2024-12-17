/* eslint-disable quotes */
import { getClient } from './../../api/utilities';
import { question } from 'readline-sync';
import { RLP } from '@ethereumjs/rlp';
import {
  fetchActiveWallets,
  fetchAddress,
  fetchAddresses,
  fetchBip44ChangeAddresses,
  fetchBtcLegacyAddresses,
  fetchBtcSegwitAddresses,
  fetchAddressesByDerivationPath,
  fetchSolanaAddresses,
  pair,
  signBtcLegacyTx,
  signBtcSegwitTx,
  signBtcWrappedSegwitTx,
  signMessage,
} from '../../api';
import { HARDENED_OFFSET } from '../../constants';
import { BTC_PURPOSE_P2SH_P2WPKH, BTC_TESTNET_COIN } from '../utils/helpers';
import { dexlabProgram } from './signing/solana/__mocks__/programs';
import {
  addAddressTags,
  fetchAddressTags,
  fetchLedgerLiveAddresses,
  removeAddressTags,
  sign,
  signSolanaTx,
} from '../../api/index';
import { setupClient } from '../utils/setup';
import { buildRandomMsg } from '../utils/builders';

describe('API', () => {
  test('pair', async () => {
    const isPaired = await setupClient();
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ');
      await pair(secret.toUpperCase());
    }
  });
  const payload= Buffer.from(new Uint8Array([
        2, 231, 1, 14, 131, 152, 150, 128, 133, 6, 121, 166, 149, 211, 130, 82,
        8, 148, 223, 178, 104, 47, 235, 230, 234, 150, 104, 43, 16, 24, 112, 41,
        88, 152, 4, 73, 183, 219, 5, 128, 192,
      ]))
  const txData = {
    data: {
      signerPath: [2147483692, 2147483708, 2147483648, 0, 0],
      curveType: 0,
      hashType: 1,
      encodingType: 4,
      payload
    },
    type: 2,
    currency: 'ETH',
  } as const;

  test('generic', async () => {

    console.log('>>>txData', txData);
    const res = await sign(payload, txData);
    console.log('>>>res', res);
  });
});
