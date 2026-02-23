import { createHash } from 'node:crypto';
import { pubkeyToAddress } from '@gridplus/xrp';
import { ecdsaVerify } from 'secp256k1';
import { fetchXrpAddresses, signXrp } from '../../../..';
import { ensureHexBuffer } from '../../../../util';
import { setupClient } from '../../../utils/setup';
import type { Client } from '../../../../client';

// XRPL Payment preimage copied byte-for-byte from firmware test vector:
// `lattice-firmware/lattice_firmware/src/currencies/currency_tests.c`
const XRP_PAYMENT_SIGN_PREIMAGE_HEX =
  '53545800120000228000000024000000016140000000000003e868400000000000000a7321ed5f5ac8b98974a3ca843326d9b88cebd0560177b973ee0b149f782cfaa06dc66a81145b812c9d57731e27a2da8b1830195f88ef32a3b68314b5f762798a53d543a014caf8b297cff8f2f937e8';
const XRP_PAYMENT_SIGN_PREIMAGE = Buffer.from([
  0x53, 0x54, 0x58, 0x00, 0x12, 0x00, 0x00, 0x22, 0x80, 0x00, 0x00, 0x00, 0x24,
  0x00, 0x00, 0x00, 0x01, 0x61, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xe8,
  0x68, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0a, 0x73, 0x21, 0xed, 0x5f,
  0x5a, 0xc8, 0xb9, 0x89, 0x74, 0xa3, 0xca, 0x84, 0x33, 0x26, 0xd9, 0xb8, 0x8c,
  0xeb, 0xd0, 0x56, 0x01, 0x77, 0xb9, 0x73, 0xee, 0x0b, 0x14, 0x9f, 0x78, 0x2c,
  0xfa, 0xa0, 0x6d, 0xc6, 0x6a, 0x81, 0x14, 0x5b, 0x81, 0x2c, 0x9d, 0x57, 0x73,
  0x1e, 0x27, 0xa2, 0xda, 0x8b, 0x18, 0x30, 0x19, 0x5f, 0x88, 0xef, 0x32, 0xa3,
  0xb6, 0x83, 0x14, 0xb5, 0xf7, 0x62, 0x79, 0x8a, 0x53, 0xd5, 0x43, 0xa0, 0x14,
  0xca, 0xf8, 0xb2, 0x97, 0xcf, 0xf8, 0xf2, 0xf9, 0x37, 0xe8,
]);

// XRPL OfferCreate preimage (XRP/XRP amounts), from firmware vector:
// `lattice-firmware/lattice_firmware/src/currencies/currency_tests.c`
const XRP_OFFER_CREATE_XRP_XRP_PREIMAGE_HEX =
  '53545800120007228008000024000000022a6b49d2006440000000004c4b406540000000002625a068400000000000000c7321ed5f5ac8b98974a3ca843326d9b88cebd0560177b973ee0b149f782cfaa06dc66a81145b812c9d57731e27a2da8b1830195f88ef32a3b6';
const XRP_OFFER_CREATE_XRP_XRP_PREIMAGE = Buffer.from(
  XRP_OFFER_CREATE_XRP_XRP_PREIMAGE_HEX,
  'hex',
);

// XRPL OfferCreate preimage (IOU/XRP amounts), from firmware vector:
// `lattice-firmware/lattice_firmware/src/currencies/currency_tests.c`
const XRP_OFFER_CREATE_IOU_XRP_PREIMAGE_HEX =
  '535458001200072280010000240000000964d4838d7ea4c680000000000000000000000000005553440000000000b5f762798a53d543a014caf8b297cff8f2f937e8654000000002faf08068400000000000000c7321ed5f5ac8b98974a3ca843326d9b88cebd0560177b973ee0b149f782cfaa06dc66a81145b812c9d57731e27a2da8b1830195f88ef32a3b6';
const XRP_OFFER_CREATE_IOU_XRP_PREIMAGE = Buffer.from(
  XRP_OFFER_CREATE_IOU_XRP_PREIMAGE_HEX,
  'hex',
);

// XRPL OfferCancel preimage, from firmware vector:
// `lattice-firmware/lattice_firmware/src/currencies/currency_tests.c`
const XRP_OFFER_CANCEL_PREIMAGE_HEX =
  '535458001200082280000000240000000520190000000368400000000000000a7321ed5f5ac8b98974a3ca843326d9b88cebd0560177b973ee0b149f782cfaa06dc66a81145b812c9d57731e27a2da8b1830195f88ef32a3b6';
const XRP_OFFER_CANCEL_PREIMAGE = Buffer.from(
  XRP_OFFER_CANCEL_PREIMAGE_HEX,
  'hex',
);

const sha512half = (msg: Buffer) =>
  createHash('sha512').update(msg).digest().subarray(0, 32);
const XRP_E2E_TIMEOUT_MS = Number(process.env.XRP_E2E_TIMEOUT_MS ?? 180000);

const assertValidXrpSignature = async (payload: Buffer) => {
  const resp = await signXrp(payload);
  expect(resp.sig).toBeTruthy();
  expect(resp.pubkey).toBeTruthy();

  const r = ensureHexBuffer(resp.sig?.r as Buffer | string, false);
  const s = ensureHexBuffer(resp.sig?.s as Buffer | string, false);
  const signature = Buffer.concat([r, s]);
  expect(signature.length).toEqual(64);

  const digest = sha512half(payload);
  const pubkey = Buffer.from(resp.pubkey as Buffer);
  const isValid = ecdsaVerify(signature, digest, pubkey);
  expect(isValid).toEqual(true);
};

describe('[XRP]', () => {
  let client: Client;
  let supportsXrp = true;

  beforeAll(async () => {
    expect(XRP_PAYMENT_SIGN_PREIMAGE.toString('hex')).toEqual(
      XRP_PAYMENT_SIGN_PREIMAGE_HEX,
    );
    expect(XRP_OFFER_CREATE_XRP_XRP_PREIMAGE.toString('hex')).toEqual(
      XRP_OFFER_CREATE_XRP_XRP_PREIMAGE_HEX,
    );
    expect(XRP_OFFER_CREATE_IOU_XRP_PREIMAGE.toString('hex')).toEqual(
      XRP_OFFER_CREATE_IOU_XRP_PREIMAGE_HEX,
    );
    expect(XRP_OFFER_CANCEL_PREIMAGE.toString('hex')).toEqual(
      XRP_OFFER_CANCEL_PREIMAGE_HEX,
    );
    console.info(`[XRP] Test payload hex: ${XRP_PAYMENT_SIGN_PREIMAGE_HEX}`);

    client = await setupClient();
    if (Number.isFinite(XRP_E2E_TIMEOUT_MS) && XRP_E2E_TIMEOUT_MS > 0) {
      client.timeout = XRP_E2E_TIMEOUT_MS;
    }
    console.info(`[XRP] Client timeout(ms): ${client.timeout}`);

    const fw = client.getFwConstants();
    const fwVersion = client.getFwVersion();
    const encodingTypes = (fw?.genericSigning?.encodingTypes ?? {}) as Record<
      string,
      unknown
    >;
    const hashTypes = (fw?.genericSigning?.hashTypes ?? {}) as Record<
      string,
      unknown
    >;
    const hasXrpEncoding = encodingTypes.XRP !== undefined;
    const hasSha512Half = hashTypes.SHA512HALF !== undefined;

    console.info(
      `[XRP] Device firmware: ${fwVersion.major}.${fwVersion.minor}.${fwVersion.fix}`,
    );
    console.info(
      `[XRP] Generic encodings: ${Object.keys(encodingTypes).join(', ')}`,
    );
    console.info(`[XRP] Generic hashes: ${Object.keys(hashTypes).join(', ')}`);
    console.info(
      `[XRP] Capability check -> encoding.XRP=${hasXrpEncoding} hash.SHA512HALF=${hasSha512Half}`,
    );

    supportsXrp = hasXrpEncoding && hasSha512Half;
    if (!supportsXrp) {
      console.warn(
        '[XRP] Firmware v0.18.10+ with XRP encoding + SHA512HALF support is required. Skipping tests.',
      );
    }
  });

  it(
    'Should sign a known XRPL payment preimage and produce a valid secp256k1 signature',
    async (ctx) => {
      if (!supportsXrp) {
        ctx.skip();
        return;
      }
      await assertValidXrpSignature(XRP_PAYMENT_SIGN_PREIMAGE);
    },
    XRP_E2E_TIMEOUT_MS + 10000,
  );

  it(
    'Should sign a known XRPL OfferCreate (XRP/XRP) preimage and produce a valid secp256k1 signature',
    async (ctx) => {
      if (!supportsXrp) {
        ctx.skip();
        return;
      }
      await assertValidXrpSignature(XRP_OFFER_CREATE_XRP_XRP_PREIMAGE);
    },
    XRP_E2E_TIMEOUT_MS + 10000,
  );

  it(
    'Should sign a known XRPL OfferCreate (IOU/XRP) preimage and produce a valid secp256k1 signature',
    async (ctx) => {
      if (!supportsXrp) {
        ctx.skip();
        return;
      }
      await assertValidXrpSignature(XRP_OFFER_CREATE_IOU_XRP_PREIMAGE);
    },
    XRP_E2E_TIMEOUT_MS + 10000,
  );

  it(
    'Should sign a known XRPL OfferCancel preimage and produce a valid secp256k1 signature',
    async (ctx) => {
      if (!supportsXrp) {
        ctx.skip();
        return;
      }
      await assertValidXrpSignature(XRP_OFFER_CANCEL_PREIMAGE);
    },
    XRP_E2E_TIMEOUT_MS + 10000,
  );

  it(
    'Should return an XRP address consistent with the signer pubkey at the default path',
    async (ctx) => {
      if (!supportsXrp) {
        ctx.skip();
        return;
      }

      const [address] = await fetchXrpAddresses({ n: 1, startPathIndex: 0 });
      expect(typeof address).toEqual('string');
      expect(address.startsWith('r')).toEqual(true);

      const resp = await signXrp(XRP_PAYMENT_SIGN_PREIMAGE);
      const pubkey = resp.pubkey as Buffer;
      expect(pubkey).toBeTruthy();

      const derivedAddress = pubkeyToAddress(pubkey);
      expect(derivedAddress).toEqual(address);
    },
    XRP_E2E_TIMEOUT_MS + 10000,
  );
});
