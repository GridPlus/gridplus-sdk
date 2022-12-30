import {
  encryptedSecureRequest,
  LatticeSecureEncryptedRequestType,
} from '../protocol';
import { getPubKeyBytes } from '../shared/utilities';
import { validateConnectedClient } from '../shared/validators';
import { 
  generateAppSecret, 
  toPaddedDER, 
} from '../util';

/**
 * If a pairing secret is provided, `pair` uses it to sign a hash of the public key, name, and
 * pairing secret. It then sends the name and signature to the device. If no pairing secret is
 * provided, `pair` sends a zero-length name buffer to the device.
 * @category Lattice
 * @returns The active wallet object.
 */
export async function pair (req: PairRequestParams) {
  // Validate reequest params
  validatePairRequest(req);
  // Build data for this request
  const data = encodePairRequest(req);
  // Make the request. There is no response data to consume.
  await encryptedSecureRequest(
    req.client,
    data,
    LatticeSecureEncryptedRequestType.finalizePairing
  );
  // Update client state, sync wallet, and return success if there is a wallet
  req.client.isPaired = true;
  await req.client.fetchActiveWallet();
  return req.client.hasActiveWallet();
}

export const validatePairRequest = (
  req: PairRequestParams
) => {
  validateConnectedClient(req.client);
}

export const encodePairRequest = (
  req: PairRequestParams
) => {
  // Build the payload data
  const pubKeyBytes = getPubKeyBytes(req.client.key);
  const nameBuf = Buffer.alloc(25);
  if (req.pairingSecret.length > 0) {
    // If a pairing secret of zero length is passed in, it usually indicates we want to cancel
    // the pairing attempt. In this case we pass a zero-length name buffer so the firmware can
    // know not to draw the error screen. Note that we still expect an error to come back
    // (RESP_ERR_PAIR_FAIL)
    nameBuf.write(req.client.pairingName);
  }
  const hash = generateAppSecret(
    pubKeyBytes,
    nameBuf,
    Buffer.from(req.pairingSecret),
  );
  const sig = req.client.key.sign(hash); // returns an array, not a buffer
  const derSig = toPaddedDER(sig);
  const payload = Buffer.concat([nameBuf, derSig]);
  return payload;
};