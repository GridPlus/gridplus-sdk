import { btc } from '../../index';
import { setupClient } from '../utils/setup';

describe('BTC Xpub E2E', () => {
  beforeAll(async () => {
    await setupClient();
  });

  it('fetches zpub with getXpub', async () => {
    const zpub = await btc.getXpub({ purpose: 84 });
    expect(zpub).toBeTruthy();
    expect(zpub.startsWith('zpub')).toBe(true);
  });

  it('fetches all xpubs with getAllXpubs', async () => {
    const xpubs = await btc.getAllXpubs();
    expect(xpubs.xpub.startsWith('xpub')).toBe(true);
    expect(xpubs.ypub.startsWith('ypub')).toBe(true);
    expect(xpubs.zpub.startsWith('zpub')).toBe(true);
  });

  it('fetches testnet xpub', async () => {
    const tpub = await btc.getXpub({ purpose: 44, coinType: 1 });
    expect(tpub.startsWith('tpub')).toBe(true);
  });
});
