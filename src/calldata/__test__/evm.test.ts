import { describe, expect, test } from 'vitest';
import {
  parseFunction,
  parseSolidityJSONABI,
  parseCanonicalName,
  decodeCalldata,
  getNestedCalldata,
  replaceNestedDefs,
  coerceSig,
  serializeBigInt,
  encodeViemTransaction,
  encodeViemTypedData,
  encodeViemPersonalMessage,
} from '../../calldata/evm';
import { TRANSACTION_TYPE } from '../../types/sign';

describe('EVM Functions', () => {
  describe('parseFunction', () => {
    test('parses simple function', () => {
      const result = parseFunction('transfer', ['address', 'uint256']);
      expect(result).toMatchSnapshot();
    });

    test('parses function with arrays', () => {
      const result = parseFunction('multicall', ['bytes[]']);
      expect(result).toMatchSnapshot();
    });

    test('parses function with complex types', () => {
      const result = parseFunction('complexFunction', [
        '(address token, uint256 amount)',
        'uint256[]',
        'bytes',
      ]);
      expect(result).toMatchSnapshot();
    });
  });

  describe('parseSolidityJSONABI', () => {
    const testABI = [
      {
        type: 'function',
        name: 'transfer',
        inputs: [
          { type: 'address', name: 'to' },
          { type: 'uint256', name: 'amount' },
        ],
        outputs: [{ type: 'bool' }],
        stateMutability: 'nonpayable',
      },
    ];

    test('parses valid ABI', () => {
      const result = parseSolidityJSONABI('0xa9059cbb', testABI);
      expect(result).toMatchSnapshot();
    });

    test('handles JSON string ABI', () => {
      const result = parseSolidityJSONABI('0xa9059cbb', testABI as any[]);
      expect(result).toMatchSnapshot();
    });

    test('throws on invalid selector', () => {
      expect(() => parseSolidityJSONABI('invalid', testABI)).toThrow();
    });

    test('throws on non-matching selector', () => {
      expect(() => parseSolidityJSONABI('0x12345678', testABI)).toThrow();
    });
  });

  describe('parseCanonicalName', () => {
    test('parses simple function', () => {
      const result = parseCanonicalName(
        '0xa9059cbb',
        'transfer(address,uint256)',
      );
      expect(result).toMatchSnapshot();
    });

    test('parses function with arrays', () => {
      const result = parseCanonicalName('0xac9650d8', 'multicall(bytes[])');
      expect(result).toMatchSnapshot();
    });

    test('throws on non-matching selector', () => {
      expect(() =>
        parseCanonicalName('0x12345678', 'transfer(address,uint256)'),
      ).toThrow();
    });
  });

  describe('decodeCalldata', () => {
    test('decodes transfer calldata', () => {
      const calldata = Buffer.from(
        'a9059cbb000000000000000000000000b97ef9ef8734c71904d8002f8b6bc66dd9c48a6e0000000000000000000000000000000000000000000000000000000000000064',
        'hex',
      );
      const result = decodeCalldata(
        ['transfer', 'address', 'uint256'],
        calldata,
      );
      expect(result).toMatchSnapshot();
    });

    test('decodes multicall calldata', () => {
      const calldata = Buffer.from(
        'ac9650d800000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000024a9059cbb000000000000000000000000b97ef9ef8734c71904d8002f8b6bc66dd9c48a6e00000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000024a9059cbb000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000000c8',
        'hex',
      );
      const result = decodeCalldata(['multicall', 'bytes[]'], calldata);
      expect(result).toMatchSnapshot();
    });

    test('handles decode errors gracefully', () => {
      const invalidCalldata = Buffer.from('deadbeef', 'hex');
      expect(
        decodeCalldata(['transfer', 'address', 'uint256'], invalidCalldata),
      ).toEqual([null, null]);
    });
  });

  describe('getNestedCalldata', () => {
    test('extracts nested calls from multicall', () => {
      const calldata = Buffer.from(
        'ac9650d800000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000024a9059cbb000000000000000000000000b97ef9ef8734c71904d8002f8b6bc66dd9c48a6e00000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000024a9059cbb000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000000c8',
        'hex',
      );
      const result = getNestedCalldata(['multicall', 'bytes[]'], calldata);
      expect(result).toMatchSnapshot();
    });

    test('returns null for non-nested calls', () => {
      const calldata = Buffer.from(
        'a9059cbb000000000000000000000000b97ef9ef8734c71904d8002f8b6bc66dd9c48a6e0000000000000000000000000000000000000000000000000000000000000064',
        'hex',
      );
      const result = getNestedCalldata(
        ['transfer', 'address', 'uint256'],
        calldata,
      );
      expect(result).toEqual([null, null]);
    });
  });

  describe('replaceNestedDefs', () => {
    test('replaces nested definitions', () => {
      const def = ['multicall', ['bytes[]']];
      const nestedDefs = [[['transfer', 'address', 'uint256']]];
      const result = replaceNestedDefs(def, nestedDefs);
      expect(result).toMatchSnapshot();
    });

    test('handles null nested defs', () => {
      const def = ['transfer', 'address', 'uint256'];
      const nestedDefs = [null, null];
      const result = replaceNestedDefs(def, nestedDefs);
      expect(result).toEqual(def);
    });
  });

  describe('coerceSig', () => {
    test('adds 0x prefix', () => {
      expect(coerceSig('a9059cbb')).toBe('0xa9059cbb');
    });

    test('passes through valid sig', () => {
      expect(coerceSig('0xa9059cbb')).toBe('0xa9059cbb');
    });

    test('throws on invalid sig', () => {
      expect(() => coerceSig('invalid')).toThrow();
      expect(() => coerceSig('0x')).toThrow();
      expect(() => coerceSig('0x123')).toThrow();
    });
  });

  describe('Transaction Encoding', () => {
    test('encodes legacy transaction', () => {
      const tx = {
        to: '0x1234567890123456789012345678901234567890',
        value: '1000000000000000000',
        data: '0x',
        chainId: 1,
        nonce: 0,
        gasLimit: '21000',
        type: TRANSACTION_TYPE.LEGACY,
      };
      const result = encodeViemTransaction(tx);
      expect(result).toMatchSnapshot();
    });

    test('encodes EIP1559 transaction', () => {
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
      const result = encodeViemTransaction(tx);
      expect(result).toMatchSnapshot();
    });
  });

  describe('TypedData Encoding', () => {
    test('encodes EIP712 typed data', () => {
      const typedData = {
        types: {
          Person: [
            { name: 'name', type: 'string' },
            { name: 'wallet', type: 'address' },
          ],
        },
        domain: {
          name: 'Test',
          version: '1',
          chainId: 1,
        },
        primaryType: 'Person',
        message: {
          name: 'Bob',
          wallet: '0x1234567890123456789012345678901234567890',
        },
      };
      const result = encodeViemTypedData(typedData);
      expect(result).toMatchSnapshot();
    });
  });

  describe('Personal Message Encoding', () => {
    test('encodes string message', () => {
      const result = encodeViemPersonalMessage('Hello, World!');
      expect(result).toMatchSnapshot();
    });

    test('encodes buffer message', () => {
      const result = encodeViemPersonalMessage(Buffer.from('Hello, World!'));
      expect(result).toMatchSnapshot();
    });
  });
});

describe('serializeBigInt', () => {
  test('serializes BigInt values', () => {
    const input = {
      simple: BigInt(123),
      array: [BigInt(456), BigInt(789)],
      nested: {
        value: BigInt(999),
      },
    };
    const result = serializeBigInt(input);
    expect(result).toEqual({
      simple: '123',
      array: ['456', '789'],
      nested: {
        value: '999',
      },
    });
  });

  test('handles non-BigInt values', () => {
    const input = {
      string: 'hello',
      number: 123,
      boolean: true,
      null: null,
    };
    const result = serializeBigInt(input);
    expect(result).toEqual(input);
  });
});
