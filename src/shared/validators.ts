import { UInt4 } from 'bitwise/types';
import { MAX_ADDR, encReqCodes, EMPTY_WALLET_UID, ASCII_REGEX } from '../constants';
import { isUInt4, checksum } from '../util';
import isEmpty from 'lodash/isEmpty'

export const validateValueExists = (arg: { [key: string]: any }) => {
  const [key, [, value]] = Object.entries(arg);
  if (!value) {
    throw new Error(`${key} must be provided`);
  }
};

export const validateIsUInt4 = (n?: number) => {
  if (typeof n !== 'number' || !isUInt4(n)) {
    throw new Error('Must be an integer between 0 and 15 inclusive');
  }
  return n as UInt4;
};

export const validateNAddresses = (n: number) => {
  if (n > MAX_ADDR)
    throw new Error(`You may only request ${MAX_ADDR} addresses at once.`);
};

export const validateStartPath = (startPath: number[]) => {
  if (!startPath) {
    throw new Error('Start path is required');
  }
  if (startPath.length < 2 || startPath.length > 5)
    throw new Error('Path must include between 2 and 5 indices');
};

export const validateDeviceId = (deviceId?: string) => {
  if (!deviceId) {
    throw new Error(
      'No device ID has been stored. Please connect with your device ID first.',
    );
  }
  return deviceId;
};

export const validateEncryptRequestCode = (code: keyof typeof encReqCodes) => {
  if (code && encReqCodes[code] === undefined) {
    throw new Error('Unknown encrypted request code.');
  }
};

export const validateAppName = (name?: string) => {
  if (!name) {
    throw new Error('Name is required.');
  }
  if (name.length < 5 || name.length > 24) {
    throw new Error(
      'Invalid length for name provided. Must be 5-24 characters.',
    );
  }
  return name;
};

export const validateResponse = (res: Buffer) => {
  if (!res) {
    throw new Error('Error decrypting response');
  }
};

export const validateUrl = (url?: string) => {
  if (!url) {
    throw new Error('Url does not exist. Please reconnect.');
  }
  return url;
};

export const validateBaseUrl = (baseUrl?: string) => {
  if (!baseUrl) {
    throw new Error('Base URL is required.');
  }
  return baseUrl;
};

export const validateFwConstants = (fwConstants?: FirmwareConstants) => {
  if (!fwConstants) {
    throw new Error('Firmware constants do not exist. Please reconnect.');
  }
  return fwConstants;
};
export const validateFwVersion = (fwVersion?: Buffer) => {
  if (!fwVersion || fwVersion.byteLength > 4) {
    throw new Error('Firmware version does not exist. Please reconnect.');
  }
  return fwVersion;
};

/**
 * Validate checksum. It will be the last 4 bytes of the decrypted payload. The length of the
 * decrypted payload will be fixed for each given message type.
 */
export const validateChecksum = (res: Buffer, length: number) => {
  const toCheck = res.slice(0, length);
  const cs = parseInt(`0x${res.slice(length, length + 4).toString('hex')}`);
  const csCheck = checksum(toCheck);
  if (cs !== csCheck) {
    throw new Error(
      `Checksum mismatch in response from Lattice (calculated ${csCheck}, wanted ${cs})`,
    );
  }
};

export const validateRequestError = (err: LatticeError) => {
  const isTimeout = err.code === 'ECONNABORTED' && err.errno === 'ETIME';
  if (isTimeout) {
    throw new Error(
      'Timeout waiting for device. Please ensure it is connected to the internet and try again in a minute.',
    );
  }
  throw new Error(`Failed to make request to device:\n${err.message}`);
};

export const validateWallet = (wallet?: Wallet): Wallet => {
  if (!wallet || wallet === null) {
    throw new Error('No active wallet.');
  }
  return wallet;
};

export const validateEphemeralPub = (ephemeralPub?: Buffer) => {
  if (!ephemeralPub) {
    throw new Error(
      '`ephemeralPub` (ephemeral public key) is required. Please reconnect.',
    );
  }
  return ephemeralPub;
};

export const validateSharedSecret = (sharedSecret?: Buffer) => {
  if (!sharedSecret) {
    throw new Error('Shared secret required. Please reconnect.');
  }
  return sharedSecret;
};

export const validateKey = (key?: KeyPair) => {
  if (!key) {
    throw new Error('Key is required. Please reconnect.');
  }
  return key;
};

export const validateActiveWallets = (activeWallets?: ActiveWallets) => {
  if (
    !activeWallets ||
    (activeWallets?.internal?.uid?.equals(EMPTY_WALLET_UID) &&
      activeWallets?.external?.uid?.equals(EMPTY_WALLET_UID))
  ) {
    throw new Error('No active wallet.');
  }
  return activeWallets;
};

export const validateKvRecords = (
  records?: KVRecords,
  fwConstants?: FirmwareConstants,
) => {
  if (!fwConstants || !fwConstants.kvActionsAllowed) {
    throw new Error('Unsupported. Please update firmware.');
  } else if (typeof records !== 'object' || Object.keys(records).length < 1) {
    throw new Error(
      'One or more key-value mapping must be provided in `records` param.',
    );
  } else if (Object.keys(records).length > fwConstants.kvActionMaxNum) {
    throw new Error(
      `Too many keys provided. Please only provide up to ${fwConstants.kvActionMaxNum}.`,
    );
  }
  return records;
};

export const validateKvRecord = (
  { key, val }: KVRecords,
  fwConstants: FirmwareConstants,
) => {
  if (
    typeof key !== 'string' ||
    String(key).length > fwConstants.kvKeyMaxStrSz
  ) {
    throw new Error(
      `Key ${key} too large. Must be <=${fwConstants.kvKeyMaxStrSz} characters.`,
    );
  } else if (
    typeof val !== 'string' ||
    String(val).length > fwConstants.kvValMaxStrSz
  ) {
    throw new Error(
      `Value ${val} too large. Must be <=${fwConstants.kvValMaxStrSz} characters.`,
    );
  } else if (String(key).length === 0 || String(val).length === 0) {
    throw new Error('Keys and values must be >0 characters.');
  } else if (!ASCII_REGEX.test(key) || !ASCII_REGEX.test(val)) {
    throw new Error('Unicode characters are not supported.');
  }
  return { key, val };
};

export const validateRequestLength = (req: any, fwConstants: FirmwareConstants) => {
  if (req.payload.length > fwConstants.reqMaxDataSz) {
    throw new Error('Transaction is too large');
  }
}

export const isValidBlockExplorerResponse = (data: any) => {
  try {
    const result = JSON.parse(data.result);
    return !isEmpty(result);
  } catch (err) {
    return false;
  }
};

export const isValid4ByteResponse = (data: any) => {
  try {
    return !isEmpty(data.results);
  } catch (err) {
    return false;
  }
};
