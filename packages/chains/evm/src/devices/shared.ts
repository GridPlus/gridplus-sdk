import type { Hex } from 'viem';

export function isHexString(value: unknown): value is Hex {
  return typeof value === 'string' && value.startsWith('0x');
}

export {
  compressSecp256k1Pubkey,
  toBuffer,
  parseHexBytes,
  buildSigResultFromRsv,
} from '@gridplus/chain-core';
