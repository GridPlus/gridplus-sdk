import { vi } from 'vitest';
import { EXTERNAL } from '../../constants';
import {
  encodeAddKvRecordsRequest,
  encodeGetAddressesRequest,
  encodeGetKvRecordsRequest,
  encodePairRequest,
  encodeRemoveKvRecordsRequest,
  encodeSignRequest,
} from '../../functions';
import { buildTransaction } from '../../shared/functions';
import { getP256KeyPair } from '../../util';
import {
  buildFirmwareConstants,
  buildGetAddressesObject,
  buildSignObject,
  buildWallet,
  getFwVersionsList,
} from '../utils/builders';
import { encodeViemTransaction, encodeViemTypedData, encodeViemPersonalMessage } from '../../calldata/evm';
import { TRANSACTION_TYPE } from '../../types/sign';

describe('encoders', () => {
  let mockRandom: any;

  beforeAll(() => {
    mockRandom = vi.spyOn(globalThis.Math, 'random').mockReturnValue(0.1);
  });

  afterAll(() => {
    mockRandom.mockRestore();
  });

  describe('pair', () => {
    test('pair encoder', () => {
      const privKey = Buffer.alloc(32, '1');
      expect(privKey.toString()).toMatchSnapshot();
      const key = getP256KeyPair(privKey);
      const payload = encodePairRequest({
        key,
        pairingSecret: 'testtest',
        appName: 'testtest',
      });
      const payloadAsString = payload.toString('hex');
      expect(payloadAsString).toMatchSnapshot();
    });
  });

  describe('getAddresses', () => {
    test('encodeGetAddressesRequest with default flag', () => {
      const payload = encodeGetAddressesRequest(buildGetAddressesObject());
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
        const fwVersion = Buffer.from([patch, minor, major]);
        const txObj = buildSignObject(fwVersion);
        const tx = buildTransaction(txObj);
        const req = {
          ...txObj,
          ...tx,
          wallet: buildWallet(),
        };
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
      const fwConstants = buildFirmwareConstants();
      const mockObject = {
        type: 0,
        records: { key: 'value' },
        caseSensitive: false,
        fwConstants,
      };
      const payload = encodeAddKvRecordsRequest(mockObject);
      const payloadAsString = payload.toString('hex');
      expect(payloadAsString).toMatchSnapshot();
    });

    test('removeKvRecords', () => {
      const fwConstants = buildFirmwareConstants();
      const mockObject = {
        type: 0,
        ids: ['0'],
        caseSensitive: false,
        fwConstants,
      };
      const payload = encodeRemoveKvRecordsRequest(mockObject);
      const payloadAsString = payload.toString('hex');
      expect(payloadAsString).toMatchSnapshot();
    });
  });

  describe('viem', () => {
    test('should encode legacy transaction', () => {
      const tx = {
        to: '0x1234567890123456789012345678901234567890',
        value: '1000000000000000000',
        data: '0x',
        chainId: 1,
        nonce: 0,
        gasLimit: '21000',
        type: TRANSACTION_TYPE.LEGACY,
      };

      const payload = encodeViemTransaction(tx);
      expect(payload).toMatchSnapshot();
    });

    test('should encode EIP-1559 transaction', () => {
      const tx = {
        to: '0x1234567890123456789012345678901234567890',
        value: '1000000000000000000',
        data: '0x',
        chainId: 1,
        nonce: 0,
        gasLimit: '21000',
        maxFeePerGas: '2000000000',
        maxPriorityFeePerGas: '1000000000',
        type: TRANSACTION_TYPE.EIP1559,
      };

      const payload = encodeViemTransaction(tx);
      expect(payload).toMatchSnapshot();
    });

    test('should encode EIP-712 typed data', () => {
      const typedData = {
        types: {
          Person: [
            { name: 'name', type: 'string' },
            { name: 'wallet', type: 'address' },
          ],
        },
        domain: {
          name: 'Test Domain',
          version: '1',
          chainId: 1,
        },
        primaryType: 'Person',
        message: {
          name: 'Bob',
          wallet: '0x1234567890123456789012345678901234567890',
        },
      };

      const payload = encodeViemTypedData(typedData);
      expect(payload).toMatchSnapshot();
    });

    test('should encode personal message', () => {
      const message = 'Hello, World!';
      const payload = encodeViemPersonalMessage(message);
      expect(payload).toMatchSnapshot();
    });
  });
});
