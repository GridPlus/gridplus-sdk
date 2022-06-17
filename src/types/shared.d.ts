interface KVRecords {
  [key: string]: string;
}

interface EncrypterParams {
  payload: Buffer;
  sharedSecret: Buffer;
}

type Signature = {
  r: Buffer;
  s: Buffer;
  v?: Buffer;
}

type KeyPair = ec.KeyPair;

type WalletPath = [number, number, number, number, number]