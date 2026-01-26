/**
 * Solana transaction parsing utilities for the GridPlus SDK.
 *
 * Provides functions for decoding, parsing, and manipulating Solana transactions
 * in their wire format. The Lattice device signs only the message portion of a
 * transaction, so these utilities help extract and inject signatures.
 *
 * @module calldata/solana
 */

// ─────────────────────────────────────────────────────────────────────────────
// Compact-u16 Encoding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read a compact-u16 from a buffer at the given offset.
 *
 * Solana uses compact-u16 encoding for array lengths in the transaction wire format.
 * This is a variable-length encoding that uses 1-3 bytes.
 *
 * @param buffer - The buffer to read from
 * @param offset - The byte offset to start reading
 * @returns Tuple of [value, bytesRead]
 * @throws Error if buffer is too short
 */
export function readCompactU16(
  buffer: Uint8Array,
  offset: number,
): [number, number] {
  if (offset >= buffer.length) {
    throw new Error('Buffer underflow reading compact-u16');
  }
  const first = buffer[offset];
  if (first < 0x80) {
    return [first, 1];
  }
  if (offset + 1 >= buffer.length) {
    throw new Error('Buffer underflow reading compact-u16 (2 bytes)');
  }
  const second = buffer[offset + 1];
  if (first < 0xc0) {
    return [((first & 0x7f) << 7) | second, 2];
  }
  if (offset + 2 >= buffer.length) {
    throw new Error('Buffer underflow reading compact-u16 (3 bytes)');
  }
  const third = buffer[offset + 2];
  return [((first & 0x3f) << 14) | (second << 7) | third, 3];
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction Decoding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of decoding a Solana transaction.
 */
export interface DecodedTransaction {
  /** The original encoding format detected */
  encoding: 'base64' | 'base58';
  /** The decoded transaction bytes */
  bytes: Uint8Array;
}

/**
 * Decode a transaction from base64 or base58 encoding.
 *
 * Attempts base64 first (more common for WalletConnect), then falls back to base58.
 *
 * @param transaction - Base64 or base58 encoded transaction string
 * @returns Decoded transaction with encoding metadata
 * @throws Error if decoding fails
 */
export function decodeTransaction(transaction: string): DecodedTransaction {
  // Try base64 first (more common for WalletConnect)
  try {
    // Use Buffer in Node.js environment, atob in browser
    const decoded =
      typeof Buffer !== 'undefined'
        ? Buffer.from(transaction, 'base64')
        : Uint8Array.from(atob(transaction), (c) => c.charCodeAt(0));

    // Validate it's valid base64 by checking round-trip
    const reEncoded =
      typeof Buffer !== 'undefined'
        ? (decoded as Buffer).toString('base64')
        : btoa(String.fromCharCode(...decoded));

    if (reEncoded === transaction) {
      return {
        encoding: 'base64',
        bytes: new Uint8Array(decoded),
      };
    }
  } catch {
    // Fall through to base58
  }

  // Try base58 - requires external bs58 library, caller should handle
  throw new Error(
    'Transaction is not valid base64. Use decodeTransactionBase58 for base58 encoded transactions.',
  );
}

/**
 * Decode a transaction from base58 encoding.
 *
 * This function accepts a pre-decoded Uint8Array since base58 decoding
 * requires the bs58 library which is not bundled with the SDK.
 *
 * @param decodedBytes - Pre-decoded transaction bytes from bs58.decode()
 * @returns Decoded transaction with encoding metadata
 */
export function fromBase58Bytes(decodedBytes: Uint8Array): DecodedTransaction {
  return {
    encoding: 'base58',
    bytes: decodedBytes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parsed Solana transaction structure.
 */
export interface ParsedTransaction {
  /** Number of signature slots in the transaction */
  numSignatures: number;
  /** Byte offset where signatures start (after compact-u16 count) */
  signaturesOffset: number;
  /** Byte offset where the message starts */
  messageOffset: number;
  /** The message bytes (what gets signed) */
  messageBytes: Uint8Array;
}

/**
 * Extract the message bytes from a Solana transaction wire format.
 *
 * Solana transaction wire format:
 * - compact-u16: number of signatures
 * - 64 bytes per signature (may be zero-filled placeholders)
 * - message bytes (rest of buffer)
 *
 * The Lattice SDK expects just the message bytes, not the full transaction.
 *
 * @param txBytes - Full transaction bytes
 * @returns Parsed transaction with message bytes and metadata
 * @throws Error if transaction format is invalid
 */
export function extractMessageFromTransaction(
  txBytes: Uint8Array,
): ParsedTransaction {
  const [numSignatures, sigCountBytes] = readCompactU16(txBytes, 0);

  // Signatures section starts after the compact-u16 count
  const signaturesOffset = sigCountBytes;

  // Message starts after all signatures (64 bytes each)
  const messageOffset = sigCountBytes + numSignatures * 64;

  if (messageOffset > txBytes.length) {
    throw new Error(
      `Invalid transaction: message offset ${messageOffset} exceeds buffer length ${txBytes.length}`,
    );
  }

  const messageBytes = txBytes.subarray(messageOffset);

  return {
    numSignatures,
    signaturesOffset,
    messageOffset,
    messageBytes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Signature Injection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inject a signature into a Solana transaction at the specified index.
 *
 * Solana transactions have reserved signature slots. This function writes
 * a 64-byte Ed25519 signature into the specified slot.
 *
 * @param txBytes - Full transaction bytes
 * @param signature - 64-byte Ed25519 signature
 * @param signatureIndex - Which signature slot to fill (0-indexed, default 0)
 * @returns New transaction bytes with signature injected
 * @throws Error if signature index is out of bounds or signature is wrong size
 */
export function injectSignature(
  txBytes: Uint8Array,
  signature: Uint8Array,
  signatureIndex = 0,
): Uint8Array {
  if (signature.length !== 64) {
    throw new Error(
      `Invalid signature length: expected 64 bytes, got ${signature.length}`,
    );
  }

  const [numSignatures, sigCountBytes] = readCompactU16(txBytes, 0);

  if (signatureIndex >= numSignatures) {
    throw new Error(
      `Signature index ${signatureIndex} out of bounds (${numSignatures} signature slots)`,
    );
  }

  // Create a copy to avoid mutating the original
  const signedTx = new Uint8Array(txBytes);

  // Calculate where this signature should be written
  const signatureOffset = sigCountBytes + signatureIndex * 64;

  // Copy signature bytes into the transaction
  signedTx.set(signature, signatureOffset);

  return signedTx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ed25519 Public Key Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert raw Ed25519 public key bytes to a normalized Uint8Array.
 *
 * Handles various input formats that may be returned from the Lattice device.
 *
 * @param entry - Raw public key data (Uint8Array, Buffer, or hex string)
 * @returns Normalized 32-byte public key, or null if conversion fails
 */
export function toEd25519Bytes(entry: unknown): Uint8Array | null {
  if (entry instanceof Uint8Array) {
    return entry.slice(0, 32);
  }

  // Handle Buffer (Node.js)
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(entry)) {
    return new Uint8Array(entry.slice(0, 32));
  }

  if (typeof entry === 'string') {
    const hex = entry.startsWith('0x')
      ? entry.slice(2)
      : /^[0-9a-fA-F]+$/.test(entry)
        ? entry
        : '';
    if (hex.length >= 64) {
      const out = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      return out;
    }
  }

  return null;
}

/**
 * Convert bytes to a hex string.
 *
 * @param bytes - Bytes to convert
 * @param prefix - Whether to include '0x' prefix (default true)
 * @returns Hex string representation
 */
export function bytesToHex(bytes: Uint8Array, prefix = true): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return prefix ? `0x${hex}` : hex;
}

/**
 * Convert a hex string to bytes.
 *
 * @param hex - Hex string (with or without 0x prefix)
 * @returns Uint8Array of bytes
 * @throws Error if hex string is invalid
 */
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
