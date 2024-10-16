import { UInt4 } from 'bitwise/types';
import { Client } from '../client';
import { ASCII_REGEX, EMPTY_WALLET_UID, MAX_ADDR } from '../constants';
import { isUInt4 } from '../util';
import isEmpty from 'lodash/isEmpty';
import {
  FirmwareConstants,
  FirmwareVersion,
  LatticeError,
  Wallet,
  KeyPair,
  ActiveWallets,
  KVRecords,
} from '../types';

export const validateIsUInt4 = (n?: number) => {
  if (typeof n !== 'number' || !isUInt4(n)) {
    throw new Error('Must be an integer between 0 and 15 inclusive');
  }
  return n as UInt4;
};

export const validateNAddresses = (n?: number) => {
  if (!n) {
    throw new Error('The number of addresses is required.');
  }
  if (n > MAX_ADDR) {
    throw new Error(`You may only request ${MAX_ADDR} addresses at once.`);
  }
  return n;
};

export const validateStartPath = (startPath?: number[]) => {
  if (!startPath) {
    throw new Error('Start path is required');
  }
  if (startPath.length < 1 || startPath.length > 5)
    throw new Error('Path must include between 1 and 5 indices');

  return startPath;
};

export const validateDeviceId = (deviceId?: string) => {
  if (!deviceId) {
    throw new Error(
      'No device ID has been stored. Please connect with your device ID first.',
    );
  }
  return deviceId;
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

export const validateUrl = (url?: string) => {
  if (!url) {
    throw new Error('URL does not exist. Please reconnect.');
  }
  try {
    new URL(url);
  } catch (err) {
    throw new Error('Invalid URL provided. Please use a valid URL.');
  }
  return url;
};

export const validateBaseUrl = (baseUrl?: string) => {
  if (!baseUrl) {
    throw new Error('Base URL is required.');
  }
  try {
    new URL(baseUrl);
  } catch (err) {
    throw new Error('Invalid Base URL provided. Please use a valid URL.');
  }
  return baseUrl;
};

export const validateFwConstants = (fwConstants?: FirmwareConstants) => {
  if (!fwConstants) {
    throw new Error('Firmware constants do not exist. Please reconnect.');
  }
  return fwConstants;
};

export const validateFwVersion = (fwVersion?: FirmwareVersion) => {
  if (!fwVersion) {
    throw new Error('Firmware version does not exist. Please reconnect.');
  }
  if (
    typeof fwVersion.fix !== 'number' ||
    typeof fwVersion.minor !== 'number' ||
    typeof fwVersion.major !== 'number'
  ) {
    throw new Error('Firmware version improperly formatted. Please reconnect.');
  }
  return fwVersion;
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

export const validateWallet = (wallet?: Wallet) => {
  if (!wallet || wallet === null) {
    throw new Error('No active wallet.');
  }
  return wallet;
};

export const validateConnectedClient = (client: Client) => {
  const appName = validateAppName(client.getAppName());
  const ephemeralPub = validateEphemeralPub(client.ephemeralPub);
  const sharedSecret = validateSharedSecret(client.sharedSecret);
  const url = validateUrl(client.url);
  const fwConstants = validateFwConstants(client.getFwConstants());
  const fwVersion = validateFwVersion(client.getFwVersion());
  // @ts-expect-error - Key is private
  const key = validateKey(client.key);

  return {
    appName,
    ephemeralPub,
    sharedSecret,
    url,
    fwConstants,
    fwVersion,
    key,
  };
};

export const validateEphemeralPub = (ephemeralPub?:  KeyPair) => {
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
