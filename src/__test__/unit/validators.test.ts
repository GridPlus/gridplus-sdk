import {
  validateAddKvRequest,
  validateConnectRequest,
  validateGetAddressesRequest,
  validateGetKvRequest,
  validateRemoveKvRequest,
} from '../../functions';
import {
  isValidBlockExplorerResponse,
  isValid4ByteResponse,
} from '../../shared/validators';
import {
  buildGetAddressesObject,
  buildValidateConnectObject,
  buildValidateRequestObject,
} from '../utils/builders';

describe('validators', () => {
  describe('connect', () => {
    test('should successfully validate', () => {
      validateConnectRequest(buildValidateConnectObject());
    });

    // NOTE: There aren't many possible error conditions because
    // the Client constructor has lots of fallback values. However,
    // we should validate that you can't set a null ephemeral pub.
    test('should throw errors on validation failure', () => {
      const req = buildValidateConnectObject({ name: '' });
      expect(() => {
        req.client.ephemeralPub = null;
      }).toThrowError();
    });
  });

  describe('getAddresses', () => {
    test('should successfully validate', () => {
      const getAddressesBundle = buildGetAddressesObject({});
      validateGetAddressesRequest(getAddressesBundle);
    });

    test('encodeGetAddressesRequest should throw with invalid startPath', () => {
      const startPath = [0x80000000 + 44, 0x80000000 + 60, 0, 0, 0, 0, 0];
      const fwVersion = Buffer.from([0, 0, 0]);
      const testEncodingFunction = () =>
        validateGetAddressesRequest(
          buildGetAddressesObject({ startPath, fwVersion }),
        );
      expect(testEncodingFunction).toThrowError();
    });
  });

  describe('KvRecords', () => {
    describe('addKvRecords', () => {
      test('should successfully validate', () => {
        const validateAddKvBundle: any = buildValidateRequestObject({
          records: { key: 'value' },
        });
        validateAddKvRequest(validateAddKvBundle);
      });

      test('should throw errors on validation failure', () => {
        const validateAddKvBundle: any = buildValidateRequestObject({});
        expect(() => validateAddKvRequest(validateAddKvBundle)).toThrowError();
      });
    });

    describe('getKvRecords', () => {
      test('should successfully validate', () => {
        const validateGetKvBundle: any = buildValidateRequestObject({
          n: 1,
          type: 1,
          start: 0,
        });
        validateGetKvRequest(validateGetKvBundle);
      });

      test('should throw errors on validation failure', () => {
        const validateGetKvBundle: any = buildValidateRequestObject({ n: 0 });
        expect(() => validateGetKvRequest(validateGetKvBundle)).toThrowError();
      });
    });

    describe('removeKvRecords', () => {
      test('should successfully validate', () => {
        const validateRemoveKvBundle: any = buildValidateRequestObject({
          ids: [1],
          type: 1,
        });
        validateRemoveKvRequest(validateRemoveKvBundle);
      });

      test('should throw errors on validation failure', () => {
        const validateRemoveKvBundle: any = buildValidateRequestObject({});
        expect (() => validateRemoveKvRequest(validateRemoveKvBundle)).toThrowError();
      });
    });
  });

  describe('abi data responses', () => {
    describe('block explorers', () => {
      test('should successfully validate etherscan data', () => {
        const response: any = {
          result:
            '[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"stateMutability":"payable","type":"fallback"},{"inputs":[],"name":"implementation","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"stateMutability":"payable","type":"receive"}]',
        };
        expect(isValidBlockExplorerResponse(response)).toBe(true);
      });

      test('should validate as false bad data', () => {
        const response: any = {
          result:
            'Max rate limit reached, please use API Key for higher rate limit',
        };
        expect(isValidBlockExplorerResponse(response)).toBe(false);
      });
    });

    describe('4byte', () => {
      test('should successfully validate etherscan data', () => {
        const response: any = {
          results: [
            {
              id: 447919,
              created_at: '2021-12-25T13:54:33.120581Z',
              text_signature: 'multicall(uint256,bytes[])',
              hex_signature: '0x5ae401dc',
              bytes_signature: 'test',
            },
          ],
        };
        expect(isValid4ByteResponse(response)).toBe(true);
      });

      test('should validate as false bad data', () => {
        const response: any = {
          results: [],
        };
        expect(isValid4ByteResponse(response)).toBe(false);
      });
    });
  });
});
