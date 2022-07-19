import { HARDENED_OFFSET } from '../../constants';
import { buildEthSignRequest } from '../utils/builders';
import { getDeviceId } from '../utils/getters';
import { BTC_PURPOSE_P2PKH, ETH_COIN, setupTestClient } from '../utils/helpers';

describe('connect', () => {
  it('should test connect', async () => {
    const client = setupTestClient();
    const isPaired = await client.connect(getDeviceId())
    expect(isPaired).toMatchSnapshot();
  })

  it('should test fetchActiveWallet', async () => {
    const client = setupTestClient();
    await client.connect(getDeviceId())
    await client.fetchActiveWallet()
  })

  it('should test getAddresses', async () => {
    const client = setupTestClient();
    await client.connect(getDeviceId())

    const startPath = [
      BTC_PURPOSE_P2PKH,
      ETH_COIN,
      HARDENED_OFFSET,
      0,
      0,
    ];

    const addrs = await client.getAddresses({ startPath, n: 1 });
    expect(addrs).toMatchSnapshot()
  })

  it('should test sign', async () => {
    const client = setupTestClient();
    await client.connect(getDeviceId())

    const { req } = await buildEthSignRequest(client);
    const signData = await client.sign(req);
    expect(signData).toMatchSnapshot()
  })

  it('should test fetchActiveWallet', async () => {
    const client = setupTestClient();
    await client.connect(getDeviceId())

    const activeWallet = await client.fetchActiveWallet();
    expect(activeWallet).toMatchSnapshot()
  })

  it('should test getKvRecords', async () => {
    const client = setupTestClient();
    await client.connect(getDeviceId())

    const activeWallet = await client.getKvRecords({ start: 0 });
    expect(activeWallet).toMatchSnapshot()
  })
  it('should test addKvRecords', async () => {
    const client = setupTestClient();
    await client.connect(getDeviceId())

    const activeWallet = await client.addKvRecords({ records: { 'test2': 'test2' } });
    expect(activeWallet).toMatchSnapshot()
  })
  it('should test removeKvRecords', async () => {
    const client = setupTestClient();
    await client.connect(getDeviceId())
    await client.addKvRecords({ records: { 'test': `${Math.random()}` } });
    const { records } = await client.getKvRecords({ start: 0 });
    const activeWallet = await client.removeKvRecords({ ids: records.map(r => r.id) });
    expect(activeWallet).toMatchSnapshot()
  })
})