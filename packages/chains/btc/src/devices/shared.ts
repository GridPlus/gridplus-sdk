export { compressSecp256k1Pubkey } from '@gridplus/chain-core';

export function normalizeBtcSignedTxHex(tx?: string): string | undefined {
  if (!tx) return undefined;
  return tx.startsWith('0x') ? tx : `0x${tx}`;
}

export function normalizeTxHashHex(txHash?: string): string | undefined {
  if (!txHash) return undefined;
  return txHash.startsWith('0x') ? txHash : `0x${txHash}`;
}
