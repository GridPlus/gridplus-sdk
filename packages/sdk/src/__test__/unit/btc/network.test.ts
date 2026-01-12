import bs58check from 'bs58check';
import { SLIP132_VERSION_BYTES } from '../../../btc/constants';
import {
  inferFromXpub,
  getCoinType,
  getNetworkFromCoinType,
  isTestnet,
} from '../../../btc/network';

const TEST_XPUB =
  'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8';
const toVersion = (xpub: string, version: number) => {
  const decoded = Buffer.from(bs58check.decode(xpub));
  decoded.writeUInt32BE(version, 0);
  return bs58check.encode(decoded);
};

const TEST_TPUB = toVersion(TEST_XPUB, SLIP132_VERSION_BYTES.tpub.public);

describe('btc/network', () => {
  it('infers mainnet from xpub', () => {
    expect(inferFromXpub(TEST_XPUB)).toBe('mainnet');
  });

  it('infers testnet from tpub', () => {
    expect(inferFromXpub(TEST_TPUB)).toBe('testnet');
  });

  it('returns coin type for mainnet', () => {
    expect(getCoinType('mainnet')).toBe(0);
  });

  it('returns coin type for testnet/regtest', () => {
    expect(getCoinType('testnet')).toBe(1);
    expect(getCoinType('regtest')).toBe(1);
  });

  it('returns network from coin type', () => {
    expect(getNetworkFromCoinType(0)).toBe('mainnet');
    expect(getNetworkFromCoinType(1)).toBe('testnet');
  });

  it('identifies testnet-like networks', () => {
    expect(isTestnet('mainnet')).toBe(false);
    expect(isTestnet('testnet')).toBe(true);
    expect(isTestnet('regtest')).toBe(true);
  });
});
