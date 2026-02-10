import type {
  Address,
  DerivationPath,
  PublicKey,
  SignResult,
} from '@gridplus/asset-core';
import {
  BTC_COIN_TYPES,
  BTC_PURPOSES,
  HARDENED_OFFSET,
  format,
  type BtcCoinType,
  type BtcPurpose,
  type BtcSignRequest,
  type Signer as BtcSigner,
  type XpubOptions,
  type XpubsOptions,
} from '@gridplus/btc';
import type { Signer as CosmosSigner, CosmosSignRequest } from '@gridplus/cosmos';
import type {
  EvmRawTransaction,
  EvmSignRequest,
  Signer as EvmSigner,
} from '@gridplus/evm';
import { pubkeyToAddress, type Signer as SolanaSigner, type SolanaSignRequest } from '@gridplus/solana';
import { Hash } from 'ox';
import {
  type Hex,
  type TransactionSerializable,
  type TransactionSerializableEIP7702,
  serializeTransaction,
} from 'viem';
import { CURRENCIES } from '@gridplus/types';
import { EXTERNAL } from '../constants';
import { queue } from '../api/utilities';
import { fetchDecoder } from '../functions/fetchDecoder';

function isHexString(value: unknown): value is Hex {
  return typeof value === 'string' && value.startsWith('0x');
}

function toBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') {
    const hex = value.startsWith('0x') ? value.slice(2) : value;
    return Buffer.from(hex, 'hex');
  }
  throw new Error('Unsupported byte input');
}

function compressSecp256k1Pubkey(pubkey: Uint8Array): Uint8Array {
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

function parseHexBytes(value: unknown, expectedLen?: number): Uint8Array {
  if (typeof value === 'string') {
    const hex = value.startsWith('0x') ? value.slice(2) : value;
    const buf = Buffer.from(hex, 'hex');
    if (expectedLen !== undefined && buf.length !== expectedLen) {
      // Keep padding logic conservative: only left-pad when the value is shorter.
      if (buf.length < expectedLen) {
        const out = Buffer.alloc(expectedLen);
        buf.copy(out, expectedLen - buf.length);
        return new Uint8Array(out);
      }
    }
    return new Uint8Array(buf);
  }
  if (Buffer.isBuffer(value)) return new Uint8Array(value);
  if (value instanceof Uint8Array) return value;
  throw new Error('Unsupported signature component type');
}

function normalizeBtcSignedTxHex(tx?: string): string | undefined {
  if (!tx) return undefined;
  return tx.startsWith('0x') ? tx : `0x${tx}`;
}

function normalizeTxHashHex(txHash?: string): string | undefined {
  if (!txHash) return undefined;
  return txHash.startsWith('0x') ? txHash : `0x${txHash}`;
}

function buildSigResultFromRsv(sig: {
  r?: unknown;
  s?: unknown;
  v?: unknown;
}): { signature: { bytes: Uint8Array; r?: Uint8Array; s?: Uint8Array; v?: bigint | number } } {
  const r = sig.r !== undefined ? parseHexBytes(sig.r, 32) : undefined;
  const s = sig.s !== undefined ? parseHexBytes(sig.s, 32) : undefined;

  let v: bigint | number | undefined;
  if (typeof sig.v === 'bigint') v = sig.v;
  else if (typeof sig.v === 'number') v = sig.v;
  else if (typeof sig.v === 'string') v = BigInt(sig.v);
  else if (Buffer.isBuffer(sig.v) || sig.v instanceof Uint8Array) {
    const buf = Buffer.from(sig.v as any);
    v = buf.length === 0 ? 0n : BigInt(`0x${buf.toString('hex')}`);
  }

  const bytes =
    r && s ? new Uint8Array(Buffer.concat([Buffer.from(r), Buffer.from(s)])) : new Uint8Array();
  return { signature: { bytes, r, s, v } };
}

export type LatticeSignerOptions = {
  /** If true, try to fetch a calldata decoder for EVM tx requests when possible. */
  fetchEvmDecoder?: boolean;
};

export function createLatticeBtcSigner(): BtcSigner {
  const getAddress = async (path: DerivationPath): Promise<Address> => {
    const res = (await queue((client) =>
      client.getAddresses({ startPath: path, n: 1 }),
    )) as any[];
    const addr = res?.[0];
    if (typeof addr !== 'string') {
      throw new Error('Device did not return a BTC address string');
    }
    return addr;
  };

  const getPublicKey = async (
    path: DerivationPath,
    options?: unknown,
  ): Promise<PublicKey> => {
    const res = (await queue((client) =>
      client.getAddresses({
        startPath: path,
        n: 1,
        flag: EXTERNAL.GET_ADDR_FLAGS.SECP256K1_PUB,
      }),
    )) as any[];
    const pub = res?.[0];
    if (!pub) throw new Error('Device did not return a public key');
    const pubBytes = Buffer.from(pub);
    const wantCompressed =
      typeof (options as any)?.compressed === 'boolean'
        ? Boolean((options as any).compressed)
        : false;
    return wantCompressed
      ? compressSecp256k1Pubkey(new Uint8Array(pubBytes))
      : new Uint8Array(pubBytes);
  };

  const sign = async (request: BtcSignRequest): Promise<SignResult> => {
    if (request.kind !== 'transaction') {
      throw new Error(`Unsupported BTC sign request kind: ${request.kind}`);
    }
    const res = await queue((client) =>
      client.sign({ data: request.payload as any, currency: CURRENCIES.BTC }),
    );
    return {
      signature: { bytes: new Uint8Array() },
      signedPayload: normalizeBtcSignedTxHex((res as any).tx),
      txHash: normalizeTxHashHex((res as any).txHash),
      metadata: {
        changeRecipient: (res as any).changeRecipient,
        sigs: (res as any).sigs,
      },
    };
  };

  const getXpub = async (options: XpubOptions): Promise<string> => {
    const { purpose, coinType = BTC_COIN_TYPES.MAINNET, account = 0 } = options;
    const startPath: DerivationPath = [
      purpose + HARDENED_OFFSET,
      coinType + HARDENED_OFFSET,
      account + HARDENED_OFFSET,
    ];
    const network =
      coinType === BTC_COIN_TYPES.TESTNET ? 'testnet' : 'mainnet';
    const res = (await queue((client) =>
      client.getAddresses({
        startPath,
        n: 1,
        flag: EXTERNAL.GET_ADDR_FLAGS.SECP256K1_XPUB,
      }),
    )) as any[];
    const xpub = res?.[0];
    if (typeof xpub !== 'string') {
      throw new Error('Device did not return an xpub string');
    }
    return format(xpub, purpose, network);
  };

  const getXpubs = async (
    options: XpubsOptions,
  ): Promise<Map<BtcPurpose, string>> => {
    const { purposes, coinType = BTC_COIN_TYPES.MAINNET, account = 0 } = options;
    const results = new Map<BtcPurpose, string>();
    for (const purpose of purposes) {
      results.set(
        purpose,
        await getXpub({ purpose, coinType, account }),
      );
    }
    return results;
  };

  const getAllXpubs = async (
    coinType: BtcCoinType = BTC_COIN_TYPES.MAINNET,
    account = 0,
  ): Promise<{ xpub: string; ypub: string; zpub: string }> => {
    const xpubs = await getXpubs({
      purposes: [BTC_PURPOSES.LEGACY, BTC_PURPOSES.WRAPPED, BTC_PURPOSES.NATIVE],
      coinType,
      account,
    });
    const xpub = xpubs.get(BTC_PURPOSES.LEGACY);
    const ypub = xpubs.get(BTC_PURPOSES.WRAPPED);
    const zpub = xpubs.get(BTC_PURPOSES.NATIVE);
    if (!xpub || !ypub || !zpub) {
      throw new Error('Failed to fetch all xpubs');
    }
    return { xpub, ypub, zpub };
  };

  return {
    getAddress,
    getPublicKey,
    sign,
    getXpub,
    getXpubs,
    getAllXpubs,
  };
}

function isRawEvmTx(value: TransactionSerializable | EvmRawTransaction): value is EvmRawTransaction {
  return (
    typeof value === 'string' ||
    value instanceof Uint8Array ||
    Buffer.isBuffer(value)
  );
}

function normalizeRawEvmTx(tx: EvmRawTransaction): Hex | Buffer {
  if (typeof tx === 'string') {
    return (tx.startsWith('0x') ? tx : (`0x${tx}` as Hex)) as Hex;
  }
  return Buffer.from(tx);
}

function getEvmEncodingType(tx: TransactionSerializable): number {
  if ((tx as any).type === 'eip7702') {
    const eip7702 = tx as TransactionSerializableEIP7702;
    const hasAuthList =
      eip7702.authorizationList && eip7702.authorizationList.length > 0;
    return hasAuthList
      ? EXTERNAL.SIGNING.ENCODINGS.EIP7702_AUTH_LIST
      : EXTERNAL.SIGNING.ENCODINGS.EIP7702_AUTH;
  }
  return EXTERNAL.SIGNING.ENCODINGS.EVM;
}

export function createLatticeEvmSigner(
  options: LatticeSignerOptions = {},
): EvmSigner {
  return {
    getAddress: async (path: DerivationPath): Promise<Address> => {
      const res = (await queue((client) =>
        client.getAddresses({ startPath: path, n: 1 }),
      )) as any[];
      const addr = res?.[0];
      if (typeof addr !== 'string') {
        throw new Error('Device did not return an EVM address string');
      }
      return addr;
    },
    getPublicKey: async (path: DerivationPath, opts?: unknown): Promise<PublicKey> => {
      const res = (await queue((client) =>
        client.getAddresses({
          startPath: path,
          n: 1,
          flag: EXTERNAL.GET_ADDR_FLAGS.SECP256K1_PUB,
        }),
      )) as any[];
      const pub = res?.[0];
      if (!pub) throw new Error('Device did not return a public key');
      const pubBytes = Buffer.from(pub);
      const wantCompressed =
        typeof (opts as any)?.compressed === 'boolean'
          ? Boolean((opts as any).compressed)
          : false;
      return wantCompressed
        ? compressSecp256k1Pubkey(new Uint8Array(pubBytes))
        : new Uint8Array(pubBytes);
    },
    sign: async (request: EvmSignRequest): Promise<SignResult> => {
      const path = (request as any).options?.path as DerivationPath | undefined;
      if (!path || path.length < 2) {
        throw new Error('EVM sign request missing signer path');
      }

      if (request.kind === 'transaction') {
        const isRaw = isRawEvmTx(request.payload);
        const payload = isRaw
          ? normalizeRawEvmTx(request.payload as EvmRawTransaction)
          : serializeTransaction(request.payload as TransactionSerializable);

        const encodingType = isRaw
          ? EXTERNAL.SIGNING.ENCODINGS.EVM
          : getEvmEncodingType(request.payload as TransactionSerializable);

        let decoder: Buffer | undefined;
        if (!isRaw && options.fetchEvmDecoder) {
          const tx = request.payload as TransactionSerializable;
          if ('data' in tx && 'to' in tx && 'chainId' in tx) {
            decoder = await fetchDecoder({
              data: (tx as any).data,
              to: (tx as any).to,
              chainId: (tx as any).chainId,
            } as any);
          }
        }

        const signPayload = {
          signerPath: path,
          curveType: EXTERNAL.SIGNING.CURVES.SECP256K1,
          hashType: EXTERNAL.SIGNING.HASHES.KECCAK256,
          encodingType,
          payload,
          decoder,
        };

        const res = await queue((client) => client.sign({ data: signPayload }));

        const sig = (res as any).sig ?? {};
        const { signature } = buildSigResultFromRsv(sig);
        const pubkey = (res as any).pubkey
          ? compressSecp256k1Pubkey(new Uint8Array(Buffer.from((res as any).pubkey)))
          : undefined;

        const signedPayload =
          (res as any).viemTx ?? (res as any).tx ?? undefined;
        const txHash =
          typeof signedPayload === 'string' && isHexString(signedPayload)
            ? (`0x${Buffer.from(Hash.keccak256(toBuffer(signedPayload))).toString('hex')}` as string)
            : undefined;

        return {
          signature,
          publicKey: pubkey,
          signedPayload,
          txHash,
          metadata: {
            viemTx: (res as any).viemTx,
          },
        };
      }

      if (request.kind === 'message') {
        const protocol = (request as any).options?.protocol ?? 'signPersonal';
        const res = await queue((client) =>
          client.sign({
            data: {
              signerPath: path,
              curveType: EXTERNAL.SIGNING.CURVES.SECP256K1,
              hashType: EXTERNAL.SIGNING.HASHES.KECCAK256,
              payload: request.payload as any,
              protocol,
            },
            currency: CURRENCIES.ETH_MSG,
          }),
        );
        const sig = (res as any).sig ?? {};
        const { signature } = buildSigResultFromRsv(sig);
        return {
          signature,
          signedPayload: undefined,
          metadata: {
            signer: (res as any).signer,
          },
        };
      }

      if (request.kind === 'typedData') {
        const res = await queue((client) =>
          client.sign({
            data: {
              signerPath: path,
              curveType: EXTERNAL.SIGNING.CURVES.SECP256K1,
              hashType: EXTERNAL.SIGNING.HASHES.KECCAK256,
              payload: request.payload as any,
              protocol: 'eip712',
            },
            currency: CURRENCIES.ETH_MSG,
          }),
        );
        const sig = (res as any).sig ?? {};
        const { signature } = buildSigResultFromRsv(sig);
        return {
          signature,
          signedPayload: undefined,
          metadata: {
            signer: (res as any).signer,
          },
        };
      }

      throw new Error(`Unsupported EVM sign request kind: ${(request as any).kind}`);
    },
  };
}

export function createLatticeSolanaSigner(): SolanaSigner {
  const getPublicKey = async (path: DerivationPath): Promise<PublicKey> => {
    const res = (await queue((client) =>
      client.getAddresses({
        startPath: path,
        n: 1,
        flag: EXTERNAL.GET_ADDR_FLAGS.ED25519_PUB,
      }),
    )) as any[];
    const pub = res?.[0];
    if (!pub) throw new Error('Device did not return a public key');
    const pubBytes = Buffer.from(pub);
    return new Uint8Array(pubBytes.slice(0, 32));
  };

  const getAddress = async (path: DerivationPath): Promise<Address> => {
    const pubkey = await getPublicKey(path);
    return pubkeyToAddress(pubkey);
  };

  const sign = async (request: SolanaSignRequest): Promise<SignResult> => {
    if (request.kind !== 'transaction') {
      throw new Error(`Unsupported Solana sign request kind: ${request.kind}`);
    }
    const path = (request as any).options?.path as DerivationPath | undefined;
    if (!path || path.length < 2) {
      throw new Error('Solana sign request missing signer path');
    }

    const signPayload = {
      signerPath: path,
      curveType: EXTERNAL.SIGNING.CURVES.ED25519,
      hashType: EXTERNAL.SIGNING.HASHES.NONE,
      encodingType: EXTERNAL.SIGNING.ENCODINGS.SOLANA,
      payload: toBuffer(request.payload as any),
    };

    const res = await queue((client) => client.sign({ data: signPayload }));
    const sig = (res as any).sig ?? {};
    const { signature } = buildSigResultFromRsv(sig);

    const pubkey = (res as any).pubkey
      ? new Uint8Array(Buffer.from((res as any).pubkey).slice(0, 32))
      : undefined;

    return {
      signature,
      publicKey: pubkey,
    };
  };

  return {
    getAddress,
    getPublicKey,
    sign,
  };
}

export function createLatticeCosmosSigner(): CosmosSigner {
  return {
    getAddress: async (path: DerivationPath): Promise<Address> => {
      void path;
      // Lattice does not support Cosmos bech32 addresses via getAddresses.
      // Use @gridplus/cosmos adapter `getAddress()` which derives bech32 from the pubkey + HRP.
      throw new Error(
        'Cosmos addresses must be derived from pubkey (use @gridplus/cosmos adapter)',
      );
    },
    getPublicKey: async (path: DerivationPath, opts?: unknown): Promise<PublicKey> => {
      const res = (await queue((client) =>
        client.getAddresses({
          startPath: path,
          n: 1,
          flag: EXTERNAL.GET_ADDR_FLAGS.SECP256K1_PUB,
        }),
      )) as any[];
      const pub = res?.[0];
      if (!pub) throw new Error('Device did not return a public key');
      const pubBytes = Buffer.from(pub);
      const wantCompressed =
        typeof (opts as any)?.compressed === 'boolean'
          ? Boolean((opts as any).compressed)
          : true;
      return wantCompressed
        ? compressSecp256k1Pubkey(new Uint8Array(pubBytes))
        : new Uint8Array(pubBytes);
    },
    sign: async (request: CosmosSignRequest): Promise<SignResult> => {
      if (request.kind !== 'transaction') {
        throw new Error(`Unsupported Cosmos sign request kind: ${request.kind}`);
      }
      const path = (request as any).options?.path as DerivationPath | undefined;
      if (!path || path.length < 2) {
        throw new Error('Cosmos sign request missing signer path');
      }

      const signPayload = {
        signerPath: path,
        curveType: EXTERNAL.SIGNING.CURVES.SECP256K1,
        hashType: EXTERNAL.SIGNING.HASHES.SHA256,
        encodingType: EXTERNAL.SIGNING.ENCODINGS.COSMOS,
        payload: Buffer.from(request.payload as any),
      };

      const res = await queue((client) => client.sign({ data: signPayload }));
      const sig = (res as any).sig ?? {};
      const { signature } = buildSigResultFromRsv(sig);

      const pubkey = (res as any).pubkey
        ? compressSecp256k1Pubkey(new Uint8Array(Buffer.from((res as any).pubkey)))
        : undefined;

      return {
        signature,
        publicKey: pubkey,
        metadata: {
          mode: (request as any).options?.mode,
        },
      };
    },
  };
}
