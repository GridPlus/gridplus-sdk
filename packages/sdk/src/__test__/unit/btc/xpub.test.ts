vi.mock('../../../api/utilities', () => ({
  queue: vi.fn(),
}));

import { BTC_COIN_TYPES, BTC_PURPOSES } from '../../../btc/constants';
import { getAllXpubs, getXpub, getXpubs } from '../../../btc/xpub';
import { queue } from '../../../api/utilities';

const TEST_XPUB =
  'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8';

const mockQueue = vi.mocked(queue);

describe('btc/xpub', () => {
  beforeEach(() => {
    mockQueue.mockResolvedValue([TEST_XPUB]);
  });

  it('returns legacy xpub for purpose 44', async () => {
    const result = await getXpub({ purpose: 44 });
    expect(result.startsWith('xpub')).toBe(true);
  });

  it('returns ypub for purpose 49', async () => {
    const result = await getXpub({ purpose: 49 });
    expect(result.startsWith('ypub')).toBe(true);
  });

  it('returns zpub for purpose 84', async () => {
    const result = await getXpub({ purpose: 84 });
    expect(result.startsWith('zpub')).toBe(true);
  });

  it('returns tpub for testnet coin type', async () => {
    const result = await getXpub({
      purpose: BTC_PURPOSES.LEGACY,
      coinType: BTC_COIN_TYPES.TESTNET,
    });
    expect(result.startsWith('tpub')).toBe(true);
  });

  it('throws when no xpub is returned', async () => {
    mockQueue.mockResolvedValueOnce([]);
    await expect(getXpub({ purpose: 44 })).rejects.toThrow(
      'Failed to fetch xpub from device',
    );
  });

  it('fetches multiple xpubs by purpose', async () => {
    const results = await getXpubs({ purposes: [44, 49, 84] });
    expect(results.get(44)?.startsWith('xpub')).toBe(true);
    expect(results.get(49)?.startsWith('ypub')).toBe(true);
    expect(results.get(84)?.startsWith('zpub')).toBe(true);
  });

  it('fetches all standard xpubs', async () => {
    const results = await getAllXpubs();
    expect(results.xpub.startsWith('xpub')).toBe(true);
    expect(results.ypub.startsWith('ypub')).toBe(true);
    expect(results.zpub.startsWith('zpub')).toBe(true);
  });
});
