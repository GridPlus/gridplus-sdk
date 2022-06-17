import { Client } from '../../../client';
import { Constants } from '../../..';
import { getNumIter } from '../../utils/builders';
import { prandomBuf, ethPersonalSignMsg } from '../../utils/helpers';
import { runGeneric } from '../../utils/runners';
import { HARDENED_OFFSET } from '../../../constants';
import { getPrng } from '../../utils/getters';

export const runUnformattedTests = ({ client }: { client: Client }) => {
  const prng = getPrng();

  const numIter = getNumIter();
  const DEFAULT_SIGNER = [
    HARDENED_OFFSET + 44,
    HARDENED_OFFSET + 60,
    HARDENED_OFFSET,
    0,
    0,
  ];
  describe('[Unformatted]', () => {
    const getReq = (overrides: any) => ({
      data: {
        signerPath: DEFAULT_SIGNER,
        curveType: Constants.SIGNING.CURVES.SECP256K1,
        hashType: Constants.SIGNING.HASHES.KECCAK256,
        payload: null,
        ...overrides,
      },
    });

    it('Should test pre-hashed messages', async () => {
      const fwConstants = client.getFwConstants();
      const { extraDataFrameSz, extraDataMaxFrames, genericSigning } =
        fwConstants;
      const { baseDataSz } = genericSigning;
      // Max size that won't be prehashed
      const maxSz = baseDataSz + extraDataMaxFrames * extraDataFrameSz;

      // Use extraData frames
      await runGeneric(
        getReq({
          payload: `0x${prandomBuf(prng, maxSz, true).toString('hex')}`,
        }),
        client,
      );

      // Prehash (keccak256)
      await runGeneric(
        getReq({
          payload: `0x${prandomBuf(prng, maxSz + 1, true).toString('hex')}`,
        }),
        client,
      );

      // Prehash (sha256)
      await runGeneric(
        getReq({
          payload: `0x${prandomBuf(prng, maxSz + 1, true).toString('hex')}`,
          hashType: Constants.SIGNING.HASHES.SHA256,
        }),
        client,
      );
    });

    it('Should test ASCII text formatting', async () => {
      // Build a payload that uses spaces and newlines
      await runGeneric(
        getReq({
          payload: JSON.stringify(
            {
              testPayload: 'json with spaces',
              anotherThing: -1,
            },
            null,
            2,
          ),
        }),
        client,
      );
    });

    it('Should validate SECP256K1/KECCAK signature against derived key', async () => {
      // ASCII message encoding
      await runGeneric(getReq({ payload: 'test' }), client);

      // Hex message encoding
      const req = getReq({ payload: '0x123456' });
      await runGeneric(req, client);
    });

    it('Should validate ED25519/NULL signature against derived key', async () => {
      const req = getReq({
        payload: '0x123456',
        curveType: Constants.SIGNING.CURVES.ED25519,
        /* Not doing anything. It is commented out. */
        hashType: Constants.SIGNING.HASHES.NONE,
        // ED25519 derivation requires hardened indices
        signerPath: DEFAULT_SIGNER.slice(0, 3),
      });
      // Make generic signing request
      await runGeneric(req, client);
    });

    it('Should validate SECP256K1/KECCAK signature against ETH_MSG request (legacy)', async () => {
      // Generic request
      const msg = 'Testing personal_sign';
      const psMsg = ethPersonalSignMsg(msg);
      // NOTE: The request contains some non ASCII characters so it will get
      // encoded as hex automatically.
      const req = getReq({
        payload: psMsg,
      });

      const respGeneric = await runGeneric(req, client);

      // Legacy request
      const legacyReq = {
        currency: 'ETH_MSG',
        data: {
          signerPath: req.data.signerPath,
          payload: msg,
          protocol: 'signPersonal',
        },
      };
      const respLegacy = await client.sign(legacyReq);

      const genSigR = respGeneric.sig?.r.toString('hex') ?? '';
      const genSigS = respGeneric.sig?.s.toString('hex') ?? '';
      const legSigR = respLegacy.sig?.r.toString('hex') ?? '';
      const legSigS = respLegacy.sig?.s.toString('hex') ?? '';

      const genSig = `${genSigR}${genSigS}`;
      const legSig = `${legSigR}${legSigS}`;
      expect(genSig).toEqualElseLog(
        legSig,
        'Legacy and generic requests produced different sigs.',
      );
    });

    for (let i = 0; i < numIter; i++) {
      it(`Should test random payloads - #${i}`, async () => {
        const fwConstants = client.getFwConstants();
        const req = getReq({
          hashType: Constants.SIGNING.HASHES.KECCAK256,
          curveType: Constants.SIGNING.CURVES.SECP256K1,
          payload: prandomBuf(prng, fwConstants.genericSigning.baseDataSz),
        });

        // 1. Secp256k1/keccak256
        await runGeneric(req, client);

        // 2. Secp256k1/sha256
        req.data.hashType = Constants.SIGNING.HASHES.SHA256;
        await runGeneric(req, client);

        // 3. Ed25519
        req.data.curveType = Constants.SIGNING.CURVES.ED25519;
        req.data.hashType = Constants.SIGNING.HASHES.NONE;
        req.data.signerPath = DEFAULT_SIGNER.slice(0, 3);
        await runGeneric(req, client);
      });
    }
  });
};
