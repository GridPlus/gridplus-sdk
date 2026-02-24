import type { DeviceContext } from '@gridplus/chain-core';
import { CURRENCIES } from '@gridplus/types';
import { getClient, queue } from '../api/utilities';
import { EXTERNAL } from '../constants';
import { fetchDecoder } from '../functions/fetchDecoder';

export type SdkDeviceContext = DeviceContext & {
  constants: {
    EXTERNAL: typeof EXTERNAL;
    CURRENCIES: typeof CURRENCIES;
  };
  services: {
    fetchDecoder: typeof fetchDecoder;
  };
};

// Bridges SDK runtime primitives into the generic chain-core DeviceContext shape.
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
});
