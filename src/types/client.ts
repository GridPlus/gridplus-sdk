import { Buffer } from 'buffer/';
import 'hash.js';

type Hash = {
  hash: Sha256Constructor | Ripemd160Constructor;
  update: (x) => Hash;
  digest: () => Buffer;
};

export type Crypto = {
  get32RandomBytes: () => Buffer;
  generateEntropy: () => Buffer;
  randomBytes: (n: number) => Buffer;
  createHash: (type) => Hash;
};

export type ABIRecord = {
  header: {
    sig: string;
    name: string;
    numParam: number;
  };
  category: string;
  params: {
    isArray: boolean;
    arraySz: number;
    name: string;
    latticeTypeIdx: number;
  }[];
};

export type KVRecord = {
  id?: number;
  type?: number;
  caseSensitive?: boolean;
  key?: string;
  val?: string;
};

export type SignatureResponse = {
  tx?: string;
  txHash?: string;
  changeRecipient?: string;
  sig?: {
    v: Buffer;
    r: Buffer;
    s: Buffer;
  };
  sigs?: Buffer[];
  signer?: Buffer;
};
