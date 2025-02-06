import { describe, expect, it } from 'vitest';
import { selectDefFrom4byteABI } from '../../util';

describe('selectDefFrom4byteAbi', () => {
  it('select correct result', async () => {
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
      {
        bytes_signature: '',
        created_at: '2020-01-09T08:56:14.110995Z',
        hex_signature: '0x38ed9',
        id: 171806,
        text_signature: 'swapToken',
      },
    ];
    const selector = '0x38ed1739';
    const def = await selectDefFrom4byteABI(result, selector);
    expect(def).toMatchSnapshot();
  });

  it('handle no match', async () => {
    const result = [
      {
        bytes_signature: '',
        created_at: '2020-01-09T08:56:14.110995Z',
        hex_signature: '0x3ed9',
        id: 171806,
        text_signature: 'swapToken',
      },
    ];
    const selector = '0x38ed1739';
    await expect(selectDefFrom4byteABI(result, selector)).rejects.toThrow();
  });

  it('handle no selector', async () => {
    const result = [
      {
        bytes_signature: '',
        created_at: '2020-01-09T08:56:14.110995Z',
        hex_signature: '0x3ed9',
        id: 171806,
        text_signature: 'swapToken',
      },
    ];
    const selector = undefined;
    await expect(selectDefFrom4byteABI(result, selector)).rejects.toThrow();
  });

  it('handle no result', async () => {
    const result = undefined;
    const selector = '0x38ed1739';
    await expect(selectDefFrom4byteABI(result, selector)).rejects.toThrow();
  });

  it('handle bad data', async () => {
    const result = [];
    const selector = '';
    await expect(selectDefFrom4byteABI(result, selector)).rejects.toThrow();
  });
});
