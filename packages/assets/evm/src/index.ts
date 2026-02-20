export { evm } from './asset';
export { createLatticeEvmSigner, latticePlugin } from './devices/lattice';

export type {
  Eip712Payload,
  EvmAdapter,
  EvmAdapterOptions,
  EvmGetAddressParams,
  EvmGetPublicKeyParams,
  EvmRawTransaction,
  EvmSignRequest,
  Signer,
} from './asset';
export type { LatticeEvmSignerOptions } from './devices/lattice';
