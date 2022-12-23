import { messageConstants } from '../constants';
import { doesFetchWalletsOnLoad } from '../shared/predicates';
import { 
  connectSecureRequest
} from '../protocol';
import {
  getSharedSecret,
  parseWallets,
} from '../shared/utilities';
import {
  validateBaseUrl,
  validateDeviceId,
  validateKey,
} from '../shared/validators';
import { 
  aes256_decrypt, 
  getP256KeyPairFromPub, 
} from '../util';

export async function connect (
  req: ConnectRequestFunctionParams
): Promise<boolean> {
  // Validate request params
  validateConnectRequest(req);
  // Try the connection
  const respPayloadData = await connectSecureRequest(req.client, req.id);
  // Decode response data params. 
  // Response payload data is *not* encrypted.
  const { isPaired, fwVersion, activeWallets, ephemeralPub } =
    await decodeConnectResponsePayloadData(
      respPayloadData, 
      req.client.key
    );
  // Update client state with response data
  req.client.deviceId = req.id;
  req.client.ephemeralPub = ephemeralPub;
  req.client.url = `${req.client.baseUrl}/${req.id}`;
  req.client.isPaired = isPaired;
  req.client.fwVersion = fwVersion;
  if (activeWallets) {
    req.client.activeWallets = activeWallets;
  }
  // If we are paired and are on older firmware (<0.14.1), we need a 
  // follow up request to sync wallet state.
  if (isPaired && !doesFetchWalletsOnLoad(req.client.getFwVersion())) {
    await req.client.fetchActiveWallet();
  }
  // Return flag indicating whether we are paired or not.
  // If we are *not* already paired, the Lattice is now in
  // pairing mode and expects a `finalizePairing` encrypted
  // request as a follow up.
  return isPaired;
}

// Validate request params
export const validateConnectRequest = (
  req: ConnectRequestFunctionParams
) => {
  validateDeviceId(req.id);
  validateKey(req.client.key);
  validateBaseUrl(req.client.baseUrl);
};

/**
 * `decodeConnectResponse` will call `StartPairingMode` on the device, which gives the user 60 seconds to
 * finalize the pairing. This will return an ephemeral public key, which is needed for the next
 * request.
 * - If the device is already paired, this ephemPub is simply used to encrypt the next request.
 * - If the device is not paired, it is needed to pair the device within 60 seconds.
 * @category Device Response
 * @internal
 * @returns true if we are paired to the device already
 */
export const decodeConnectResponsePayloadData = (
  response: Buffer,
  key: KeyPair,
): {
  isPaired: boolean;
  fwVersion: Buffer;
  activeWallets: ActiveWallets | undefined;
  ephemeralPub: Buffer;
} => {
  let off = 0;
  const isPaired = response.readUInt8(off) === messageConstants.PAIRED;
  off++;
  // If we are already paired, we get the next ephemeral key
  const pub = response.slice(off, off + 65).toString('hex');
  off += 65; // Set the public key
  const ephemeralPub = getP256KeyPairFromPub(pub);
  // Grab the firmware version (will be 0-length for older fw versions) It is of format
  // |fix|minor|major|reserved|
  const fwVersion = response.slice(off, off + 4);
  off += 4;

  // If we are already paired, the response will include some encrypted data about the current
  // wallets This data was added in Lattice firmware v0.14.1
  if (isPaired) {
    //TODO && this._fwVersionGTE(0, 14, 1)) {
    // Later versions of firmware added wallet info
    const encWalletData = response.slice(off, off + 160);
    off += 160;
    const sharedSecret = getSharedSecret(key, ephemeralPub);
    const decWalletData = aes256_decrypt(encWalletData, sharedSecret);
    // Sanity check to make sure the last part of the decrypted data is empty. The last 2 bytes
    // are AES padding
    if (
      decWalletData[decWalletData.length - 2] !== 0 ||
      decWalletData[decWalletData.length - 1] !== 0
    ) {
      throw new Error('Failed to connect to Lattice.');
    }
    const activeWallets = parseWallets(decWalletData);
    return { isPaired, fwVersion, activeWallets, ephemeralPub };
  }
  // return the state of our pairing
  return { isPaired, fwVersion, activeWallets: undefined, ephemeralPub };
};
