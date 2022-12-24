import { EXTERNAL } from '../../constants';
import {
  encodeAddKvRecordsRequest,
  encodeGetAddressesRequest,
  encodeGetKvRecordsRequest,
  encodePairRequest,
  encodeRemoveKvRecordsRequest,
  encodeSignRequest,
} from '../../functions';
import { buildTransaction } from '../../shared/functions'
import {
  buildGetAddressesObject,
  buildMockConnectedClient,
  buildSignObject,
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
      const client = buildMockConnectedClient({ 
        privKey,
        name: 'testtest'
      });
      const payload = encodePairRequest({
        client, 
        pairingSecret: 'testtest'
      });
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
  });

  describe('sign', () => {
    test.each(getFwVersionsList())(
      'should test sign encoder with firmware v%d.%d.%d',
      (major, minor, patch) => {
        const txObj = buildSignObject({
          fwVersion: Buffer.from([patch, minor, major]),
        });
        const fwConstants = txObj.client.getFwConstants();
        const tx = buildTransaction({
          ...txObj,
          fwConstants,
        });
        const req = {
          ...txObj,
          request: tx.request,
        }
        const { payload } = encodeSignRequest(req);
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
        client: buildMockConnectedClient(),
        type: 0,
        records: { key: 'value' },
        caseSensitive: false,
      };
      const payload = encodeAddKvRecordsRequest(mockObject);
      const payloadAsString = payload.toString('hex');
      expect(payloadAsString).toMatchSnapshot();
    });

    test('removeKvRecords', () => {
      const mockObject = {
        client: buildMockConnectedClient(),
        type: 0,
        ids: [0],
        caseSensitive: false,
      };
      const payload = encodeRemoveKvRecordsRequest(mockObject);
      const payloadAsString = payload.toString('hex');
      expect(payloadAsString).toMatchSnapshot();
    });
  });
});
