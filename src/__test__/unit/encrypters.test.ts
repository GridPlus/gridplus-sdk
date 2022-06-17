import {
  encryptAddKvRecordsRequest,
  encryptFetchActiveWalletRequest,
  encryptGetAddressesRequest,
  encryptGetKvRecordsRequest,
  encryptPairRequest,
  encryptRemoveKvRecordsRequest,
  encryptSignRequest,
} from '../../functions';
import { buildSharedSecret } from '../utils/builders';

describe('encrypters', () => {
  let mockRandom: any;

  beforeAll(() => {
    mockRandom = vi.spyOn(global.Math, 'random').mockReturnValue(0.1);
  });

  afterAll(() => {
    mockRandom.mockRestore();
  });

  test('pair', () => {
    const payload = Buffer.from('test');
    const sharedSecret = buildSharedSecret();
    const encryptedPayload = encryptPairRequest({ payload, sharedSecret });
    expect(encryptedPayload.toString('hex')).toMatchSnapshot();
  });

  test('fetchActiveWallet', () => {
    const sharedSecret = buildSharedSecret();
    const encryptedPayload = encryptFetchActiveWalletRequest({ sharedSecret });
    expect(encryptedPayload.toString('hex')).toMatchSnapshot();
  });

  test('getAddresses', () => {
    const payload = buildSharedSecret();
    const sharedSecret = buildSharedSecret();
    const encryptedPayload = encryptGetAddressesRequest({
      payload,
      sharedSecret,
    });
    expect(encryptedPayload.toString('hex')).toMatchSnapshot();
  });

  test('sign', () => {
    const payload = Buffer.from([1, 2, 3]);
    const sharedSecret = buildSharedSecret();
    const encryptedPayload = encryptSignRequest({ payload, sharedSecret });
    expect(encryptedPayload.toString('hex')).toMatchSnapshot();
  });

  test('getKvRecords', () => {
    const payload = Buffer.from('test');
    const sharedSecret = buildSharedSecret();
    const encryptedPayload = encryptGetKvRecordsRequest({
      payload,
      sharedSecret,
    });
    expect(encryptedPayload.toString('hex')).toMatchSnapshot();
  });

  test('addKvRecords', () => {
    const payload = Buffer.from('test');
    const sharedSecret = buildSharedSecret();
    const encryptedPayload = encryptAddKvRecordsRequest({
      payload,
      sharedSecret,
    });
    expect(encryptedPayload.toString('hex')).toMatchSnapshot();
  });

  test('removeKvRecords', () => {
    const payload = Buffer.from('test');
    const sharedSecret = buildSharedSecret();
    const encryptedPayload = encryptRemoveKvRecordsRequest({
      payload,
      sharedSecret,
    });
    expect(encryptedPayload.toString('hex')).toMatchSnapshot();
  });
});
