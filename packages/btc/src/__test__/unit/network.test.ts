import bs58check from 'bs58check';
import { SLIP132_VERSION_BYTES } from '../../constants';
import {
  inferFromXpub,
  getCoinType,
  getNetworkFromCoinType,
  isTestnet,
} from '../../network';

const TEST_XPUB =
  'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8';
const toVersion = (xpub: string, version: number) => {
  const decoded = bs58check.decode(xpub);
  const converted = new Uint8Array(decoded.length);
  const view = new DataView(converted.buffer);
  view.setUint32(0, version, false);
  converted.set(decoded.subarray(4), 4);
  return bs58check.encode(converted);
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
