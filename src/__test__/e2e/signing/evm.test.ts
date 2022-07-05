/**
Test generic signing, which allows a signature on the secp256k1 or ed25519 curve.
We seek to validate:
1. Signature on data can be reproduced locally with the derived key
2. Signature on data representing ETH tx matches the ETH route itself
3. Many random signatures can be validated

You must have `FEATURE_TEST_RUNNER=1` enabled in firmware to run these tests.
 */
import Common, { Chain, Hardfork } from '@ethereumjs/common';
import { TransactionFactory as EthTxFactory } from '@ethereumjs/tx';
import { Interface } from '@ethersproject/abi';
import { BN } from 'bn.js';
import { readFileSync } from 'fs';
import { jsonc } from 'jsonc';
import { decode as rlpDecode, encode as rlpEncode } from 'rlp';
import request from 'superagent';
import { Client } from '../../../client';
import { fetchCalldataDecoder, randomBytes } from '../../../util';
import { buildEncDefs, buildEvmReq, DEFAULT_SIGNER, getNumIter } from '../../utils/builders';
import { getEtherscanKey } from '../../utils/getters';
import { runEvm } from '../../utils/runners';

const globalVectors = jsonc.parse(
  readFileSync(`${process.cwd()}/src/__test__/vectors.jsonc`).toString(),
);
const vectors = globalVectors.evm.calldata;

//---------------------------------------
// STATE DATA
//---------------------------------------

const { encDefs, encDefsCalldata } = buildEncDefs(vectors);

//---------------------------------------
// TESTS
//---------------------------------------
export const runEvmTests = ({ client }: { client: Client }) => {
  describe('[EVM]', () => {
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
        bypassSetPayload,
        shouldFail,
        useLegacySigning,
      );
    };

    describe('[EVM] Test transactions', () => {
      describe('EIP1559', () => {
        it('Should test a basic transaction', async () => {
          await runEvmTestForReq();
        });

        it('Should test a Rinkeby transaction', async () => {
          await runEvmTestForReq({
            common: new Common({
              chain: Chain.Rinkeby,
              hardfork: Hardfork.London,
            }),
          });
        });

        it('Should test a transaction with an access list', async () => {
          await runEvmTestForReq({
            txData: {
              accessList: [
                {
                  address: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
                  storageKeys: [
                    '0x7154f8b310ad6ce97ce3b15e3419d9863865dfe2d8635802f7f4a52a206255a6',
                  ],
                },
                {
                  address: '0xe0f8ff08ef0242c461da688b8b85e438db724860',
                  storageKeys: [],
                },
              ],
            },
          });
        });
      });

      describe('EIP2930', () => {
        it('Should test a basic transaction', async () => {
          await runEvmTestForReq({
            txData: {
              type: 1,
              gasPrice: 1200000000,
            },
          });
        });

        it('Should test a Rinkeby transaction', async () => {
          await runEvmTestForReq({
            txData: {
              type: 1,
              gasPrice: 1200000000,
            },
            common: new Common({
              chain: Chain.Rinkeby,
              hardfork: Hardfork.London,
            }),
          });
        });

        it('Should test a transaction with an access list', async () => {
          await runEvmTestForReq({
            txData: {
              type: 1,
              gasPrice: 1200000000,
              accessList: [
                {
                  address: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
                  storageKeys: [
                    '0x7154f8b310ad6ce97ce3b15e3419d9863865dfe2d8635802f7f4a52a206255a6',
                  ],
                },
                {
                  address: '0xe0f8ff08ef0242c461da688b8b85e438db724860',
                  storageKeys: [],
                },
              ],
            },
          });
        });
      });

      describe('Legacy (Non-EIP155)', () => {
        it('Should test a transaction that does not use EIP155', async () => {
          await runEvmTestForReq({
            txData: {
              type: undefined,
              gasPrice: 1200000000,
            },
            common: new Common({
              chain: Chain.Mainnet,
              hardfork: Hardfork.Homestead,
            }),
          });
        });
      });

      describe('Boundary tests', () => {
        const runBoundaryTest = (overrides: any, ...params: any) =>
          runEvmTestForReq(
            {
              txData: {
                maxFeePerGas: undefined,
                maxPriorityFeePerGas: undefined,
                gasPrice: 1200000000,
                type: undefined,
              },
              common: new Common({
                chain: Chain.Mainnet,
                hardfork: Hardfork.London,
              }),
              ...overrides,
            },
            ...params,
          );

        it('Should test shorter derivation paths', async () => {
          console.log('DEFAULT_SIGNER', DEFAULT_SIGNER);
          await runBoundaryTest({
            data: {
              signerPath: DEFAULT_SIGNER.slice(0, 3),
            },
          });
          await runBoundaryTest({
            data: {
              signerPath: DEFAULT_SIGNER.slice(0, 2),
            },
          });
          await runBoundaryTest({
            data: {
              signerPath: DEFAULT_SIGNER.slice(0, 1),
            },
          });
          await expect(
            runBoundaryTest(
              {
                data: {
                  signerPath: [],
                },
              },
              true,
            ),
          ).rejects.toThrow();
        });

        it('Should test other chains', async () => {
          // Polygon
          await runBoundaryTest({ common: Common.custom({ chainId: 137 }) });
          // BSC
          await runBoundaryTest({ common: Common.custom({ chainId: 56 }) });
          // Avalanche
          await runBoundaryTest({ common: Common.custom({ chainId: 43114 }) });
          // Palm
          await runBoundaryTest({
            common: Common.custom({ chainId: 11297108109 }),
          });
          // Unknown chain
          await runBoundaryTest({ common: Common.custom({ chainId: 9999 }) });
          // Unknown chain (max chainID, i.e. UINT64_MAX - 1)
          await runBoundaryTest({
            // @ts-expect-error - Common.custom() expects a number
            common: Common.custom({ chainId: '18446744073709551615' }),
          });
          // Unknown chain (chainID too large)
          await runBoundaryTest({
            // @ts-expect-error - Common.custom() expects a number
            common: Common.custom({ chainId: '18446744073709551616' }),
          });
          // Unknown chain - bypass set payload
          await expect(
            runBoundaryTest(
              // @ts-expect-error - Common.custom() expects a number
              { common: Common.custom({ chainId: '18446744073709551616' }) },
              true,
            ),
          ).rejects.toThrow();
        });

        it('Should test range of `value`', async () => {
          await runBoundaryTest({ txData: { value: 1 } });
          await runBoundaryTest({
            txData: {
              value:
                '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
            },
          });
        });

        it('Should test range of `data` size', async () => {
          const { extraDataFrameSz, extraDataMaxFrames, genericSigning } =
            client.getFwConstants();
          const { baseDataSz } = genericSigning;
          // Max size of total payload
          const maxSz = baseDataSz + extraDataMaxFrames * extraDataFrameSz;
          const req = buildEvmReq({ txData: { data: null } });
          // Infer the max `data` size
          const dummyTx = EthTxFactory.fromTxData(req.txData, {
            common: req.common,
          });
          const dummyTxSz = rlpEncode(dummyTx.getMessageToSign(false)).length;
          const rlpPrefixSz = 4; // 1 byte for descriptor, 1 byte for length, 2 bytes for length
          const maxDataSz = maxSz - dummyTxSz - rlpPrefixSz;

          // No data
          req.txData.data = null;
          await runBoundaryTest({ txData: { data: null } });
          // Max payload size
          await runBoundaryTest({
            txData: { data: `0x${randomBytes(maxDataSz).toString('hex')}` },
          });
          // Min prehash size
          await runBoundaryTest({
            txData: { data: `0x${randomBytes(maxDataSz + 1).toString('hex')}` },
          });
        });

        it('Should test contract deployment', async () => {
          await runBoundaryTest({
            txData: { to: null, data: `0x${randomBytes(96).toString('hex')}` },
          });
        });

        it('Should test direct RLP-encoded payloads with bad params', async () => {
          const req = buildEvmReq();
          const tx = EthTxFactory.fromTxData(req.txData, {
            common: req.common,
          });
          const oversizedInt = Buffer.from(
            'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff01',
            'hex',
          );
          const getParamPayloadReq = (n: number, val?: any) => {
            const params = tx.getMessageToSign(false);
            params[n] = oversizedInt;
            return { data: { payload: val ? val : rlpEncode(params) } };
          };
          // Test numerical values >32 bytes
          // ---
          // Nonce
          await runBoundaryTest(getParamPayloadReq(0), true, true);

          // Gas
          await runBoundaryTest(getParamPayloadReq(1), true, true);

          // Gas Price
          await runBoundaryTest(getParamPayloadReq(2), true, true);

          // Value
          await runBoundaryTest(getParamPayloadReq(4), true, true);

          // Test wrong sized addresses
          // ---
          await expect(
            runBoundaryTest(
              getParamPayloadReq(
                3,
                Buffer.from('e242e54155b1abc71fc118065270cecaaf8b77', 'hex'),
              ),
              true,
              true,
            ),
          ).rejects.toThrow();

          await expect(
            runBoundaryTest(
              getParamPayloadReq(
                3,
                Buffer.from(
                  'e242e54155b1abc71fc118065270cecaaf8b770102',
                  'hex',
                ),
              ),
              true,
              true,
            ),
          ).rejects.toThrow();
        });
      });

      describe('Random Transactions', () => {
        for (let i = 0; i < getNumIter(); i++) {
          it(`Should test random transactions: #${i}`, async () => {
            const randInt = (n: number) => Math.floor(Math.random() * n);
            const randIntStr = (nBytes: number, type?: 'hex') =>
              new BN(randomBytes(randInt(nBytes)).toString('hex'), 16).toString(
                type,
              );
            await runEvmTestForReq({
              txData: {
                gasLimit: 1000000,
                nonce: `0x${randIntStr(4, 'hex')}`,
                gasPrice: `0x${randIntStr(4, 'hex')}`,
                gas: `0x${randIntStr(4, 'hex')}`,
                value: `0x${randIntStr(32, 'hex')}`,
                to: `0x${randomBytes(20).toString('hex')}`,
                data: `0x${randomBytes(randInt(2000)).toString('hex')}`,
                type: undefined,
              },
              common: Common.custom({
                chainId: parseInt(randIntStr(4)),
              }),
            });
          });
        }
      });

      describe('[TODO: deprecate] Test Legacy Pathway (while it still exists)', () => {
        const legacyOverrides = {
          currency: 'ETH',
          data: {
            payload: null,
            signerPath: DEFAULT_SIGNER,
          },
          txData: {
            chainId: 1,
            gasPrice: 1200000000,
            nonce: 0,
            gasLimit: 50000,
            to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
            value: 100,
            data: '0xdeadbeef',
          },
          common: new Common({
            chain: Chain.Mainnet,
            hardfork: Hardfork.London,
          }),
        };

        const runLegacyTest = (overrides: any, ...params: any) =>
          runEvmTestForReq(
            {
              ...legacyOverrides,
              ...overrides,
            },
            ...params,
          );

        it('Should test legacy signing for legacy EIP155 transaction', async () => {
          await runLegacyTest({}, null, null, true);
        });

        it('Should test legacy signing for EIP1559', async () => {
          await runLegacyTest(
            {
              txData: {
                type: 2,
              },
            },
            null,
            null,
            true,
          );
        });

        it('Should test a Polygon transaction (chainId=137)', async () => {
          await runLegacyTest(
            {
              txData: {
                type: undefined,
                chainId: 137,
                gasPrice: 1200000000,
                maxFeePerGas: undefined,
                maxPriorityFeePerGas: undefined,
              },
              common: Common.custom({ chainId: 137 }),
            },
            null,
            null,
            true,
          );
        });
      });
    });

    describe('[EVM] Test decoders', () => {
      describe('Test ABI decoder vectors', () => {
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

        // Validate that we can decode using Etherscan ABI info as well as 4byte canonical names.
        for (let i = 0; i < vectors.etherscanTxHashes.length; i++) {
          it(`(Etherscan + 4byte #${i}) ${vectors.etherscanTxHashes[i]}`, async () => {
            // Hashes on ETH mainnet that we will use to fetch full tx and ABI data with
            const getTxBase =
              'https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=';
            // 1. First fetch the transaction details from etherscan. This is just to get
            // the calldata, so it would not be needed in a production environment
            // (since we already have the calldata).
            let getTxUrl = `${getTxBase}${vectors.etherscanTxHashes[i]}`;
            const etherscanKey = getEtherscanKey()
            if (etherscanKey) {
              getTxUrl += `&apiKey=${etherscanKey}`;
            }
            const tx = await request(getTxUrl).then((res) => res.body.result);
            if (!etherscanKey) {
              // Need a timeout between requests if we don't have a key
              console.warn(
                'WARNING: No env.ETHERSCAN_KEY provided. Waiting 5s between requests...',
              );
              await new Promise((resolve) => setTimeout(resolve, 5000));
            }
            // 2. Fetch the full ABI of the contract that the transaction interacted with.
            {
              const { def, abi } = await fetchCalldataDecoder(
                tx.input,
                tx.to,
                1,
              );
              if (!def) {
                throw new Error(
                  `ERROR: Failed to decode ABI definition (${vectors.etherscanTxHashes[i]}). Skipping.`,
                );
              }
              // 3. Test decoding using Etherscan ABI info
              // Check that ethers can decode this
              const funcName = rlpDecode(def)[0] ?? '';
              if (ethersCanDecode(tx.input, abi, funcName.toString())) {
                // Send the request
                await runAbiDecoderTest({
                  txData: { data: tx.input },
                  data: { decoder: def },
                });
              } else {
                throw new Error(
                  `ERROR: ethers.js failed to decode abi for tx ${vectors.etherscanTxHashes[i]}. Skipping.`,
                );
              }
            }
            // 4. Get the canonical name from 4byte by using an unsupported chainId
            {
              const { def } = await fetchCalldataDecoder(tx.input, tx.to, -1);
              await runAbiDecoderTest({ data: { decode: def } });
            }
          });
        }

        // Validate a series of canonical definitions
        for (let i = 0; i < vectors.canonicalNames.length; i++) {
          it(`(Canonical #${i}) ${vectors.canonicalNames[i]}`, async () => {
            const req = buildEvmReq({
              data: { decoder: encDefs[i] },
              txData: { data: encDefsCalldata[i] },
            });

            // The following prints are helpful for debugging.
            // If you are testing changes to the ABI decoder in firmware, you
            // should uncomment these prints and validate that the `data` matches
            // what you see on the screen for each case. Please scroll through
            // ALL the data on the Lattice to confirm each param has properly decoded.
            // const { types, data } = convertDecoderToEthers(rlpDecode(req.data.decoder).slice(1));
            // console.log('types', types)
            // console.log('params', JSON.stringify(data))
            // for (let cd = 2; cd < calldata.length; cd += 64) {
            //   console.log(calldata.slice(cd, cd + 64));
            // }
            await runAbiDecoderTest(req);
          });
        }
        /*
        NOTE: The CRUD API to manage calldata decoders is written, but is currently
        compiled out of firmware to free up code space. For now we will leave
        these tests commented out and may re-enable them at a later date
        NOTE: You will need to re-enable `import { question } from 'readline-sync';`

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
        */
      });
    });

    //---------------------------------------
    // INTERNAL HELPERS
    //---------------------------------------
    // Determine if ethers.js can decode calldata using an ABI def
    function ethersCanDecode (calldata: any, abi: any, funcName: string) {
      try {
        const iface = new Interface(abi);
        iface.decodeFunctionData(funcName, calldata);
        return true;
      } catch (err) {
        return false;
      }
    }

    // Convert a decoder definition to something ethers can consume
  });
};
