import { Buffer } from 'buffer';
import { RLP } from '@ethereumjs/rlp';
import { Hash } from 'ox';
import secp256k1 from 'secp256k1';
import { parseGenericSigningResponse } from '../../genericSigning';
import { Constants } from '../../index';

describe('parseGenericSigningResponse', () => {
  // Helper to create a DER signature
  const createDERSignature = (r: Buffer, s: Buffer): Buffer => {
    const rLen = r.length;
    const sLen = s.length;
    const totalLen = 4 + rLen + sLen;
    const sig = Buffer.alloc(totalLen + 2);

    sig[0] = 0x30; // DER sequence
    sig[1] = totalLen;
    sig[2] = 0x02; // Integer type
    sig[3] = rLen;
    r.copy(sig, 4);
    sig[4 + rLen] = 0x02; // Integer type
    sig[4 + rLen + 1] = sLen;
    s.copy(sig, 4 + rLen + 2);

    // Pad to 74 bytes (standard for Lattice)
    const padded = Buffer.alloc(74);
    sig.copy(padded, 0);
    return padded;
  };

  it('should handle generic KECCAK256 message (not EVM transaction)', () => {
    // Simulate signing a plain text message "Test!"
    const payload = Buffer.from('Test!');
    const hash = Buffer.from(Hash.keccak256(payload));

    // Create a fake signature
    const privateKey = Buffer.from(
      '0101010101010101010101010101010101010101010101010101010101010101',
      'hex',
    );
    const sigObj = secp256k1.ecdsaSign(hash, privateKey);
    const publicKey = secp256k1.publicKeyCreate(privateKey, false);

    // Create DER-encoded signature response
    const derSig = createDERSignature(
      Buffer.from(sigObj.signature.slice(0, 32)),
      Buffer.from(sigObj.signature.slice(32, 64)),
    );

    // Create mock response buffer
    const mockResponse = Buffer.concat([
      Buffer.from([0x04]), // Uncompressed pubkey prefix
      publicKey.slice(1), // Remove compression prefix from secp256k1 output (64 bytes)
      derSig,
    ]);

    const req = {
      curveType: Constants.SIGNING.CURVES.SECP256K1,
      hashType: Constants.SIGNING.HASHES.KECCAK256,
      encodingType: null, // Not EVM encoding
      origPayloadBuf: payload,
    };

    const result = parseGenericSigningResponse(mockResponse, 0, req);

    expect(result).toBeDefined();
    expect(result.sig).toBeDefined();
    expect(result.sig.v).toBeDefined();
    expect(typeof result.sig.v).toBe('bigint');

    // For non-EVM generic messages, v should be 27 or 28
    expect([27n, 28n]).toContain(result.sig.v);
  });

  it('should handle EVM transaction encoding', () => {
    // Simulate an unsigned legacy transaction
    const unsignedTx = Buffer.from(
      'e9808504a817c800825208943535353535353535353535353535353535353535880de0b6b3a764000080',
      'hex',
    );
    const hash = Buffer.from(Hash.keccak256(unsignedTx));

    // Create a fake signature
    const privateKey = Buffer.from(
      '0101010101010101010101010101010101010101010101010101010101010101',
      'hex',
    );
    const sigObj = secp256k1.ecdsaSign(hash, privateKey);
    const publicKey = secp256k1.publicKeyCreate(privateKey, false);

    // Create DER-encoded signature response
    const derSig = createDERSignature(
      Buffer.from(sigObj.signature.slice(0, 32)),
      Buffer.from(sigObj.signature.slice(32, 64)),
    );

    // Create mock response buffer
    const mockResponse = Buffer.concat([
      Buffer.from([0x04]), // Uncompressed pubkey prefix
      publicKey.slice(1), // Remove compression prefix from secp256k1 output (64 bytes)
      derSig,
    ]);

    const req = {
      curveType: Constants.SIGNING.CURVES.SECP256K1,
      hashType: Constants.SIGNING.HASHES.KECCAK256,
      encodingType: Constants.SIGNING.ENCODINGS.EVM,
      origPayloadBuf: unsignedTx,
    };

    const result = parseGenericSigningResponse(mockResponse, 0, req);

    expect(result).toBeDefined();
    expect(result.sig).toBeDefined();
    expect(result.sig.v).toBeDefined();
    expect(typeof result.sig.v).toBe('bigint');

    // For pre-EIP155 transactions, v should be 27 or 28
    const vNumber = Number(result.sig.v);
    expect([27, 28]).toContain(vNumber);
  });

  it('should handle RLP-encoded data that looks like a transaction', () => {
    // Create an RLP-encoded array with 6+ elements (looks like a transaction)
    const txLikeData = [
      Buffer.from([0x01]), // nonce
      Buffer.from([0x02]), // gasPrice
      Buffer.from([0x03]), // gasLimit
      Buffer.from([0x04]), // to
      Buffer.from([0x05]), // value
      Buffer.from([0x06]), // data
    ];
    const rlpEncoded = Buffer.from(RLP.encode(txLikeData));
    const hash = Buffer.from(Hash.keccak256(rlpEncoded));

    // Create a fake signature
    const privateKey = Buffer.from(
      '0101010101010101010101010101010101010101010101010101010101010101',
      'hex',
    );
    const sigObj = secp256k1.ecdsaSign(hash, privateKey);
    const publicKey = secp256k1.publicKeyCreate(privateKey, false);

    // Create DER-encoded signature response
    const derSig = createDERSignature(
      Buffer.from(sigObj.signature.slice(0, 32)),
      Buffer.from(sigObj.signature.slice(32, 64)),
    );

    // Create mock response buffer
    const mockResponse = Buffer.concat([
      Buffer.from([0x04]), // Uncompressed pubkey prefix
      publicKey.slice(1), // Remove compression prefix from secp256k1 output (64 bytes)
      derSig,
    ]);

    const req = {
      curveType: Constants.SIGNING.CURVES.SECP256K1,
      hashType: Constants.SIGNING.HASHES.KECCAK256,
      encodingType: null, // Not explicitly EVM
      origPayloadBuf: rlpEncoded,
    };

    const result = parseGenericSigningResponse(mockResponse, 0, req);

    expect(result).toBeDefined();
    expect(result.sig).toBeDefined();
    expect(result.sig.v).toBeDefined();
    expect(typeof result.sig.v).toBe('bigint');
  });
});
