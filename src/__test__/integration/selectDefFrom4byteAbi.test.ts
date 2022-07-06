import { selectDefFrom4byteABI } from '../../util';
import { vi } from 'vitest';

describe('selectDefFrom4byteAbi', () => {
  beforeAll(() => {
    // Disable this mock to restore console logs when testing
    console.warn = vi.fn();
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  test('select correct result', () => {
    const result = [
      {
        bytes_signature: '8í9',
        created_at: '2020-08-09T08:56:14.110995Z',
        hex_signature: '0x38ed1739',
        id: 171801,
        text_signature:
          'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
      },
      {
        bytes_signature: '8í9',
        created_at: '2020-01-09T08:56:14.110995Z',
        hex_signature: '0x38ed1739',
        id: 171806,
        text_signature:
          'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
      },
    ];

    const selector = '0x38ed1739';
    expect(selectDefFrom4byteABI(result, selector)).toMatchSnapshot();
  });

  test('handle bad data', () => {
    const result = [];
    const selector = '';
    expect(selectDefFrom4byteABI(result, selector)).toBeNull();
  });
});
