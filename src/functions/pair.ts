import {
  LatticeSecureEncryptedRequestType,
  encryptedSecureRequest,
} from '../protocol';
import { getPubKeyBytes } from '../shared/utilities';
import { validateConnectedClient } from '../shared/validators';
import { generateAppSecret, toPaddedDER } from '../util';

/**
 * If a pairing secret is provided, `pair` uses it to sign a hash of the public key, name, and
 * pairing secret. It then sends the name and signature to the device. If no pairing secret is
 * provided, `pair` sends a zero-length name buffer to the device.
 * @category Lattice
 * @returns The active wallet object.
 */
export async function pair({
  client,
  pairingSecret,
}: PairRequestParams): Promise<boolean> {
  const { url, sharedSecret, ephemeralPub, appName, key } =
    validateConnectedClient(client);
  const data = encodePairRequest({ pairingSecret, key, appName });

  const { newEphemeralPub } = await encryptedSecureRequest({
    data,
    requestType: LatticeSecureEncryptedRequestType.finalizePairing,
    sharedSecret,
    ephemeralPub,
    url,
  });

  client.mutate({
    ephemeralPub: newEphemeralPub,
    isPaired: true,
  });

  await client.fetchActiveWallet();
  return client.hasActiveWallet();
}

export const encodePairRequest = ({
  key,
  pairingSecret,
  appName,
}: {
  key: KeyPair;
  pairingSecret: string;
  appName: string;
}) => {
  // Build the payload data
  const pubKeyBytes = getPubKeyBytes(key);
  const nameBuf = Buffer.alloc(25);
  if (pairingSecret.length > 0) {
    // If a pairing secret of zero length is passed in, it usually indicates we want to cancel
    // the pairing attempt. In this case we pass a zero-length name buffer so the firmware can
    // know not to draw the error screen. Note that we still expect an error to come back
    // (RESP_ERR_PAIR_FAIL)
    nameBuf.write(appName);
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
