import { decodeTransaction, toEd25519Bytes } from '../../calldata/solana';

describe('Solana utilities', () => {
  describe('decodeTransaction', () => {
    // Generate a valid base64 transaction of minimum valid size (100 bytes)
    const createValidBase64Tx = (length: number): string => {
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        bytes[i] = i % 256;
      }
      return Buffer.from(bytes).toString('base64');
    };

    test('should decode valid base64 transaction within size range', () => {
      const validTx = createValidBase64Tx(200);
      const result = decodeTransaction(validTx);

      expect(result.encoding).toBe('base64');
      expect(result.bytes).toBeInstanceOf(Uint8Array);
      expect(result.bytes.length).toBe(200);
    });

    test('should decode transaction at minimum valid size (100 bytes)', () => {
      const validTx = createValidBase64Tx(100);
      const result = decodeTransaction(validTx);

      expect(result.encoding).toBe('base64');
      expect(result.bytes.length).toBe(100);
    });

    test('should decode transaction at maximum valid size (1232 bytes)', () => {
      const validTx = createValidBase64Tx(1232);
      const result = decodeTransaction(validTx);

      expect(result.encoding).toBe('base64');
      expect(result.bytes.length).toBe(1232);
    });

    test('should reject transaction below minimum size (99 bytes)', () => {
      const tooSmall = createValidBase64Tx(99);
      expect(() => decodeTransaction(tooSmall)).toThrow(
        /outside valid Solana range/,
      );
    });

    test('should reject transaction above maximum size (1233 bytes)', () => {
      const tooLarge = createValidBase64Tx(1233);
      expect(() => decodeTransaction(tooLarge)).toThrow(
        /outside valid Solana range/,
      );
    });

    test('should reject base58-encoded string (common Solana RPC format)', () => {
      // This is a base58 string (uses only base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz)
      // Note: base58 excludes 0, O, I, l which are in base64
      // This should NOT silently decode as garbage base64
      const base58String = '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi';

      expect(() => decodeTransaction(base58String)).toThrow(/not valid base64/);
    });

    test('should reject base58 transaction that would decode to valid length if treated as base64', () => {
      // Create a string with length not divisible by 4 (invalid base64 padding)
      // This simulates a base58 string that would fail the round-trip check
      const fakeBase58 = `${'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijk123456789'.repeat(5)}ABC`;

      expect(() => decodeTransaction(fakeBase58)).toThrow(/not valid base64/);
    });

    test('should reject strings with invalid base64 characters', () => {
      // Contains characters not in base64 alphabet ($ and @)
      const invalidChars = 'SGVsbG8$V29ybGQ@';
      expect(() => decodeTransaction(invalidChars)).toThrow(/not valid base64/);
    });

    test('should reject strings with wrong padding', () => {
      // Valid base64 should have proper = padding
      const wrongPadding = 'SGVsbG8gV29ybGQ';
      expect(() => decodeTransaction(wrongPadding)).toThrow(/not valid base64/);
    });

    test('should reject empty string', () => {
      expect(() => decodeTransaction('')).toThrow();
    });
  });

  describe('toEd25519Bytes', () => {
    test('should return 32-byte array for valid 32-byte Uint8Array', () => {
      const validKey = new Uint8Array(32).fill(42);
      const result = toEd25519Bytes(validKey);

      expect(result).not.toBeNull();
      expect(result?.length).toBe(32);
      expect(result?.[0]).toBe(42);
    });

    test('should truncate 64-byte Uint8Array to 32 bytes', () => {
      const longKey = new Uint8Array(64);
      for (let i = 0; i < 64; i++) {
        longKey[i] = i;
      }
      const result = toEd25519Bytes(longKey);

      expect(result).not.toBeNull();
      expect(result?.length).toBe(32);
      expect(result?.[31]).toBe(31);
    });

    test('should return null for Uint8Array shorter than 32 bytes', () => {
      const shortKey = new Uint8Array(16).fill(1);
      const result = toEd25519Bytes(shortKey);

      expect(result).toBeNull();
    });

    test('should return null for 31-byte Uint8Array (off by one)', () => {
      const almostValid = new Uint8Array(31).fill(1);
      const result = toEd25519Bytes(almostValid);

      expect(result).toBeNull();
    });

    test('should return null for empty Uint8Array', () => {
      const empty = new Uint8Array(0);
      const result = toEd25519Bytes(empty);

      expect(result).toBeNull();
    });

    test('should return 32-byte array for valid 32-byte Buffer', () => {
      const validBuffer = Buffer.alloc(32, 0xab);
      const result = toEd25519Bytes(validBuffer);

      expect(result).not.toBeNull();
      expect(result?.length).toBe(32);
      expect(result?.[0]).toBe(0xab);
    });

    test('should truncate longer Buffer to 32 bytes', () => {
      const longBuffer = Buffer.alloc(48, 0xcd);
      const result = toEd25519Bytes(longBuffer);

      expect(result).not.toBeNull();
      expect(result?.length).toBe(32);
    });

    test('should return null for Buffer shorter than 32 bytes', () => {
      const shortBuffer = Buffer.alloc(20, 0xef);
      const result = toEd25519Bytes(shortBuffer);

      expect(result).toBeNull();
    });

    test('should parse valid 64-character hex string (32 bytes)', () => {
      const hex64 = 'a'.repeat(64);
      const result = toEd25519Bytes(hex64);

      expect(result).not.toBeNull();
      expect(result?.length).toBe(32);
      expect(result?.[0]).toBe(0xaa);
    });

    test('should parse valid 0x-prefixed hex string', () => {
      const hex = `0x${'b'.repeat(64)}`;
      const result = toEd25519Bytes(hex);

      expect(result).not.toBeNull();
      expect(result?.length).toBe(32);
      expect(result?.[0]).toBe(0xbb);
    });

    test('should truncate longer hex string to 32 bytes', () => {
      const longHex = `0x${'c'.repeat(128)}`;
      const result = toEd25519Bytes(longHex);

      expect(result).not.toBeNull();
      expect(result?.length).toBe(32);
    });

    test('should return null for hex string shorter than 64 chars (32 bytes)', () => {
      const shortHex = 'd'.repeat(62);
      const result = toEd25519Bytes(shortHex);

      expect(result).toBeNull();
    });

    test('should return null for non-hex string', () => {
      const notHex = 'not-a-valid-hex-string-at-all-xyz';
      const result = toEd25519Bytes(notHex);

      expect(result).toBeNull();
    });

    test('should return null for null input', () => {
      const result = toEd25519Bytes(null);
      expect(result).toBeNull();
    });

    test('should return null for undefined input', () => {
      const result = toEd25519Bytes(undefined);
      expect(result).toBeNull();
    });

    test('should return null for number input', () => {
      const result = toEd25519Bytes(12345);
      expect(result).toBeNull();
    });

    test('should return null for object input', () => {
      const result = toEd25519Bytes({ length: 32 });
      expect(result).toBeNull();
    });
  });
});
