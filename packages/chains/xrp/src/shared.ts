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
