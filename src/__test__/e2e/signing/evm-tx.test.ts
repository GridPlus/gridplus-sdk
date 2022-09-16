/**
Test various EVM transaction types.

You must have `FEATURE_TEST_RUNNER=1` enabled in firmware to run these tests.
 */
import Common, { Chain, Hardfork } from '@ethereumjs/common';
import { TransactionFactory as EthTxFactory } from '@ethereumjs/tx';
import { BN } from 'bn.js';
import { encode as rlpEncode } from 'rlp';
import { randomBytes } from '../../../util';
import { buildEvmReq, DEFAULT_SIGNER, getNumIter } from '../../utils/builders';
import { runEvm } from '../../utils/runners';
import { initializeClient, initializeSeed } from '../../utils/initializeClient';
//---------------------------------------
// STATE DATA
//---------------------------------------
let client;
let CURRENT_SEED = null;

//---------------------------------------
// TESTS
//---------------------------------------
describe('[EVM TX]', () => {
  client = initializeClient();
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
      useLegacySigning
    ).catch((err) => {
      if (err.responseCode === 128) {
        err.message =
          'NOTE: You must have `FEATURE_TEST_RUNNER=1` enabled in firmware to run these tests.\n' +
          err.message;
      }
      throw err;
    });
  };

  it('Should get the current wallet seed',  async () => {
    CURRENT_SEED = await initializeSeed(client);
  })

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
        // Should display as 1e-18
        await runBoundaryTest({ txData: { value: 1 } });
        // 1e-8 -> should display as 1e-8
        await runBoundaryTest({ txData: { value: 10000000000 } });
        // 1e-7 -> should display as 0.00000001
        await runBoundaryTest({ txData: { value: 100000000000 } });
        // 1e18 = 1 ETH
        await runBoundaryTest({ txData: { value: '0xde0b6b3a7640000' } });
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
        await expect(
          runBoundaryTest(getParamPayloadReq(0), true, true)
        ).rejects.toThrow();

        // Gas
        await expect(
          runBoundaryTest(getParamPayloadReq(1), true, true)
        ).rejects.toThrow();

        // Gas Price
        await expect(
          runBoundaryTest(getParamPayloadReq(2), true, true)
        ).rejects.toThrow();

        // Value
        await expect(
          runBoundaryTest(getParamPayloadReq(4), true, true)
        ).rejects.toThrow();

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
});

