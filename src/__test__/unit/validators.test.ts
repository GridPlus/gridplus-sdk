import {
  validateAddKvRequest,
  validateConnectRequest,
  validateGetAddressesRequest,
  validateGetKvRequest,
  validateRemoveKvRequest,
} from '../../functions';
import {
  isValid4ByteResponse,
  isValidBlockExplorerResponse,
} from '../../shared/validators';
import { normalizeToViemTransaction } from '../../ethereum';
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
        expect(() =>
          validateRemoveKvRequest(validateRemoveKvBundle),
        ).toThrowError();
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

  describe('transaction validation', () => {
    describe('EIP-7702 transactions', () => {
      test('rejects missing fee fields', () => {
        const tx = {
          to: '0x' + '1'.repeat(40),
          value: '1000000000000000000',
          chainId: 1,
          authorizationList: [
            { chainId: 1, address: '0x' + '2'.repeat(40), nonce: 0 },
          ],
          gasPrice: '15000000000',
        };

        expect(() => normalizeToViemTransaction(tx)).toThrow();
      });
    });

    describe('negative values', () => {
      test('rejects negative value', () => {
        const tx = {
          to: '0x' + '1'.repeat(40),
          value: -100,
          gasPrice: '10000000000',
        };

        expect(() => normalizeToViemTransaction(tx)).toThrow();
      });

      test('rejects negative nonce', () => {
        const tx = {
          to: '0x' + '1'.repeat(40),
          value: '100',
          gasPrice: '10000000000',
          nonce: -1,
        };

        expect(() => normalizeToViemTransaction(tx)).toThrow();
      });

      test('rejects negative gas price', () => {
        const tx = {
          to: '0x' + '1'.repeat(40),
          value: '100',
          gasPrice: -10,
        };

        expect(() => normalizeToViemTransaction(tx)).toThrow();
      });
    });

    describe('invalid data types', () => {
      test('rejects boolean data field', () => {
        const tx = {
          to: '0x1234567890123456789012345678901234567890',
          value: true,
          chainId: '0x1',
          gasPrice: NaN,
          nonce: null,
          data: false,
        };

        expect(() => normalizeToViemTransaction(tx as any)).toThrow();
      });
    });

    describe('authorization list validation', () => {
      test('rejects invalid authorization data', () => {
        const tx = {
          to: '0x1234567890123456789012345678901234567890',
          value: '1000000000000000000',
          chainId: 1,
          maxFeePerGas: '20000000000',
          maxPriorityFeePerGas: '2000000000',
          authorizationList: [
            {
              chainId: 'not-a-number',
              address: '0x123',
              nonce: undefined,
            },
          ],
        };

        expect(() => normalizeToViemTransaction(tx as any)).toThrow();
      });
    });

    describe('circular references', () => {
      test('rejects circular references', () => {
        const tx: any = {
          to: '0x1234567890123456789012345678901234567890',
          value: '1000000000000000000',
          chainId: 1,
          maxFeePerGas: '20000000000',
          maxPriorityFeePerGas: '2000000000',
        };

        tx.self = tx;
        tx.authorizationList = [tx];

        expect(() => normalizeToViemTransaction(tx)).toThrow();
      });
    });

    describe('gas field handling', () => {
      test('gasLimit takes precedence over gas', () => {
        const tx = {
          to: '0x1234567890123456789012345678901234567890',
          value: '1000000000000000000',
          chainId: 1,
          gasPrice: '15000000000',
          gas: '50000',
          gasLimit: '21000',
        };

        const result = normalizeToViemTransaction(tx);
        expect(result.gas).toBe(21000n);
      });

      test('accepts zero gas values', () => {
        const tx = {
          to: '0x1234567890123456789012345678901234567890',
          value: '1000000000000000000',
          chainId: 1,
          gasPrice: '0',
          gasLimit: '0',
        };

        const result = normalizeToViemTransaction(tx);
        expect(result.gas).toBe(0n);
        expect(result.type).toBe('legacy');
        expect((result as any).gasPrice).toBe(0n);
      });
    });

    describe('chainId validation', () => {
      test('rejects zero chainId', () => {
        const tx = {
          to: '0x1234567890123456789012345678901234567890',
          value: '1000000000000000000',
          chainId: 0,
          gasPrice: '15000000000',
        };

        expect(() => normalizeToViemTransaction(tx)).toThrow();
      });

      test('rejects non-integer chainId', () => {
        const tx = {
          to: '0x1234567890123456789012345678901234567890',
          value: '1000000000000000000',
          chainId: 1.5,
          gasPrice: '15000000000',
        };

        expect(() => normalizeToViemTransaction(tx)).toThrow();
      });
    });
  });
});
