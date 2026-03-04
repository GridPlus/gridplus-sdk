import type { DeviceContext, SigningComponentKind } from '@gridplus/chain-core';
import { CURRENCIES } from '@gridplus/types';
import { getClient, queue } from '../api/utilities';
import { EXTERNAL } from '../constants';
import { fetchDecoder } from '../functions/fetchDecoder';
import {
  ensureSigningComponentsSeeded,
  getSigningComponentRegistry,
} from './signingComponents';

export type SdkDeviceContext = DeviceContext & {
  constants: {
    EXTERNAL: typeof EXTERNAL;
    CURRENCIES: typeof CURRENCIES;
  };
  services: {
    fetchDecoder: typeof fetchDecoder;
  };
  resolveSigningComponent: (kind: SigningComponentKind, name: string) => number;
};

// Bridges SDK runtime signing components into the generic chain-core DeviceContext shape.
export const createDeviceContext = (): SdkDeviceContext => ({
  queue,
  getClient,
  constants: {
    EXTERNAL,
    CURRENCIES,
  },
  services: {
    fetchDecoder,
  },
  resolveSigningComponent: (kind, name) => {
    ensureSigningComponentsSeeded();
    return getSigningComponentRegistry().resolveOrThrow(kind, name);
  },
});
