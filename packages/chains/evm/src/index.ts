export { evm } from './chain';
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
} from './chain';
export type { LatticeEvmSignerOptions } from './devices/lattice';
