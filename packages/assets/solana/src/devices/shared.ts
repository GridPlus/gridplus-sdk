export function toBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") {
    const hex = value.startsWith("0x") ? value.slice(2) : value;
    return Buffer.from(hex, "hex");
  }
  throw new Error("Unsupported byte input");
}

export function parseHexBytes(
  value: unknown,
  expectedLen?: number,
): Uint8Array {
  if (typeof value === "string") {
    const hex = value.startsWith("0x") ? value.slice(2) : value;
    const buf = Buffer.from(hex, "hex");
    if (
      expectedLen !== undefined &&
      buf.length !== expectedLen &&
      buf.length < expectedLen
    ) {
      const out = Buffer.alloc(expectedLen);
      buf.copy(out, expectedLen - buf.length);
      return new Uint8Array(out);
    }
    return new Uint8Array(buf);
  }
  if (Buffer.isBuffer(value)) return new Uint8Array(value);
  if (value instanceof Uint8Array) return value;
  throw new Error("Unsupported signature component type");
}

export function buildSigResultFromRsv(sig: {
  r?: unknown;
  s?: unknown;
  v?: unknown;
}): {
  signature: {
    bytes: Uint8Array;
    r?: Uint8Array;
    s?: Uint8Array;
    v?: bigint | number;
  };
} {
  const r = sig.r !== undefined ? parseHexBytes(sig.r, 32) : undefined;
  const s = sig.s !== undefined ? parseHexBytes(sig.s, 32) : undefined;

  let v: bigint | number | undefined;
  if (typeof sig.v === "bigint") v = sig.v;
  else if (typeof sig.v === "number") v = sig.v;
  else if (typeof sig.v === "string") v = BigInt(sig.v);
  else if (Buffer.isBuffer(sig.v) || sig.v instanceof Uint8Array) {
    const buf = Buffer.from(sig.v);
    v = buf.length === 0 ? 0n : BigInt(`0x${buf.toString("hex")}`);
  }

  const bytes =
    r && s
      ? new Uint8Array(Buffer.concat([Buffer.from(r), Buffer.from(s)]))
      : new Uint8Array();
  return { signature: { bytes, r, s, v } };
}
