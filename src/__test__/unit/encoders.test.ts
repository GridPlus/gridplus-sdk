import { EXTERNAL } from '../../constants';
import {
  encodeAddKvRecordsRequest,
  encodeConnectRequest,
  encodeGetAddressesRequest,
  encodeGetKvRecordsRequest,
  encodePairRequest,
  encodeRemoveKvRecordsRequest,
  encodeSignRequest,
} from '../../functions';
import { getP256KeyPair } from '../../util';
import {
  buildFirmwareConstants,
  buildGetAddressesObject,
  buildTransactionObject,
  getFwVersionsList,
} from '../utils/builders';

describe('encoders', () => {
  let mockRandom: any;

  beforeAll(() => {
    mockRandom = vi.spyOn(global.Math, 'random').mockReturnValue(0.1);
  });

  afterAll(() => {
    mockRandom.mockRestore();
  });

  describe('pair', () => {
    test('pair encoder', () => {
      const privKey = Buffer.alloc(32, '1');
      expect(privKey.toString()).toMatchSnapshot();
      const key = getP256KeyPair(privKey);
      const payload = encodePairRequest(key, 'testtest', 'testtest');
      const payloadAsString = payload.toString('hex');
      expect(payloadAsString).toMatchSnapshot();
    });
  });

  describe('getAddresses', () => {
    test('encodeGetAddressesRequest with default flag', () => {
      const mockObject = buildGetAddressesObject({});
      const payload = encodeGetAddressesRequest(mockObject);
      const payloadAsString = payload.toString('hex');
      expect(payloadAsString).toMatchSnapshot();
    });

    test('encodeGetAddressesRequest with ED25519_PUB', () => {
      const mockObject = buildGetAddressesObject({
        flag: EXTERNAL.GET_ADDR_FLAGS.ED25519_PUB,
      });
      const payload = encodeGetAddressesRequest(mockObject);
      const payloadAsString = payload.toString('hex');
      expect(payloadAsString).toMatchSnapshot();
    });

    test('encodeGetAddressesRequest with SECP256K1_PUB', () => {
      const mockObject = buildGetAddressesObject({
        flag: EXTERNAL.GET_ADDR_FLAGS.SECP256K1_PUB,
      });
      const payload = encodeGetAddressesRequest(mockObject);
      const payloadAsString = payload.toString('hex');
      expect(payloadAsString).toMatchSnapshot();
    });

    /*
    THIS SHOULD BE A VALIDATOR TEST
    test('encodeGetAddressesRequest should throw with invalid startPath on old firmware', () => {
      const startPath = [0x80000000 + 44, 0x80000000 + 60, 0, 0, 0, 0, 0];
      const fwVersion = Buffer.from([0, 0, 0]);
      const testEncodingFunction = () =>
        encodeGetAddressesRequest(
          buildGetAddressesObject({ startPath, fwVersion }),
        );
      expect(testEncodingFunction).toThrowError();
    });
    */
  });
/*
  describe('sign', () => {
    test.each(getFwVersionsList())(
      'should test sign encoder with firmware v%d.%d.%d',
      (major, minor, patch) => {
        const { payload } = encodeSignRequest(
          buildTransactionObject({
            fwVersion: Buffer.from([patch, minor, major]),
          }),
        );
        const payloadAsString = payload.toString('hex');
        expect(payloadAsString).toMatchSnapshot();
      },
    );
  });
  describe('KvRecords', () => {
    test('getKvRecords', () => {
      const mockObject = { type: 0, n: 1, start: 0 };
      const payload = encodeGetKvRecordsRequest(mockObject);
      const payloadAsString = payload.toString('hex');
      expect(payloadAsString).toMatchSnapshot();
    });

    test('addKvRecords', () => {
      const mockObject = {
        type: 0,
        records: { key: 'value' },
        fwConstants: buildFirmwareConstants(),
        caseSensitive: false,
      };
      const payload = encodeAddKvRecordsRequest(mockObject);
      const payloadAsString = payload.toString('hex');
      expect(payloadAsString).toMatchSnapshot();
    });

    test('removeKvRecords', () => {
      const mockObject = {
        type: 0,
        ids: [0],
        fwConstants: buildFirmwareConstants(),
        caseSensitive: false,
      };
      const payload = encodeRemoveKvRecordsRequest(mockObject);
      const payloadAsString = payload.toString('hex');
      expect(payloadAsString).toMatchSnapshot();
    });
  });
*/
});
