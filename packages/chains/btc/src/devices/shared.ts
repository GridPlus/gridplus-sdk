export function compressSecp256k1Pubkey(pubkey: Uint8Array): Uint8Array {
  if (pubkey.length === 33 && (pubkey[0] === 0x02 || pubkey[0] === 0x03)) {
    return pubkey;
  }
  if (pubkey.length === 65 && pubkey[0] === 0x04) {
    const x = pubkey.slice(1, 33);
    const yLastByte = pubkey[64];
    const prefix = yLastByte % 2 === 0 ? 0x02 : 0x03;
    const out = new Uint8Array(33);
    out[0] = prefix;
    out.set(x, 1);
    return out;
  }
  return pubkey;
}

export function normalizeBtcSignedTxHex(tx?: string): string | undefined {
  if (!tx) return undefined;
  return tx.startsWith('0x') ? tx : `0x${tx}`;
}

export function normalizeTxHashHex(txHash?: string): string | undefined {
  if (!txHash) return undefined;
  return txHash.startsWith('0x') ? txHash : `0x${txHash}`;
}
