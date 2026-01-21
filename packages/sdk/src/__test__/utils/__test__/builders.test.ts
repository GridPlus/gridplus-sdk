import {
  buildEvmReq,
  buildRandomVectors,
  getFwVersionsList,
} from '../builders';

describe('building', () => {
  test('should test client', () => {
    expect(getFwVersionsList()).toMatchSnapshot();
  });

  test('RANDOM_VEC', () => {
    const RANDOM_VEC = buildRandomVectors(10);
    expect(RANDOM_VEC).toMatchInlineSnapshot(`
      [
        "9f2c1f8",
        "334e3bf5",
        "3748e38b",
        "3b2f82b",
        "1eecc588",
        "36b9be74",
        "332c1296",
        "2afaf74c",
        "1121991",
        "2851e10c",
      ]
    `);
  });

  test('buildEvmReq', () => {
    const testObj = buildEvmReq({
      common: 'test',
      data: { payload: 'test' },
      txData: { data: 'test', type: undefined },
    });
    expect(testObj).toMatchInlineSnapshot(`
      {
        "common": "test",
        "data": {
          "curveType": 0,
          "encodingType": 4,
          "hashType": 1,
          "payload": "test",
          "signerPath": [
            2147483692,
            2147483708,
            2147483648,
            0,
            0,
          ],
        },
        "txData": {
          "data": "test",
          "gasLimit": 50000,
          "maxFeePerGas": 1200000000,
          "maxPriorityFeePerGas": 1200000000,
          "nonce": 0,
          "to": "0xe242e54155b1abc71fc118065270cecaaf8b7768",
          "type": undefined,
          "value": 100,
        },
      }
    `);
  });
});
