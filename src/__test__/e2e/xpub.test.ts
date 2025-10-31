/* eslint-disable quotes */
import { fetchBtcXpub, fetchBtcYpub, fetchBtcZpub, pair } from '../../api';
import { setupClient } from '../utils/setup';

describe('XPUB', () => {
  beforeAll(async () => {
    await setupClient();
  });

  test('fetchBtcXpub returns xpub', async () => {
    const xpub = await fetchBtcXpub();
    expect(xpub).toBeTruthy();
    expect(xpub.startsWith('xpub')).toBe(true);
    expect(xpub.length).toBeGreaterThan(100);
  });

  test('fetchBtcYpub returns ypub', async () => {
    const ypub = await fetchBtcYpub();
    expect(ypub).toBeTruthy();
    expect(ypub.startsWith('ypub')).toBe(true);
    expect(ypub.length).toBeGreaterThan(100);
  });

  test('fetchBtcZpub returns zpub', async () => {
    const zpub = await fetchBtcZpub();
    expect(zpub).toBeTruthy();
    expect(zpub.startsWith('zpub')).toBe(true);
    expect(zpub.length).toBeGreaterThan(100);
  });
});
