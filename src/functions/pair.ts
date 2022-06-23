import { decResLengths } from '../constants';
import { encryptRequest, decryptResponse, request } from '../shared/functions';
import { getPubKeyBytes } from '../shared/utilities';
import { validateAppName, validateUrl } from '../shared/validators';
import { generateAppSecret, toPaddedDER } from '../util';

/**
 * If a pairing secret is provided, `pair` uses it to sign a hash of the public key, name, and
 * pairing secret. It then sends the name and signature to the device. If no pairing secret is
 * provided, `pair` sends a zero-length name buffer to the device.
 * @category Lattice
 * @returns The active wallet object.
 */
export async function pair ({ pairingSecret, client }: PairRequestParams) {
  //TODO: Add pair validator
  const name = validateAppName(client.name);
  const url = validateUrl(client.url);

  const payload = encodePairRequest(client.key, pairingSecret, name);

  const encryptedPayload = encryptPairRequest({
    payload,
    sharedSecret: client.sharedSecret,
  });
  const encryptedResponse = await requestPair(encryptedPayload, url);

  const { newEphemeralPub } = decryptPairResponse(
    encryptedResponse,
    client.sharedSecret,
  );

  client.isPaired = true
  client.ephemeralPub = newEphemeralPub;

  // Try to get the active wallet once pairing is successful
  await client.fetchActiveWallet();
  return client.hasActiveWallet();
}

export const encodePairRequest = (
  key: KeyPair,
  pairingSecret: string,
  name: string,
) => {
  const pubKeyBytes = getPubKeyBytes(key);
  const nameBuf = Buffer.alloc(25);
  if (pairingSecret.length > 0) {
    // If a pairing secret of zero length is passed in, it usually indicates we want to cancel
    // the pairing attempt. In this case we pass a zero-length name buffer so the firmware can
    // know not to draw the error screen. Note that we still expect an error to come back
    // (RESP_ERR_PAIR_FAIL)
    nameBuf.write(name);
  }
  const hash = generateAppSecret(
    pubKeyBytes,
    nameBuf,
    Buffer.from(pairingSecret),
  );
  const sig = key.sign(hash); // returns an array, not a buffer
  const derSig = toPaddedDER(sig);
  const payload = Buffer.concat([nameBuf, derSig]);
  return payload;
};

export const encryptPairRequest = ({
  payload,
  sharedSecret,
}: EncrypterParams) => {
  return encryptRequest({
    requestCode: 'FINALIZE_PAIRING',
    payload,
    sharedSecret,
  });
};

export const requestPair = async (payload: Buffer, url: string) => {
  return request({ payload, url });
};

/**
 * Pair will create a new pairing if the user successfully enters the secret into the device in
 * time. If successful (`status=0`), the device will return a new ephemeral public key, which is
 * used to derive a shared secret for the next request
 * @category Device Response
 * @internal
 * @returns error (or null)
 */
export const decryptPairResponse = (
  encryptedResponse: any,
  sharedSecret: Buffer,
) => {
  return decryptResponse(encryptedResponse, decResLengths.empty, sharedSecret);
};
