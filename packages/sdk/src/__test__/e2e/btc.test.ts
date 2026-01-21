/**
 * IMPORTANT: ENABLE `FEATURE_TEST_RUNNER=0` IN FIRMWARE SETTINGS
 *
 * Failure to enable this setting will result in an `Invalid Request` error.
 * Ensure `FEATURE_TEST_RUNNER=0` is active before executing these tests.
 *
 * REQUIRED TEST MNEMONIC:
 * These tests require a SafeCard loaded with the standard test mnemonic:
 * "test test test test test test test test test test test junk"
 *
 * Running with a different mnemonic will cause test failures due to
 * incorrect address derivations and signature mismatches.
 */

import BIP32Factory, { type BIP32Interface } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import type { Client } from '../../client';
import { getPrng, getTestnet } from '../utils/getters';
import {
  BTC_PURPOSE_P2PKH,
  BTC_PURPOSE_P2SH_P2WPKH,
  BTC_PURPOSE_P2WPKH,
  setup_btc_sig_test,
  stripDER,
} from '../utils/helpers';
import { setupClient } from '../utils/setup';
import { TEST_SEED } from '../utils/testConstants';

const prng = getPrng();
const bip32 = BIP32Factory(ecc);
const TEST_TESTNET = !!getTestnet() || false;
let wallet: BIP32Interface | null = null;
type InputObj = { hash: string; value: number; signerIdx: number; idx: number };

// Build the inputs. By default we will build 10. Note that there are `n` tests for
// *each category*, where `n` is the number of inputs.
function rand32Bit() {
  return Math.floor(prng.quick() * 2 ** 32);
}
const inputs: InputObj[] = [];
const count = 10;
for (let i = 0; i < count; i++) {
  const hash = Buffer.alloc(32);
  for (let j = 0; j < 8; j++) {
    // 32 bits of randomness per call
    hash.writeUInt32BE(rand32Bit(), j * 4);
  }
  const value = Math.floor(rand32Bit());
  const signerIdx = Math.floor(prng.quick() * 19); // Random signer (keep it inside initial cache of 20)
  const idx = Math.floor(prng.quick() * 25); // Random previous output index (keep it small)
  inputs.push({ hash: hash.toString('hex'), value, signerIdx, idx });
}

async function testSign({ txReq, signingKeys, sigHashes, client }: any) {
  const tx = await client.sign(txReq);
  const len = tx?.sigs?.length ?? 0;
  expect(len).toEqual(signingKeys.length);
  expect(len).toEqual(sigHashes.length);
  for (let i = 0; i < len; i++) {
    const sig = stripDER(tx.sigs?.[i]);
    const verification = signingKeys[i].verify(sigHashes[i], sig);
    expect(verification).toEqualElseLog(
      true,
      `Signature validation failed for priv=${signingKeys[
        i
      ].privateKey.toString('hex')}, ` +
        `hash=${sigHashes[i].toString('hex')}, sig=${sig.toString('hex')}`,
    );
  }
}

async function runTestSet(
  opts: any,
  wallet: BIP32Interface | null,
  inputsSlice: InputObj[],
  client,
) {
  expect(wallet).not.toEqualElseLog(null, 'Wallet not available');
  if (TEST_TESTNET) {
    // Testnet + change
    opts.isTestnet = true;
    opts.useChange = true;
    await testSign({
      ...setup_btc_sig_test(opts, wallet, inputsSlice, prng),
      client,
    });
    // Testnet + no change
    opts.isTestnet = true;
    opts.useChange = false;
    await testSign({
      ...setup_btc_sig_test(opts, wallet, inputsSlice, prng),
      client,
    });
  }
  // Mainnet + change
  opts.isTestnet = false;
  opts.useChange = true;
  await testSign({
    ...setup_btc_sig_test(opts, wallet, inputsSlice, prng),
    client,
  });
  // Mainnet + no change
  opts.isTestnet = false;
  opts.useChange = false;
  await testSign({
    ...setup_btc_sig_test(opts, wallet, inputsSlice, prng),
    client,
  });
}

describe('Bitcoin', () => {
  let client: Client;

  beforeAll(async () => {
    client = await setupClient();
    wallet = bip32.fromSeed(TEST_SEED);
  });

  for (let i = 0; i < inputs.length; i++) {
    const inputsSlice = inputs.slice(0, i + 1);

    describe(`Input Set ${i}`, () => {
      describe('segwit spender (p2wpkh)', () => {
        it('p2wpkh->p2pkh', async () => {
          const opts = {
            spenderPurpose: BTC_PURPOSE_P2WPKH,
            recipientPurpose: BTC_PURPOSE_P2PKH,
          };
          await runTestSet(opts, wallet, inputsSlice, client);
        });

        it('p2wpkh->p2sh-p2wpkh', async () => {
          const opts = {
            spenderPurpose: BTC_PURPOSE_P2WPKH,
            recipientPurpose: BTC_PURPOSE_P2SH_P2WPKH,
          };
          await runTestSet(opts, wallet, inputsSlice, client);
        });

        it('p2wpkh->p2wpkh', async () => {
          const opts = {
            spenderPurpose: BTC_PURPOSE_P2WPKH,
            recipientPurpose: BTC_PURPOSE_P2WPKH,
          };
          await runTestSet(opts, wallet, inputsSlice, client);
        });
      });

      describe('wrapped segwit spender (p2sh-p2wpkh)', () => {
        it('p2sh-p2wpkh->p2pkh', async () => {
          const opts = {
            spenderPurpose: BTC_PURPOSE_P2SH_P2WPKH,
            recipientPurpose: BTC_PURPOSE_P2PKH,
          };
          await runTestSet(opts, wallet, inputsSlice, client);
        });

        it('p2sh-p2wpkh->p2sh-p2wpkh', async () => {
          const opts = {
            spenderPurpose: BTC_PURPOSE_P2SH_P2WPKH,
            recipientPurpose: BTC_PURPOSE_P2SH_P2WPKH,
          };
          await runTestSet(opts, wallet, inputsSlice, client);
        });

        it('p2sh-p2wpkh->p2wpkh', async () => {
          const opts = {
            spenderPurpose: BTC_PURPOSE_P2SH_P2WPKH,
            recipientPurpose: BTC_PURPOSE_P2WPKH,
          };
          await runTestSet(opts, wallet, inputsSlice, client);
        });
      });

      describe('legacy spender (p2pkh)', () => {
        it('p2pkh->p2pkh', async () => {
          const opts = {
            spenderPurpose: BTC_PURPOSE_P2PKH,
            recipientPurpose: BTC_PURPOSE_P2PKH,
          };
          await runTestSet(opts, wallet, inputsSlice, client);
        });

        it('p2pkh->p2sh-p2wpkh', async () => {
          const opts = {
            spenderPurpose: BTC_PURPOSE_P2PKH,
            recipientPurpose: BTC_PURPOSE_P2SH_P2WPKH,
          };
          await runTestSet(opts, wallet, inputsSlice, client);
        });

        it('p2pkh->p2wpkh', async () => {
          const opts = {
            spenderPurpose: BTC_PURPOSE_P2PKH,
            recipientPurpose: BTC_PURPOSE_P2WPKH,
          };
          await runTestSet(opts, wallet, inputsSlice, client);
        });
      });
    });
  }
});
