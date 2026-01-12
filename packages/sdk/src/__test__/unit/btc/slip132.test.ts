import bs58check from 'bs58check';
import { SLIP132_VERSION_BYTES } from '../../../btc/constants';
import {
  getPrefix,
  normalize,
  format,
  inferPurpose,
  getVersionBytes,
} from '../../../btc/slip132';

const TEST_XPUB =
  'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8';
const toVersion = (xpub: string, version: number) => {
  const decoded = Buffer.from(bs58check.decode(xpub));
  decoded.writeUInt32BE(version, 0);
  return bs58check.encode(decoded);
};

const TEST_TPUB = toVersion(TEST_XPUB, SLIP132_VERSION_BYTES.tpub.public);

describe('btc/slip132', () => {
  describe('getPrefix', () => {
    it('identifies xpub prefix', () => {
      expect(getPrefix(TEST_XPUB)).toBe('xpub');
    });

    it('identifies tpub prefix', () => {
      expect(getPrefix(TEST_TPUB)).toBe('tpub');
    });

    it('throws for invalid xpub', () => {
      expect(() => getPrefix('invalid')).toThrow();
    });
  });

  describe('getVersionBytes', () => {
    it('extracts version bytes from xpub', () => {
      expect(getVersionBytes(TEST_XPUB)).toBe(0x0488b21e);
    });
  });

  describe('normalize', () => {
    it('normalizes xpub to xpub (no change)', () => {
      const result = normalize(TEST_XPUB);
      expect(result.startsWith('xpub')).toBe(true);
    });

    it('normalizes ypub to xpub', () => {
      const ypub = format(TEST_XPUB, 49, 'mainnet');
      const result = normalize(ypub);
      expect(result.startsWith('xpub')).toBe(true);
    });
  });

  describe('format', () => {
    it('formats xpub to ypub for purpose 49', () => {
      const result = format(TEST_XPUB, 49, 'mainnet');
      expect(result.startsWith('ypub')).toBe(true);
    });

    it('formats xpub to zpub for purpose 84', () => {
      const result = format(TEST_XPUB, 84, 'mainnet');
      expect(result.startsWith('zpub')).toBe(true);
    });

    it('formats to testnet prefix for testnet network', () => {
      const result = format(TEST_XPUB, 44, 'testnet');
      expect(result.startsWith('tpub')).toBe(true);
    });
  });

  describe('inferPurpose', () => {
    it('infers purpose 44 from xpub', () => {
      expect(inferPurpose(TEST_XPUB)).toBe(44);
    });

    it('infers purpose 84 from zpub', () => {
      const zpub = format(TEST_XPUB, 84, 'mainnet');
      expect(inferPurpose(zpub)).toBe(84);
    });
  });
});
