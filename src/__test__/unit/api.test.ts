/* eslint-disable quotes */

import { parseDerivationPath } from '../../api/utilities';

describe('parseDerivationPath', () => {
  it('parses a simple derivation path correctly', () => {
    const result = parseDerivationPath('44/0/0/0');
    expect(result).toEqual([44, 0, 0, 0]);
  });

  it('parses a derivation path with hardened indices correctly', () => {
    const result = parseDerivationPath("44'/0'/0'/0");
    expect(result).toEqual([0x8000002c, 0x80000000, 0x80000000, 0]);
  });

  it('handles mixed hardened and non-hardened indices', () => {
    const result = parseDerivationPath("44'/60/0'/0/0");
    expect(result).toEqual([0x8000002c, 60, 0x80000000, 0, 0]);
  });

  it('interprets lowercase x as 0', () => {
    const result = parseDerivationPath('44/x/0/0');
    expect(result).toEqual([44, 0, 0, 0]);
  });

  it('interprets uppercase X as 0', () => {
    const result = parseDerivationPath('44/X/0/0');
    expect(result).toEqual([44, 0, 0, 0]);
  });

  it("interprets X' as hardened zero", () => {
    const result = parseDerivationPath("44'/X'/0/0");
    expect(result).toEqual([0x8000002c, 0x80000000, 0, 0]);
  });

  it("interprets x' as hardened zero", () => {
    const result = parseDerivationPath("44'/x'/0/0");
    expect(result).toEqual([0x8000002c, 0x80000000, 0, 0]);
  });

  it('handles a complex path with all features', () => {
    const result = parseDerivationPath("44'/501'/X'/0'");
    expect(result).toEqual([0x8000002c, 0x800001f5, 0x80000000, 0x80000000]);
  });

  it('returns an empty array for an empty path', () => {
    const result = parseDerivationPath('');
    expect(result).toEqual([]);
  });

  it('handles leading slash correctly', () => {
    const result = parseDerivationPath('/44/0/0/0');
    expect(result).toEqual([44, 0, 0, 0]);
  });

  it('throws error for invalid input', () => {
    expect(() => parseDerivationPath('invalid/path')).toThrow(
      'Invalid part in derivation path: invalid',
    );
  });
});
