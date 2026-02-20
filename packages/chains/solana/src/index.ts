export { solana } from './chain';
export { addressToPubkey, buildPath, pubkeyToAddress } from './chain';
export { createLatticeSolanaSigner, latticePlugin } from './devices/lattice';

export type {
  Signer,
  SolanaAdapter,
  SolanaAdapterOptions,
  SolanaGetAddressParams,
  SolanaGetPublicKeyParams,
  SolanaSignRequest,
} from './chain';
