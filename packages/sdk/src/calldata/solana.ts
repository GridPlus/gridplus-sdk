/**
 * Solana transaction parsing utilities.
 * @module calldata/solana
 */

/** Read a compact-u16 (shortvec) from buffer. Little-endian 7-bit groups. */
export function readCompactU16(
  buffer: Uint8Array,
  offset: number,
): [number, number] {
  if (offset >= buffer.length) {
    throw new Error('Buffer underflow reading compact-u16');
  }

  const first = buffer[offset];
  if ((first & 0x80) === 0) {
    return [first, 1];
  }

  if (offset + 1 >= buffer.length) {
    throw new Error('Buffer underflow reading compact-u16 (2 bytes)');
  }
  const second = buffer[offset + 1];

  if ((second & 0x80) === 0) {
    return [(first & 0x7f) | ((second & 0x7f) << 7), 2];
  }

  if (offset + 2 >= buffer.length) {
    throw new Error('Buffer underflow reading compact-u16 (3 bytes)');
  }
  const third = buffer[offset + 2];

  return [(first & 0x7f) | ((second & 0x7f) << 7) | ((third & 0x03) << 14), 3];
}

export interface DecodedTransaction {
  encoding: 'base64' | 'base58';
  bytes: Uint8Array;
}

/**
 * Validates that a string is strictly valid base64 encoding.
 * Base58 strings (common Solana RPC format) will be rejected since base58
 * uses a different alphabet that would decode to garbage if treated as base64.
 * @param input - The string to validate
 * @returns true if the string is valid base64, false otherwise
 */
function isValidBase64(input: string): boolean {
  // Base64 must have length divisible by 4 (with padding)
  if (input.length % 4 !== 0) {
    return false;
  }

  // Check for valid base64 characters: A-Z, a-z, 0-9, +, /, and = for padding
  // This explicitly rejects base58-only chars that aren't in base64
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input)) {
    return false;
  }

  // Round-trip validation: decode and re-encode to verify integrity
  try {
    if (typeof Buffer !== 'undefined') {
      const decoded = Buffer.from(input, 'base64');
      const reencoded = decoded.toString('base64');
      return reencoded === input;
    }
    const decoded = atob(input);
    const reencoded = btoa(decoded);
    return reencoded === input;
  } catch {
    return false;
  }
}

/**
 * Decode base64 transaction. Throws if invalid.
 * @throws Error if the input is not valid base64 or decoded length is outside 100-1232 bytes
 */
export function decodeTransaction(transaction: string): DecodedTransaction {
  // Validate base64 strictly before decoding to reject base58 inputs
  if (!isValidBase64(transaction)) {
    throw new Error(
      'Transaction is not valid base64. Use fromBase58Bytes for base58.',
    );
  }

  const decoded =
    typeof Buffer !== 'undefined'
      ? Buffer.from(transaction, 'base64')
      : Uint8Array.from(atob(transaction), (c) => c.charCodeAt(0));

  // Solana txs are 100-1232 bytes
  if (decoded.length >= 100 && decoded.length <= 1232) {
    return { encoding: 'base64', bytes: new Uint8Array(decoded) };
  }

  throw new Error(
    `Decoded transaction length ${decoded.length} is outside valid Solana range (100-1232 bytes).`,
  );
}

/** Wrap pre-decoded base58 bytes. */
export function fromBase58Bytes(decodedBytes: Uint8Array): DecodedTransaction {
  return { encoding: 'base58', bytes: decodedBytes };
}

export interface ParsedTransaction {
  numSignatures: number;
  signaturesOffset: number;
  messageOffset: number;
  messageBytes: Uint8Array;
}

/** Extract message bytes from Solana transaction wire format. */
export function extractMessageFromTransaction(
  txBytes: Uint8Array,
): ParsedTransaction {
  const [numSignatures, sigCountBytes] = readCompactU16(txBytes, 0);
  const signaturesOffset = sigCountBytes;
  const messageOffset = sigCountBytes + numSignatures * 64;

  if (messageOffset > txBytes.length) {
    throw new Error(
      `Invalid transaction: offset ${messageOffset} exceeds length ${txBytes.length}`,
    );
  }

  return {
    numSignatures,
    signaturesOffset,
    messageOffset,
    messageBytes: txBytes.subarray(messageOffset),
  };
}

/** Inject 64-byte signature into transaction at given slot index. */
export function injectSignature(
  txBytes: Uint8Array,
  signature: Uint8Array,
  signatureIndex = 0,
): Uint8Array {
  if (signature.length !== 64) {
    throw new Error(`Expected 64-byte signature, got ${signature.length}`);
  }

  const [numSignatures, sigCountBytes] = readCompactU16(txBytes, 0);

  if (signatureIndex >= numSignatures) {
    throw new Error(
      `Signature index ${signatureIndex} out of bounds (${numSignatures} slots)`,
    );
  }

  const signedTx = new Uint8Array(txBytes);
  signedTx.set(signature, sigCountBytes + signatureIndex * 64);
  return signedTx;
}

/**
 * Convert raw Ed25519 pubkey to 32-byte Uint8Array.
 * @param entry - The input to convert (Uint8Array, Buffer, or hex string)
 * @returns A 32-byte Uint8Array, or null if the input is invalid or not exactly 32 bytes
 */
export function toEd25519Bytes(entry: unknown): Uint8Array | null {
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(entry)) {
    if (entry.length !== 32) {
      return null;
    }
    return new Uint8Array(entry);
  }

  if (entry instanceof Uint8Array) {
    if (entry.length !== 32) {
      return null;
    }
    return new Uint8Array(entry);
  }

  if (typeof entry === 'string') {
    const hex = entry.startsWith('0x') ? entry.slice(2) : entry;
    if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
      return null;
    }
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }

  return null;
}

export function bytesToHex(bytes: Uint8Array, prefix = true): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return prefix ? `0x${hex}` : hex;
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  if (!/^[0-9a-fA-F]*$/.test(normalized)) {
    throw new Error('Invalid hex characters');
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
