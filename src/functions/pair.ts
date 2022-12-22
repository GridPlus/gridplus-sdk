import {
  decryptEncryptedLatticeResponseData,
  deserializeResponseMsgPayloadData,
  serializeSecureRequestMsg,
  serializeSecureRequestEncryptedPayloadData,
  LatticeSecureEncryptedRequestType,
  LatticeSecureMsgType,
} from '../protocol';
import { request } from '../shared/functions';
import { getPubKeyBytes } from '../shared/utilities';
import { validateConnectedClient } from '../shared/validators';
import { 
  generateAppSecret, 
  toPaddedDER, 
  randomBytes 
} from '../util';

/**
 * If a pairing secret is provided, `pair` uses it to sign a hash of the public key, name, and
 * pairing secret. It then sends the name and signature to the device. If no pairing secret is
 * provided, `pair` sends a zero-length name buffer to the device.
 * @category Lattice
 * @returns The active wallet object.
 */
export async function pair (req: PairRequestParams) {
  // Validate request params
  validateConnectedClient(req.client);
  // Build data for this request
  const data = encodePairRequest(
    req.client.key, 
    req.pairingSecret, 
    req.client.name
  );
  // Build the secure message request
  const msgId = randomBytes(4);
  const payloadData = serializeSecureRequestEncryptedPayloadData(
    req.client,
    data,
    LatticeSecureEncryptedRequestType.finalizePairing
  );
  const msg = serializeSecureRequestMsg(
    req.client,
    msgId,
    LatticeSecureMsgType.encrypted,
    payloadData
  );
  // Send request to Lattice
  const resp = await request({ 
    url: req.client.url, 
    payload: msg 
  });
  // Deserialize the response payload data
  const encRespPayloadData = deserializeResponseMsgPayloadData(
    req.client,
    msgId,
    resp
  );
  // Decrypt response. It has no data to capture for this request.
  decryptEncryptedLatticeResponseData(
    req.client, 
    encRespPayloadData
  );
  // Update client state, sync wallet, and return success if there is a wallet
  req.client.isPaired = true;
  await req.client.fetchActiveWallet();
  return req.client.hasActiveWallet();
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