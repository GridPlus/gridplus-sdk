import { validateConnectedClient } from '../shared/validators';

import { getClient } from '../api';
import type { TransactionRequest } from '../types';
import { fetchCalldataDecoder } from '../util';

/**
 * `fetchDecoder` fetches the ABI for a given contract address and chain ID.
 * @category Lattice
 * @returns An object containing the ABI and encoded definition of the contract.
 */
export async function fetchDecoder({ data, to, chainId }: TransactionRequest): Promise<Buffer | undefined> {
  try {
    const client = await getClient();
    validateConnectedClient(client);

    const fwVersion = client.getFwVersion();
    const supportsDecoderRecursion = fwVersion.major > 0 || fwVersion.minor >= 16;

    const { def } = await fetchCalldataDecoder(data, to, chainId, supportsDecoderRecursion);

    return def;
  } catch (error) {
    console.warn('Failed to fetch ABI:', error);
    return undefined;
  }
}
