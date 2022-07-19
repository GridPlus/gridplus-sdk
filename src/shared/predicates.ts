
import { responseCodes } from '../constants';
import { isFWSupported } from './utilities';

export const isDeviceBusy = (responseCode: number) =>
  responseCode === responseCodes.RESP_ERR_DEV_BUSY ||
  responseCode === responseCodes.RESP_ERR_GCE_TIMEOUT;

export const isWrongWallet = (responseCode: number) =>
  responseCode === responseCodes.RESP_ERR_WRONG_WALLET;

export const isInvalidEphemeralId = (responseCode: number) =>
  responseCode === responseCodes.RESP_ERR_INVALID_EPHEM_ID;

export const doesFetchWalletsOnLoad = (fwVersion: FirmwareVersion) =>
  isFWSupported(fwVersion, { major: 0, minor: 14, fix: 1 });

export const shouldUseEVMLegacyConverter = (fwConstants: FirmwareConstants) =>
  fwConstants.genericSigning &&
  fwConstants.genericSigning.encodingTypes &&
  fwConstants.genericSigning.encodingTypes.EVM;
