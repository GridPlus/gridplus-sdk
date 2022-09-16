import { getDeviceId } from '../../utils/getters';
import { HARDENED_OFFSET } from '../../../constants';
import { randomBytes } from '../../../util';
import {
  buildMsgReq,
  buildRandomVectors,
  buildTx,
  buildTxReq,
  DEFAULT_SIGNER,
} from '../../utils/builders';
import {
  deriveAddress,
  setupJob,
  signPersonalJS,
  testUniformSigs,
  TEST_SEED,
} from '../../utils/determinism';
import {
  BTC_PURPOSE_P2PKH,
  copyBuffer,
  deserializeExportSeedJobResult,
  ETH_COIN,
  getSigStr,
  gpErrors,
  jobTypes,
} from '../../utils/helpers';
import { initializeClient, initializeSeed } from '../../utils/initializeClient';
import { runTestCase } from '../../utils/runners';
let seed: Buffer;
let client;

describe('[Determinism]', () => {
  client = initializeClient();

  describe('Setup and validate seed', () => {
    it('Should re-connect to the Lattice and update the walletUID.', async () => {
      expect(getDeviceId()).to.not.equal(null);
      await client.connect(getDeviceId());
      expect(client.isPaired).toEqual(true);
      expect(!!client.getActiveWallet()).toEqual(true);
    });

    it('Should remove the seed', async () => {
      // Make sure a seed was exported
      seed = await initializeSeed(client);
      if (!seed) {
        throw new Error('No seed was exported');
      }
      const testRequestPayload = setupJob(
        jobTypes.WALLET_JOB_DELETE_SEED,
        client,
      );
      await runTestCase(testRequestPayload, gpErrors.GP_SUCCESS);
    });

    it('Should load the known test seed', async () => {
      const testRequestPayload = setupJob(
        jobTypes.WALLET_JOB_LOAD_SEED,
        client,
        TEST_SEED,
      );
      await runTestCase(testRequestPayload, gpErrors.GP_SUCCESS);
    });

    it('Should re-connect to the Lattice and update the walletUID.', async () => {
      expect(getDeviceId()).to.not.equal(null);
      await client.connect(getDeviceId());
      expect(client.isPaired).toEqual(true);
      expect(!!client.getActiveWallet()).toEqual(true);
    });

    it('Should ensure export seed matches the test seed', async () => {
      const testRequestPayload = setupJob(
        jobTypes.WALLET_JOB_EXPORT_SEED,
        client,
      );
      const _res = await runTestCase(testRequestPayload, gpErrors.GP_SUCCESS);
      const { seed } = deserializeExportSeedJobResult(_res.result);
      expect(seed.toString('hex')).toEqualElseLog(
        TEST_SEED.toString('hex'),
        'Seeds did not match',
      );
    });

    it('Should validate some Ledger addresses derived from the test seed', async () => {
      // These addresses were all fetched using MetaMask with a real ledger loaded with TEST_MNEOMNIC
      // NOTE: These are 0-indexed indices whereas MetaMask shows 1-indexed (addr0 -> metamask1)
      const path0 = [BTC_PURPOSE_P2PKH, ETH_COIN, HARDENED_OFFSET, 0, 0] as WalletPath;
      const addr0 = '0x17E43083812d45040E4826D2f214601bc730F60C';
      const path1 = [BTC_PURPOSE_P2PKH, ETH_COIN, HARDENED_OFFSET + 1, 0, 0] as WalletPath;
      const addr1 = '0xfb25a9D4472A55083042672e42309056763B667E';
      const path8 = [BTC_PURPOSE_P2PKH, ETH_COIN, HARDENED_OFFSET + 8, 0, 0] as WalletPath;
      const addr8 = '0x8A520d7f70906Ebe00F40131791eFF414230Ea5c';
      // Derive these from the seed as a sanity check
      expect(deriveAddress(TEST_SEED, path0).toLowerCase()).toEqualElseLog(
        addr0.toLowerCase(),
        'Incorrect address 0 derived.',
      );
      expect(deriveAddress(TEST_SEED, path1).toLowerCase()).toEqualElseLog(
        addr1.toLowerCase(),
        'Incorrect address 1 derived.',
      );
      expect(deriveAddress(TEST_SEED, path8).toLowerCase()).toEqualElseLog(
        addr8.toLowerCase(),
        'Incorrect address 8 derived.',
      );
      // Fetch these addresses from the Lattice and validate

      const req = {
        currency: 'ETH',
        startPath: path0,
        n: 1,
      };
      const latAddr0 = await client.getAddresses(req);
      //@ts-expect-error - Returns strings sometimes
      expect(latAddr0[0].toLowerCase()).toEqualElseLog(
        addr0.toLowerCase(),
        'Incorrect address 0 fetched.',
      );
      req.startPath = path1;
      const latAddr1 = await client.getAddresses(req);
      //@ts-expect-error - Returns strings sometimes
      expect(latAddr1[0].toLowerCase()).toEqualElseLog(
        addr1.toLowerCase(),
        'Incorrect address 1 fetched.',
      );
      req.startPath = path8;
      const latAddr8 = await client.getAddresses(req);
      //@ts-expect-error - Returns strings sometimes
      expect(latAddr8[0].toLowerCase()).toEqualElseLog(
        addr8.toLowerCase(),
        'Incorrect address 8 fetched.',
      );
    });
  });

  describe('Test uniformity of Ethereum transaction sigs', () => {
    it('Should validate uniformity sigs on m/44\'/60\'/0\'/0/0', async () => {
      const tx = buildTx();
      const txReq = buildTxReq(tx);
      txReq.data.signerPath[2] = HARDENED_OFFSET;
      await testUniformSigs(txReq, tx, client);
    });

    it('Should validate uniformity sigs on m/44\'/60\'/1\'/0/0', async () => {
      const tx = buildTx();
      const txReq = buildTxReq(tx);
      txReq.data.signerPath[2] = HARDENED_OFFSET + 1;
      await testUniformSigs(txReq, tx, client);
    });

    it('Should validate uniformity sigs on m/44\'/60\'/8\'/0/0', async () => {
      const tx = buildTx();
      const txReq = buildTxReq(tx);
      txReq.data.signerPath[2] = HARDENED_OFFSET + 8;
      await testUniformSigs(txReq, tx, client);
    });

    it('Should validate uniformity sigs on m/44\'/60\'/0\'/0/0', async () => {
      const tx = buildTx(`0x${randomBytes(4000).toString('hex')}`);
      const txReq = buildTxReq(tx);
      txReq.data.signerPath[2] = HARDENED_OFFSET;
      await testUniformSigs(txReq, tx, client);
    });

    it('Should validate uniformity sigs on m/44\'/60\'/1\'/0/0', async () => {
      const tx = buildTx(`0x${randomBytes(4000).toString('hex')}`);
      const txReq = buildTxReq(tx);
      txReq.data.signerPath[2] = HARDENED_OFFSET + 1;
      await testUniformSigs(txReq, tx, client);
    });

    it('Should validate uniformity sigs on m/44\'/60\'/8\'/0/0', async () => {
      const tx = buildTx(`0x${randomBytes(4000).toString('hex')}`);
      const txReq = buildTxReq(tx);
      txReq.data.signerPath[2] = HARDENED_OFFSET + 8;
      await testUniformSigs(txReq, tx, client);
    });
  });

  describe('Compare personal_sign signatures vs Ledger vectors (1)', () => {
    it('Should validate signature from addr0', async () => {
      const expected =
        '4820a558ab69907c90141f4857f54a7d71e7791f84478fef7b9a3e5b200ee242' + // r
        '529cc19a58ed8fa017510d24a443b757018834b3e3585a7199168d3af4b3837e' + // s
        '01'; // v
      const msgReq = buildMsgReq();
      msgReq.data.signerPath[2] = HARDENED_OFFSET;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqualElseLog(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(
        msgReq.data.payload,
        msgReq.data.signerPath,
      );
      expect(sig).toEqualElseLog(jsSig, 'JS sig does not match');
    });

    it('Should validate signature from addr1', async () => {
      const expected =
        'c292c988b26ae24a06a8270f2794c259ec5742168ed77cd635cba041f767a569' + // r
        '2e4d218a02ba0b5f82b80488ccc519b67fb37a9f4cbb1d35d9ce4b99e8afcc18' + // s
        '01'; // v
      const msgReq = buildMsgReq();
      msgReq.data.signerPath[2] = HARDENED_OFFSET + 1;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqualElseLog(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(
        msgReq.data.payload,
        msgReq.data.signerPath,
      );
      expect(sig).toEqualElseLog(jsSig, 'JS sig does not match');
    });

    it('Should validate signature from addr8', async () => {
      const expected =
        '60cadafdbb7cba590a37eeff854d2598af71904077312875ef7b4f525d4dcb52' + // r
        '5903ae9e4b7e61f6f24abfe9a1d5fb1375347ef6a48f7abe2319c89f426eb27c' + // s
        '00'; // v
      const msgReq = buildMsgReq();
      msgReq.data.signerPath[2] = HARDENED_OFFSET + 8;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqualElseLog(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(
        msgReq.data.payload,
        msgReq.data.signerPath,
      );
      expect(sig).toEqualElseLog(jsSig, 'JS sig does not match');
    });
  });

  describe('Compare personal_sign signatures vs Ledger vectors (2)', () => {
    it('Should validate signature from addr0', async () => {
      const expected =
        'b4fb4e0db168de42781ee1a27a1e907d5ec39aaccf24733846739f94f5b4542f' + // r
        '65639d4aa368a5510c64e758732de419ac6489efeaf9e3cb29a616a2c624c2c7' + // s
        '01'; // v
      const msgReq = buildMsgReq('hello ethereum this is another message');
      msgReq.data.signerPath[2] = HARDENED_OFFSET;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqualElseLog(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(
        msgReq.data.payload,
        msgReq.data.signerPath,
      );
      expect(sig).toEqualElseLog(jsSig, 'JS sig does not match');
    });

    it('Should validate signature from addr1', async () => {
      const expected =
        '1318229681d8fcdf6db12819c8859501186a3c792543d38a38643c6f185dd252' + // r
        '6a7655b7ff8b5a2bdfa5023abd91e04c7c7a8f8ee491122da17e13dd85ede531' + // s
        '01'; // v
      const msgReq = buildMsgReq('hello ethereum this is another message');
      msgReq.data.signerPath[2] = HARDENED_OFFSET + 1;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqualElseLog(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(
        msgReq.data.payload,
        msgReq.data.signerPath,
      );
      expect(sig).toEqualElseLog(jsSig, 'JS sig does not match');
    });

    it('Should validate signature from addr8', async () => {
      const expected =
        'c748f3fbf9f517fbd33462a858b40615ab6747295c27b4a46568d7d08c1d9d32' + // r
        '0e14363c2885feaee0e4393454292be1ee3a1f32fb95571231db09a2b3bd8737' + // s
        '00'; // v
      const msgReq = buildMsgReq('hello ethereum this is another message');
      msgReq.data.signerPath[2] = HARDENED_OFFSET + 8;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqualElseLog(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(
        msgReq.data.payload,
        msgReq.data.signerPath,
      );
      expect(sig).toEqualElseLog(jsSig, 'JS sig does not match');
    });
  });

  describe('Compare personal_sign signatures vs Ledger vectors (3)', () => {
    it('Should validate signature from addr0', async () => {
      const expected =
        'f245100f07a6c695140fda7e29097034b3c97be94910639d20efdff5c96387fd' + // r
        '6703f40f53647528ed93ac929a256ed1f09eba316a5e94daac2a464356b14058' + // s
        '00'; // v
      const msgReq = buildMsgReq('third vector yo');
      msgReq.data.signerPath[2] = HARDENED_OFFSET;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqualElseLog(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(
        msgReq.data.payload,
        msgReq.data.signerPath,
      );
      expect(sig).toEqualElseLog(jsSig, 'JS sig does not match');
    });

    it('Should validate signature from addr1', async () => {
      const expected =
        '3a42c4955e4fb7ee2c4ee58df79c4be5f62839e691c169b74f90eafd371e2065' + // r
        '51c7fc3da33dff2d2961ac7909244b4c32deee70abf7fac0e088184853cdff4a' + // s
        '01'; // v
      const msgReq = buildMsgReq('third vector yo');
      msgReq.data.signerPath[2] = HARDENED_OFFSET + 1;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqualElseLog(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(
        msgReq.data.payload,
        msgReq.data.signerPath,
      );
      expect(sig).toEqualElseLog(jsSig, 'JS sig does not match');
    });

    it('Should validate signature from addr8', async () => {
      const expected =
        '3e55dbb101880960cb32c17237d3ceb9d5846cf2f68c5c4c504cb827ea6a2e73' + // r
        '22254bb6f6464c95dd743c506e7bc71eb90ceab17d2fd3b02e6636c508b14cc7' + // s
        '00'; // v
      const msgReq = buildMsgReq('third vector yo');
      msgReq.data.signerPath[2] = HARDENED_OFFSET + 8;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqualElseLog(expected, 'Lattice sig does not match');
      const jsSig = signPersonalJS(
        msgReq.data.payload,
        msgReq.data.signerPath,
      );
      expect(sig).toEqualElseLog(jsSig, 'JS sig does not match');
    });
  });

  describe('Compare EIP712 signatures vs Ledger vectors (1)', () => {
    const msgReq = {
      currency: 'ETH_MSG',
      data: {
        signerPath: DEFAULT_SIGNER,
        protocol: 'eip712',
        payload: {
          types: {
            Greeting: [
              {
                name: 'salutation',
                type: 'string',
              },
              {
                name: 'target',
                type: 'string',
              },
              {
                name: 'born',
                type: 'int32',
              },
            ],
            EIP712Domain: [
              {
                name: 'chainId',
                type: 'uint256',
              },
            ],
          },
          domain: {
            chainId: 1,
          },
          primaryType: 'Greeting',
          message: {
            salutation: 'Hello',
            target: 'Ethereum',
            born: '2015',
          },
        },
      },
    };

    it('Should validate signature from addr0', async () => {
      const expected =
        'dbf9a493935770f97a1f0886f370345508398ac76fbf31ccf1c30d8846d3febf' + // r
        '047e8ae03e146044e7857f1e485921a9d978b1ead93bdd0de6be619dfb72f0b5' + // s
        '01'; // v
      msgReq.data.signerPath[2] = HARDENED_OFFSET;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqual(expected);
    });

    it('Should validate signature from addr1', async () => {
      const expected =
        '9e784c6388f6f938f94239c67dc764909b86f34ec29312f4c623138fd7192115' + // r
        '5efbc9af2339e04303bf300366a675dd90d33fdb26d131c17b278725d36d728e' + // s
        '00'; // v
      msgReq.data.signerPath[2] = HARDENED_OFFSET + 1;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqual(expected);
    });

    it('Should validate signature from addr8', async () => {
      const expected =
        '6e7e9bfc4773291713bb5cdc483057d43a95a5082920bdd1dd3470caf6f11155' + // r
        '6c163b7d489f37ffcecfd20dab2de6a8a04f79af7e265b249db9b4973e75c7d1' + // s
        '00'; // v
      msgReq.data.signerPath[2] = HARDENED_OFFSET + 8;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqual(expected);
    });
  });

  describe('Compare EIP712 signatures vs Ledger vectors (2)', () => {
    const msgReq = {
      currency: 'ETH_MSG',
      data: {
        signerPath: DEFAULT_SIGNER,
        protocol: 'eip712',
        payload: {
          types: {
            MuhType: [
              {
                name: 'thing',
                type: 'string',
              },
            ],
            EIP712Domain: [
              {
                name: 'chainId',
                type: 'uint256',
              },
            ],
          },
          domain: {
            chainId: 1,
          },
          primaryType: 'MuhType',
          message: {
            thing: 'I am a string',
          },
        },
      },
    };

    it('Should validate signature from addr0', async () => {
      const expected =
        '0a1843ee1be7bf1ddd8bb32230ee3842b47022b8ba8795d3522db8a7341a9b85' + // r
        '72d0e38463b5a7e1f1d1acd09acb8db936af52bdcab6374abb7013842b6840b8' + // s
        '01'; // v
      msgReq.data.signerPath[2] = HARDENED_OFFSET;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqual(expected);
    });

    it('Should validate signature from addr1', async () => {
      const expected =
        'f5284359479eb32eefe88bd24de59e4fd656d82238c7752e7a576b7a875eb5ae' + // r
        '6ef7b021f5bed2122161de6b373d5ee0aa9a3e4d3f499b3bb95ad5b9ed9f7bd9' + // s
        '00'; // v
      msgReq.data.signerPath[2] = HARDENED_OFFSET + 1;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqual(expected);
    });

    it('Should validate signature from addr8', async () => {
      const expected =
        'f7a94b7ba7e0fbab88472cb77c5c255ba36e60e9f90bf4073960082bb5ef17cf' + // r
        '2e3b79ebad1f0ee96e0d3fe862372a1e586dba1bee309adf8c338b5e42d3424e' + // s
        '00'; // v
      msgReq.data.signerPath[2] = HARDENED_OFFSET + 8;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqual(expected);
    });
  });

  describe('Compare EIP712 signatures vs Ledger vectors (3)', () => {
    const msgReq = {
      currency: 'ETH_MSG',
      data: {
        signerPath: DEFAULT_SIGNER,
        protocol: 'eip712',
        payload: {
          types: {
            MuhType: [
              {
                name: 'numbawang',
                type: 'uint32',
              },
            ],
            EIP712Domain: [
              {
                name: 'chainId',
                type: 'uint256',
              },
            ],
          },
          domain: {
            chainId: 1,
          },
          primaryType: 'MuhType',
          message: {
            numbawang: 999,
          },
        },
      },
    };

    it('Should validate signature from addr0', async () => {
      const expected =
        'c693714421acbba9fb8fdcd825295b6042802b06a55ae17a65db510dd5a348e0' + // r
        '2ffed1a8dbaf63919727c0b5e52978e9dce3638b0385fda45e022a50bab510eb' + // s
        '01'; // v
      msgReq.data.signerPath[2] = HARDENED_OFFSET;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqual(expected);
    });
    it('Should validate signature from addr1', async () => {
      const expected =
        '4a32a478f6f772b37d8cfffabe8ee7c7956d45fd098035163c92b06564ead034' + // r
        '2eb54cde42f636f63f72615b53510e970a9f7ff2c4527b753ef0eb8ce1ee4a44' + // s
        '00'; // v
      msgReq.data.signerPath[2] = HARDENED_OFFSET + 1;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqual(expected);
    });
    it('Should validate signature from addr8', async () => {
      const expected =
        '7a9f4e67309efb733fc4092f69f95583e06ccf4b25a364d9a9dc51b921edb464' + // r
        '22c310c83fd61936618b8f1caaa0b82ac492822e6a5d1a65cd5fb3f0bc0126bf' + // s
        '00'; // v
      msgReq.data.signerPath[2] = HARDENED_OFFSET + 8;
      const res = await client.sign(msgReq);
      const sig = getSigStr(res);
      expect(sig).toEqual(expected);
    });
  });

  describe('Test random personal_sign messages against JS signatures', () => {
    const randomVectors = buildRandomVectors();
    const signerPathOffsets = [0, 1, 8];

    randomVectors.forEach((payload, i) => {
      signerPathOffsets.forEach(async (offset) => {
        it(`Should test random vector: ${i} with offset ${offset}`, async () => {
          const req = {
            currency: 'ETH_MSG',
            data: {
              signerPath: DEFAULT_SIGNER,
              protocol: 'signPersonal',
              payload,
            },
          };
          req.data.signerPath[2] = HARDENED_OFFSET + offset;
          const jsSig = signPersonalJS(req.data.payload, req.data.signerPath);
          const res = await client.sign(req);
          const sig = getSigStr(res);
          expect(sig).toEqualElseLog(jsSig, `Addr${offset} sig failed`);
        });
      });
    });
  });

  describe('Teardown Test', () => {
    it('Should remove the seed', async () => {
      const testRequestPayload = setupJob(
        jobTypes.WALLET_JOB_DELETE_SEED,
        client,
      );
      await runTestCase(testRequestPayload, gpErrors.GP_SUCCESS);
    });

    it('Should load the seed', async () => {
      const testRequestPayload = setupJob(
        jobTypes.WALLET_JOB_LOAD_SEED,
        client,
        seed,
      );
      await runTestCase(testRequestPayload, gpErrors.GP_SUCCESS);
    });

    it('Should re-connect to the Lattice and update the walletUID.', async () => {
      expect(getDeviceId()).to.not.equal(null);
      await client.connect(getDeviceId());
      expect(client.isPaired).toEqual(true);
      expect(!!client.getActiveWallet()).toEqual(true);
    });

    it('Should ensure export seed matches the seed we just loaded', async () => {
      // Export the seed and make sure it matches!
      const testRequestPayload = setupJob(
        jobTypes.WALLET_JOB_EXPORT_SEED,
        client,
      );
      const _res = await runTestCase(testRequestPayload, gpErrors.GP_SUCCESS);
      const res = deserializeExportSeedJobResult(_res.result);
      const exportedSeed = copyBuffer(res.seed);
      expect(exportedSeed.toString('hex')).toEqual(seed.toString('hex'));
    });
  });
});
