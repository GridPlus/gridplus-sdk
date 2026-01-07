import { LatticeResponseCode } from '../protocol';
import { FirmwareVersion, FirmwareConstants } from '../types';
import { isFWSupported } from './utilities';

export const isDeviceBusy = (responseCode: number) =>
  responseCode === LatticeResponseCode.deviceBusy ||
  responseCode === LatticeResponseCode.gceTimeout;

export const isWrongWallet = (responseCode: number) =>
  responseCode === LatticeResponseCode.wrongWallet;

export const isInvalidEphemeralId = (responseCode: number) =>
  responseCode === LatticeResponseCode.invalidEphemId;

export const doesFetchWalletsOnLoad = (fwVersion: FirmwareVersion) =>
  isFWSupported(fwVersion, { major: 0, minor: 14, fix: 1 });

export const shouldUseEVMLegacyConverter = (fwConstants: FirmwareConstants) =>
  fwConstants.genericSigning &&
  fwConstants.genericSigning.encodingTypes &&
  fwConstants.genericSigning.encodingTypes.EVM;
