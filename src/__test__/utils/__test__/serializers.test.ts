import { deserializeObjectWithBuffers, serializeObjectWithBuffers } from '../serializers';

describe('serializers', () => {

  test('serialize obj', () => {
    const obj = {
      a: 1,
      b: Buffer.from('test'),
      c: {
        d: 2,
        e: Buffer.from('test'),
      }
    };
    const serialized = serializeObjectWithBuffers(obj);
    expect(serialized).toMatchInlineSnapshot(`
      {
        "a": 1,
        "b": {
          "isBuffer": true,
          "value": "74657374",
        },
        "c": {
          "d": 2,
          "e": {
            "isBuffer": true,
            "value": "74657374",
          },
        },
      }
    `)
  })

  test('deserialize obj', () => {
    const obj = {
      'a': 1,
      'b': {
        'isBuffer': true,
        'value': '74657374',
      },
      'c': {
        'd': 2,
        'e': {
          'isBuffer': true,
          'value': '74657374',
        },
      },
    }

    const serialized = deserializeObjectWithBuffers(obj);
    expect(serialized).toMatchInlineSnapshot(`
      {
        "a": 1,
        "b": {
          "data": [
            116,
            101,
            115,
            116,
          ],
          "type": "Buffer",
        },
        "c": {
          "d": 2,
          "e": {
            "data": [
              116,
              101,
              115,
              116,
            ],
            "type": "Buffer",
          },
        },
      }
    `)
  })
})