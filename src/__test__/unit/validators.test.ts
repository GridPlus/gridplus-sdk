import {
  validateAddKvRequest,
  validateConnectRequest,
  validateFetchActiveWallet,
  validateGetAddressesRequest,
  validateGetKvRequest,
  validateRemoveKvRequest,
  validateSignRequest,
} from '../../functions';
import {
  buildGetAddressesObject,
  buildValidateConnectObject,
  buildValidateRequestObject,
} from '../utils/builders';

describe('validators', () => {
  describe('connect', () => {
    test('should successfully validate', () => {
      const connectBundle = buildValidateConnectObject({});
      const validConnectRequest = validateConnectRequest(connectBundle);
      expect(validConnectRequest.deviceId).toMatchSnapshot();
    });

    test('should throw errors on validation failure', () => {
      const connectBundle = buildValidateConnectObject({ baseUrl: '' });
      expect(() => validateConnectRequest(connectBundle)).toThrowError();
    });
  });

  describe('getAddresses', () => {
    test('should successfully validate', () => {
      const getAddressesBundle = buildGetAddressesObject({});
      expect(validateGetAddressesRequest(getAddressesBundle)).toMatchSnapshot();
    });

    test('should throw errors on validation failure', () => {
      const getAddressesBundle = buildGetAddressesObject({ url: '' });
      expect(() =>
        validateGetAddressesRequest(getAddressesBundle),
      ).toThrowError();
    });
  });

  describe('KvRecords', () => {
    describe('addKvRecords', () => {
      test('should successfully validate', () => {
        const validateAddKvBundle: any = buildValidateRequestObject({
          records: { key: 'value' },
        });
        expect(validateAddKvRequest(validateAddKvBundle)).toMatchSnapshot();
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
        expect(validateGetKvRequest(validateGetKvBundle)).toMatchSnapshot();
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
        expect(
          validateRemoveKvRequest(validateRemoveKvBundle),
        ).toMatchSnapshot();
      });

      test('should throw errors on validation failure', () => {
        const validateRemoveKvBundle: any = buildValidateRequestObject({});
        expect(() =>
          validateRemoveKvRequest(validateRemoveKvBundle),
        ).toThrowError();
      });
    });
  });

  describe('fetchActiveWallet', () => {
    test('should successfully validate', () => {
      const validateFetchActiveWalletBundle: any = buildValidateRequestObject(
        {},
      );
      expect(
        validateFetchActiveWallet(validateFetchActiveWalletBundle),
      ).toMatchSnapshot();
    });

    test('should throw errors on validation failure', () => {
      const validateFetchActiveWalletBundle: any = { url: '' };
      expect(() =>
        validateFetchActiveWallet(validateFetchActiveWalletBundle),
      ).toThrowError();
    });
  });

  describe('sign', () => {
    test('should successfully validate', () => {
      const validateSignRequestBundle: any = buildValidateRequestObject({
        wallet: 'wallet',
      });
      expect(validateSignRequest(validateSignRequestBundle)).toMatchSnapshot();
    });

    test('should throw errors on validation failure', () => {
      const validateSignRequestBundle: any = buildValidateRequestObject({});
      expect(() =>
        validateSignRequest(validateSignRequestBundle),
      ).toThrowError();
    });
  });
});
