import { decResLengths, EMPTY_WALLET_UID } from '../constants';
import {
  decryptResponse,
  encryptRequest,
  request,
} from '../shared/functions';
import {
  validateActiveWallets,
  validateSharedSecret,
  validateUrl,
} from '../shared/validators';

/**
 * Fetch the active wallet in the device. 
 *
 * The Lattice has two wallet interfaces: internal and external. If a SafeCard is inserted and
 * unlocked, the external interface is considered "active" and this will return its {@link Wallet}
 * data. Otherwise it will return the info for the internal Lattice wallet.
 */
export async function fetchActiveWallet ({
  client,
}: FetchActiveWalletRequestFunctionParams): Promise<ActiveWallets> {
  const { url, sharedSecret } = validateFetchActiveWallet({
    url: client.url,
    sharedSecret: client.sharedSecret,
  });

  const payload = encryptFetchActiveWalletRequest({ sharedSecret });

  const encryptedResponse = await requestFetchActiveWallet(payload, url).catch(
    (err) => {
      client.resetActiveWallets();
      throw err;
    },
  );

  const { decryptedData, newEphemeralPub } = decryptFetchActiveWalletResponse(
    encryptedResponse,
    sharedSecret,
  );

  const activeWallets = decodeFetchActiveWalletResponse(decryptedData);

  const validActiveWallets = validateActiveWallets(activeWallets);

  client.activeWallets = validActiveWallets;
  client.ephemeralPub = newEphemeralPub;

  return validActiveWallets;
}

export const validateFetchActiveWallet = ({
  url,
  sharedSecret,
}: ValidateFetchActiveWalletRequestParams) => {
  const validUrl = validateUrl(url);
  const validSharedSecret = validateSharedSecret(sharedSecret);

  return {
    url: validUrl,
    sharedSecret: validSharedSecret,
  };
};

export const encryptFetchActiveWalletRequest = ({
  sharedSecret,
}: ValidatedFetchActiveWalletRequest) => {
  return encryptRequest({
    requestCode: 'GET_WALLETS',
    payload: Buffer.alloc(0),
    sharedSecret,
  });
};

export const requestFetchActiveWallet = async (
  payload: Buffer,
  url: string,
) => {
  return request({ payload, url });
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

export const decryptFetchActiveWalletResponse = (
  response: Buffer,
  sharedSecret: Buffer,
) => {
  const { decryptedData, newEphemeralPub } = decryptResponse(
    response,
    decResLengths.getWallets,
    sharedSecret,
  );
  return { decryptedData, newEphemeralPub };
};
