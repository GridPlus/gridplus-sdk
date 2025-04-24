import { type Transport, type EIP1193RequestFn } from 'viem';
import { type ClientStateData } from '../../types/client';

export interface GridPlusTransportConfig {
  clientState: ClientStateData;
  retryCount?: number;
  retryDelay?: number;
  timeout?: number;
}

export function createGridPlusTransport({
  clientState,
  retryCount = 3,
  retryDelay = 150,
  timeout = 10000,
}: GridPlusTransportConfig): Transport {
  const makeRequest: EIP1193RequestFn = async ({ method, params }) => {
    const requestParams = {
      method,
      params,
      url: clientState.baseUrl,
      timeout,
      retries: retryCount,
    };

    return makeRequest(requestParams, retryDelay);
  };

  return {
    request: makeRequest,
    type: 'gridplus',
  };
}

async function makeRequest(
  params: {
    url: string;
    payload: { method: string; params: unknown[] };
    timeout: number;
    retries: number;
  },
  retryDelay: number,
): Promise<RpcResponse> {
  let lastError: Error | undefined;

  for (let i = 0; i <= params.retries; i++) {
    try {
      const response = await fetch(params.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params.payload),
        signal: AbortSignal.timeout(params.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message || 'Unknown error');
      }

      return data.result;
    } catch (error) {
      lastError = error as Error;
      if (i < params.retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * Math.pow(2, i)),
        );
      }
    }
  }

  throw lastError || new Error('Request failed');
}
