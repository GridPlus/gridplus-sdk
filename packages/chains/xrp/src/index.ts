export {
  decodeClassicAddress,
  encodeClassicAddress,
  pubkeyToAddress,
  xrp,
} from './chain';
export { createLatticeXrpSigner, latticePlugin } from './devices/lattice';

export type {
  Signer,
  XrpAdapter,
  XrpAdapterOptions,
  XrpGetAddressParams,
  XrpGetPublicKeyParams,
  XrpSignRequest,
} from './chain';
