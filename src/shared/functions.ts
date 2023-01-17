import { sha256 } from 'hash.js/lib/hash/sha';
import { Client } from '..';
import bitcoin from '../bitcoin';
import { EXTERNAL } from '../constants';
import ethereum from '../ethereum';
import { buildGenericSigningMsgRequest } from '../genericSigning';
import { fetchWithTimeout, parseLattice1Response } from '../util';
import { LatticeResponseError } from './errors';
import {
  isDeviceBusy,
  isInvalidEphemeralId,
  isWrongWallet,
  shouldUseEVMLegacyConverter,
} from './predicates';
import { validateRequestError } from './validators';

export const buildTransaction = ({
  data,
  currency,
  fwConstants,
}: {
  data: any;
  currency?: Currency;
  fwConstants: FirmwareConstants;
}) => {
  // All transaction requests must be put into the same sized buffer. This comes from
  // sizeof(GpTransactionRequest_t), but note we remove the 2-byte schemaId since it is not
  // returned from our resolver. Note that different firmware versions may have different data
  // sizes.

  // TEMPORARY BRIDGE -- DEPRECATE ME In v0.15.0 Lattice firmware removed the legacy ETH
  // signing path, so we need to convert such requests to general signing requests using the
  // EVM decoder. NOTE: Not every request can be converted, so users should switch to using
  // general signing requests for newer firmware versions. EIP1559 and EIP155 legacy
  // requests will convert, but others may not.
  if (currency === 'ETH' && shouldUseEVMLegacyConverter(fwConstants)) {
    console.log(
      'Using the legacy ETH signing path. This will soon be deprecated. ' +
        'Please switch to general signing request.',
    );
    let payload;
    try {
      payload = ethereum.ethConvertLegacyToGenericReq(data);
    } catch (err) {
      throw new Error(
        'Could not convert legacy request. Please switch to a general signing ' +
          'request. See gridplus-sdk docs for more information.',
      );
    }
    data = {
      fwConstants,
      encodingType: EXTERNAL.SIGNING.ENCODINGS.EVM,
      curveType: EXTERNAL.SIGNING.CURVES.SECP256K1,
      hashType: EXTERNAL.SIGNING.HASHES.KECCAK256,
      signerPath: data.signerPath,
      payload,
    };
    return {
      requestData: buildGenericSigningMsgRequest({ ...data, fwConstants }),
      isGeneric: true,
    };
  } else if (currency === 'ETH') {
    // Legacy signing pathway -- should deprecate in the future
    return {
      requestData: ethereum.buildEthereumTxRequest({ ...data, fwConstants }),
      isGeneric: false,
    };
  } else if (currency === 'ETH_MSG') {
    return {
      requestData: ethereum.buildEthereumMsgRequest({ ...data, fwConstants }),
      isGeneric: false,
    };
  } else if (currency === 'BTC') {
    return {
      requestData: bitcoin.buildBitcoinTxRequest({ ...data, fwConstants }),
      isGeneric: false,
    };
  }
  return {
    requestData: buildGenericSigningMsgRequest({ ...data, fwConstants }),
    isGeneric: true,
  };
};

export const request = async ({
  url,
  payload,
  timeout = 60000,
}: RequestParams) => {
  return fetchWithTimeout(url, {
    method: 'POST',
    body: JSON.stringify({ data: payload }),
    headers: {
      'Content-Type': 'application/json',
    },
    timeout,
  })
    .catch(validateRequestError)
    .then((res) => res.json())
    .then((body) => {
      // Handle formatting or generic HTTP errors
      if (!body || !body.message) {
        throw new Error('Invalid response');
      } else if (body.status !== 200) {
        throw new Error(`Error code ${body.status}: ${body.message}`);
      }

      const { data, errorMessage, responseCode } = parseLattice1Response(
        body.message,
      );

      if (errorMessage || responseCode) {
        throw new LatticeResponseError(responseCode, errorMessage);
      }

      return data;
    });
};

/**
 * `sleep()` returns a Promise that resolves after a given number of milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Takes a function and a set of parameters, and returns a function that will retry the original
 * function with the given parameters a number of times
 *
 * @param client - a {@link Client} instance that is passed to the {@link retryWrapper}
 * @param retries - the number of times to retry the function before giving up
 * @returns a {@link retryWrapper} function for handing retry logic
 */
export const buildRetryWrapper = (client: Client, retries: number) => {
  return (fn, params?) =>
    retryWrapper({
      fn,
      params: { ...params, client },
      retries,
      client,
    });
};

/**
 * Retries a function call if the error message or response code is present and the number of
 * retries is greater than 0.
 *
 * @param fn - The function to retry
 * @param params - The parameters to pass to the function
 * @param retries - The number of times to retry the function
 * @param client - The {@link Client} to use for side-effects
 */
export const retryWrapper = async ({ fn, params, retries, client }) => {
  return fn({ ...params }).catch(async (err) => {
    /** `string` returned from the Lattice if there's an error */
    const errorMessage = err.errorMessage;
    /** `number` returned from the Lattice if there's an error */
    const responseCode = err.responseCode;

    if ((errorMessage || responseCode) && retries) {
      if (isDeviceBusy(responseCode)) {
        await sleep(3000);
      } else if (
        isWrongWallet(responseCode) &&
        !client.skipRetryOnWrongWallet
      ) {
        await client.fetchActiveWallet();
      } else if (isInvalidEphemeralId(responseCode)) {
        await client.connect(client.deviceId);
      } else {
        throw err;
      }

      return retryWrapper({
        fn,
        params,
        retries: retries - 1,
        client,
      });
    }

    throw err;
  });
};

/**
 * Get the ephemeral id, which is the first 4 bytes of the shared secret generated from the local
 * private key and the ephemeral public key from the device.
 * @internal
 * @returns Buffer
 */
export const getEphemeralId = (sharedSecret: Buffer) => {
  // EphemId is the first 4 bytes of the hash of the shared secret
  const hash = Buffer.from(sha256().update(sharedSecret).digest('hex'), 'hex');
  return parseInt(hash.slice(0, 4).toString('hex'), 16);
};
