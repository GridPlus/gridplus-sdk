/**
Test ABI decoding of various EVM smart contract function calls.
This includes:
* Several mainnet transactions, loaded via both Etherscan and 4byte
* Many manually created vectors for coverage testing of ABI decoding

You must have `FEATURE_TEST_RUNNER=1` enabled in firmware to run these tests.
 */
import { NETWORKS_BY_CHAIN_ID } from '../../../constants';
import { fetchCalldataDecoder } from '../../../util';
import { getTestVectors } from '../../utils/helpers';
import {
  DEFAULT_SIGNER,
  buildEncDefs,
  buildEvmReq,
} from '../../utils/builders';
import { getEtherscanKey } from '../../utils/getters';
import { runEvm } from '../../utils/runners';
import { initializeSeed } from '../../utils/initializeClient';
import { setupClient } from '../../utils/setup';

const globalVectors = getTestVectors();
const vectors = globalVectors.evm.calldata;

//---------------------------------------
// STATE DATA
//---------------------------------------
let CURRENT_SEED = null;
const { encDefs, encDefsCalldata } = buildEncDefs(vectors);

//---------------------------------------
// TESTS
//---------------------------------------
describe('[EVM ABI]', () => {
  let client;

  test('pair', async () => {
    client = await setupClient();
  });
  const runEvmTestForReq = (
    req?: any,
    bypassSetPayload?: boolean,
    shouldFail?: boolean,
    useLegacySigning?: boolean,
  ) => {
    const evmReq = buildEvmReq(req);
    return runEvm(
      evmReq,
      client,
      CURRENT_SEED,
      bypassSetPayload,
      shouldFail,
      useLegacySigning,
    ).catch((err) => {
      if (err.responseCode === 128) {
        err.message =
          'NOTE: You must have `FEATURE_TEST_RUNNER=1` enabled in firmware to run these tests.\n' +
          err.message;
      }
      throw err;
    });
  };

  it('Should get the current wallet seed', async () => {
    CURRENT_SEED = await initializeSeed(client);
  });

  describe('[EVM] Test decoders', () => {
    const runAbiDecoderTest = (overrides: any, ...params: any) =>
      runEvmTestForReq(
        {
          data: {
            payload: null,
            signerPath: DEFAULT_SIGNER,
          },
          currency: undefined,
          txData: {
            gasPrice: 1200000000,
            nonce: 0,
            gasLimit: 50000,
            to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
            value: 100,
            data: null,
          },
          ...overrides,
        },
        ...params,
      );

    beforeAll(() => {
      // Silence warnings, which will be thrown when you provide a
      // chainID=-1, which forces fallback to 4byte in certain tests
      console.warn = vi.fn();
    });

    describe('Test ABI decoding on real (mainnet) tx vectors', async () => {
      // Validate that we can decode using Etherscan ABI info as well as 4byte canonical names.
      for (let i = 0; i < vectors.publicTxHashes.length; i++) {
        // Hashes on ETH mainnet that we will use to fetch full tx and ABI data with
        const info = vectors.publicTxHashes[i];
        const chainInfo = NETWORKS_BY_CHAIN_ID[info.chainID];
        const getTxBase = `${chainInfo.baseUrl}/api?module=proxy&action=eth_getTransactionByHash&txhash=`;
        // 1. First fetch the transaction details from etherscan. This is just to get
        // the calldata, so it would not be needed in a production environment
        // (since we already have the calldata).
        const txHash = info.hash;
        let getTxUrl = `${getTxBase}${txHash}`;
        const etherscanKey = getEtherscanKey();
        if (etherscanKey && info.chainID === 1) {
          getTxUrl += `&apiKey=${etherscanKey}`;
        }
        const tx = await fetch(getTxUrl)
          .then((res) => res.json())
          .then((res) => res.result);
        const txData = { data: tx.input, ...tx };
        const blockExplorerReqFailed = false;
        if (!etherscanKey) {
          // Need a timeout between requests if we don't have a key
          console.warn(
            'WARNING: No env.ETHERSCAN_KEY provided. Waiting 5s between requests...',
          );
          await new Promise((resolve) => setTimeout(resolve, 5000));
        } else {
          // Wait 1s between etherscan requests if there is a key.
          // Some of these are nested and require multiple follow ups
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        it(`Public tx #${i} (${chainInfo.name}: ${txHash.slice(
          0,
          8,
        )}...)`, async () => {
          // Some requests are marked such that we should skip pinging
          // the relevant block explorer and should instead force a fallback
          // to 4byte.
          if (info.skipBlockExplorerReq) {
            return;
          }
          // Fetch the full ABI of the contract that the transaction interacted with.
          const { def } = await fetchCalldataDecoder(
            tx.input,
            tx.to,
            info.chainID,
            true,
          );
          if (!def) {
            if (info.ignoreBlockExplorerError) {
              console.log('ignoring error');
              return;
            }
            blockExplorerReqFailed = true;
            throw new Error(
              `ERROR: Failed to decode ABI definition (${txHash}). Skipping.`,
            );
          }
          // Test decoding using Etherscan (or equivalent) ABI info
          await runAbiDecoderTest({ txData, data: { decoder: def } });
        });

        it(`Public tx #${i} q(4byte)`, async () => {
          if (blockExplorerReqFailed) {
            throw new Error(
              'ERROR: Etherscan request failed. Cannot execute corresponding 4byte test. Skipping.',
            );
          }
          // 4. Get the canonical name from 4byte by using an unsupported chainId
          const { def } = await fetchCalldataDecoder(tx.input, tx.to, -1, true);
          await runAbiDecoderTest({ txData, data: { decoder: def } });
        });
      }
    });

    // Validate a series of canonical definitions
    const setSz = 10;
    const maxVec = vectors.canonicalNames.length;
    const canonicalSets = Math.ceil(maxVec / setSz);
    for (let i = 0; i < canonicalSets; i++) {
      describe(`Test ABI decoding on canonical tx vectors (Set #${
        i + 1
      }/${canonicalSets})`, async () => {
        for (let j = 0; j < setSz; j++) {
          const idx = i * setSz + j;
          if (idx < maxVec) {
            it(`(Canonical #${idx}/${maxVec}) ${vectors.canonicalNames[idx]}`, async () => {
              const req = buildEvmReq({
                data: { decoder: encDefs[idx] },
                txData: { data: encDefsCalldata[idx] },
              });
              // The following prints are helpful for debugging.
              // If you are testing changes to the ABI decoder in firmware, you
              // should uncomment these prints and validate that the `data` matches
              // what you see on the screen for each case. Please scroll through
              // ALL the data on the Lattice to confirm each param has properly decoded.
              // const { types, data } = convertDecoderToEthers(RLP.decode(req.data.decoder).slice(1));
              // console.log('types', types)
              // console.log('params', JSON.stringify(data))
              // for (let cd = 2; cd < calldata.length; cd += 64) {
              //   console.log(calldata.slice(cd, cd + 64));
              // }
              await runAbiDecoderTest(req);
            });
          }
        }
      });
    }

    /*
    NOTE: The CRUD API to manage calldata decoders is written, but is currently
    compiled out of firmware to free up code space. For now we will leave
    these tests commented out and may re-enable them at a later date
    NOTE: You will need to re-enable `import { question } from 'readline-sync';`
    descrube('Test ABI CRUD API', async () => {
      // Test committing decoder data
      it('Should save the first 10 defs', async () => {
        const decoderType = Calldata.EVM.type;
        const rm = question(
          'Do you want to remove all previously saved definitions? (Y/N) ',
        );
        if (rm.toUpperCase() === 'Y') {
          await client.removeDecoders({ decoderType, rmAll: true });
        }
        // First determine how many defs there are already
        let saved = await client.getDecoders({ decoderType });
        numDefsInitial = saved.total;
        await client.addDecoders({
          decoderType,
          decoders: encDefs.slice(0, 10),
        });
        saved = await client.getDecoders({ decoderType, n: 10 });
        expect(saved.total).toEqual(numDefsInitial + 10);
        for (let i = 0; i < saved.decoders.length; i++) {
          test
            .expect(saved.decoders[i].toString('hex'))
            .toEqual(encDefs[i].toString('hex'));
        }
        await client.addDecoders({
          decoderType,
          decoders: encDefs.slice(0, 10),
        });
        saved = await client.getDecoders({ decoderType, n: 10 });
        expect(saved.total).toEqual(numDefsInitial + 10);
        for (let i = 0; i < saved.decoders.length; i++) {
          test
            .expect(saved.decoders[i].toString('hex'))
            .toEqual(encDefs[i].toString('hex'));
        }
      });

      it('Should decode saved defs with check marks', async () => {
        question(
        );
        // Test expected passes
        req.txData.data = encDefsCalldata[0];
        await runEvm(req);
        req.txData.data = encDefsCalldata[9];
        await runEvm(req);
        // Test expected failure
        req.txData.data = encDefsCalldata[10];
        req.data.decoder = encDefs[10];
        await runEvm(req, true);
      });

      it('Should test decoding priority levels', async () => {
        question(
        );
        req.txData.data = encDefsCalldata[10];
        req.data.decoder = encDefs[10];
        await runEvm(req);
        req.data.decoder = null;
        await runEvm(req, true);
      });

      it('Should fetch the first 10 defs', async () => {
        const decoderType = Calldata.EVM.type;
        const { total, decoders } = await client.getDecoders({
          decoderType,
          startIdx: numDefsInitial,
          n: 10,
        });
        expect(total).toEqual(numDefsInitial + 10);
        expect(decoders.length).toEqual(10);
        for (let i = 0; i < decoders.length; i++) {
          test
            .expect(decoders[i].toString('hex'))
            .toEqual(encDefs[i].toString('hex'));
        }
      });

      it('Should remove the saved defs', async () => {
        const decoderType = Calldata.EVM.type;
        // Remove the first 5 defs
        await client.removeDecoders({
          decoderType,
          decoders: encDefs.slice(0, 5),
        });
        // There should be 5 defs remaining
        const { total, decoders } = await client.getDecoders({
          decoderType,
          startIdx: numDefsInitial,
          n: 10,
        });
        expect(total).toEqual(numDefsInitial + 5);
        expect(decoders.length).toEqual(5);
        // Remove the latter 5
        await client.removeDecoders({
          decoderType,
          decoders: encDefs.slice(5, 10),
        });
        const { total, decoders } = await client.getDecoders({
          decoderType,
          startIdx: numDefsInitial,
          n: 10,
        });
        // There should be no more new defs
        expect(total).toEqual(numDefsInitial);
        expect(decoders.length).toEqual(0);
        // Test to make sure the check marks do not appear
        question(
        );
        req.txData.data = encDefsCalldata[0];
        req.data.decoder = encDefs[0];
        await runEvm(req, true);
        req.txData.data = encDefsCalldata[9];
        req.data.decoder = encDefs[9];
        await runEvm(req, true);
      });
    })
    */
  });
});
