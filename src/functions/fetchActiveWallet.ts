import { EMPTY_WALLET_UID } from '../constants';
import {
  decryptEncryptedLatticeResponseData,
  deserializeResponseMsgPayloadData,
  serializeSecureRequestMsg,
  serializeSecureRequestEncryptedPayloadData,
  LatticeSecureEncryptedRequestType,
  LatticeSecureMsgType,
} from '../protocol';
import { request } from '../shared/functions';
import {
  validateActiveWallets,
  validateConnectedClient,
} from '../shared/validators';
import { randomBytes } from '../util';

/**
 * Fetch the active wallet in the device. 
 *
 * The Lattice has two wallet interfaces: internal and external. If a SafeCard is inserted and
 * unlocked, the external interface is considered "active" and this will return its {@link Wallet}
 * data. Otherwise it will return the info for the internal Lattice wallet.
 */
export async function fetchActiveWallet (
  req: FetchActiveWalletRequestFunctionParams
): Promise<ActiveWallets> {
  // Validate request params
  validateFetchActiveWallet(req);
  // Build the secure request message
  const msgId = randomBytes(4);
  const payloadData = serializeSecureRequestEncryptedPayloadData(
    req.client,
    Buffer.alloc(0), // empty request data
    LatticeSecureEncryptedRequestType.getWallets
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
  // Decrypt data and update active wallets before returning
  const decRespPayloadData = decryptEncryptedLatticeResponseData(
    req.client, 
    encRespPayloadData
  );
  const activeWallets = decodeFetchActiveWalletResponse(
    decRespPayloadData
  );
  const validActiveWallets = validateActiveWallets(activeWallets);
  req.client.activeWallets = validActiveWallets;
  return validActiveWallets;
}

export const validateFetchActiveWallet = (
  req: FetchActiveWalletRequestFunctionParams
) => {
  validateConnectedClient(req.client);
};

export const decodeFetchActiveWalletResponse = (data: Buffer) => {
  // Skip 65byte pubkey prefix. WalletDescriptor contains 32byte id + 4byte flag + 35byte name
  const walletData = data.slice(65);
  // Read the external wallet data first. If it is non-null, the external wallet will be the
  // active wallet of the device and we should save it. If the external wallet is blank, it means
  // there is no card present and we should save and use the interal wallet. If both wallets are
  // empty, it means the device still needs to be set up.
  const walletDescriptorLen = 71;
  // Internal first
  const activeWallets: ActiveWallets = {
    internal: {
      uid: EMPTY_WALLET_UID,
      external: false,
      name: Buffer.alloc(0),
      capabilities: 0,
    },
    external: {
      uid: EMPTY_WALLET_UID,
      external: true,
      name: Buffer.alloc(0),
      capabilities: 0,
    },
  };
  let off = 0;
  activeWallets.internal.uid = walletData.slice(off, off + 32);
  activeWallets.internal.capabilities = walletData.readUInt32BE(off + 32);
  activeWallets.internal.name = walletData.slice(
    off + 36,
    off + walletDescriptorLen,
  );
  // Offset the first item
  off += walletDescriptorLen;
  // External
  activeWallets.external.uid = walletData.slice(off, off + 32);
  activeWallets.external.capabilities = walletData.readUInt32BE(off + 32);
  activeWallets.external.name = walletData.slice(
    off + 36,
    off + walletDescriptorLen,
  );
  return activeWallets;
};
