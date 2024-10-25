// Re-export everything from client.ts
export * from './client';

// Re-export everything from addKvRecords.ts
export * from './addKvRecords';

// Re-export everything from connect.ts
export * from './connect';

// Re-export everything from fetchActiveWallet.ts
export * from './fetchActiveWallet';

// Re-export everything from fetchEncData.ts
export * from './fetchEncData';

// Re-export everything from firmware.ts
export * from './firmware';

// Re-export everything from getAddresses.ts
export * from './getAddresses';

// Re-export everything from getKvRecords.ts
export * from './getKvRecords';

// Re-export everything from messages.ts
export * from './messages';

// Re-export everything from pair.ts
export * from './pair';

// Re-export everything from removeKvRecords.ts
export * from './removeKvRecords';

// Re-export everything from secureMessages.ts
export * from './secureMessages';

// Re-export everything from shared.ts
export * from './shared';

// Re-export everything from sign.ts
export * from './sign';

// Re-export everything from utils.ts
export * from './utils';

// We don't need to export from vitest.d.ts as it's a declaration file for Vitest

// Exports from client.ts
export type {
  Currency,
  SigningPath,
  SignData,
  SigningRequestResponse,
  TransactionPayload,
  Wallet,
  ActiveWallets,
  RequestParams,
  ClientStateData,
} from './client';

// Exports from addKvRecords.ts
export type {
  AddKvRecordsRequestParams,
  AddKvRecordsRequestFunctionParams,
} from './addKvRecords';

// Exports from fetchEncData.ts
export type {
  EIP2335KeyExportReq,
  FetchEncDataRequest,
  FetchEncDataRequestFunctionParams,
  EIP2335KeyExportData,
} from './fetchEncData';

// Exports from getKvRecords.ts
export type {
  GetKvRecordsRequestParams,
  GetKvRecordsRequestFunctionParams,
  AddressTag,
  GetKvRecordsData,
} from './getKvRecords';

// Exports from removeKvRecords.ts
export type {
  RemoveKvRecordsRequestParams,
  RemoveKvRecordsRequestFunctionParams,
} from './removeKvRecords';

// Exports from shared.ts
export type {
  KVRecords,
  EncrypterParams,
  Signature,
  KeyPair,
  WalletPath,
  DecryptedResponse,
} from './shared';

// Note: We don't export from vitest.d.ts as it's a declaration file for Vitest

// Note: fetchEncData.d.ts, utils.d.ts, and addKvRecords.d.ts are declaration files,
// so we don't need to export from them directly. Their types should be available
// through their respective .ts files.
