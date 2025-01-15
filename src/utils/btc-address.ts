import bs58check from 'bs58check';

export interface DecodedAddress {
  version: number;
  hash: Buffer;
}

export const btcAddress = {
  fromBase58Check(address: string): DecodedAddress {
    const decoded = bs58check.decode(address);
    return {
      version: decoded[0],
      hash: decoded.slice(1)
    };
  }
}; 