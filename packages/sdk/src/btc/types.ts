import type { PreviousOutput } from '../types/sign';

export type BtcPurpose = 44 | 49 | 84;
export type BtcCoinType = 0 | 1;
export type BtcNetwork = 'mainnet' | 'testnet' | 'regtest';
export type XpubPrefix = 'xpub' | 'ypub' | 'zpub' | 'tpub' | 'upub' | 'vpub';

export interface XpubOptions {
  purpose: BtcPurpose;
  coinType?: BtcCoinType;
  account?: number;
}

export interface XpubsOptions {
  purposes: BtcPurpose[];
  coinType?: BtcCoinType;
  account?: number;
}

/** Wallet UTXO with derivation info */
export interface WalletUtxo {
  txid: string;
  vout: number;
  value: number; // satoshis
  confirmations: number;
  address: string;
  path: number[]; // derivation path
  scriptType: 'p2pkh' | 'p2sh-p2wpkh' | 'p2wpkh';
}

/** Wallet summary */
export interface WalletSummary {
  balance: number; // satoshis
  unconfirmedBalance: number; // satoshis
  totalReceived: number; // satoshis
  totalSent: number; // satoshis
  txCount: number;
  utxoCount: number;
}

/** Full wallet snapshot for transaction building */
export interface WalletSnapshot {
  summary: WalletSummary;
  utxos: WalletUtxo[];
  addresses: {
    receiving: string[];
    change: string[];
  };
  nextReceiveIndex: number;
  nextChangeIndex: number;
}

/** Input for transaction building */
export interface TxBuildInput {
  utxos: WalletUtxo[];
  recipient: string;
  value: number; // satoshis to send
  feeRate: number; // sats/vbyte
  purpose: BtcPurpose;
  coinType?: BtcCoinType;
  changeIndex: number; // index for change address
}

/** Result of transaction building */
export interface TxBuildResult {
  prevOuts: PreviousOutput[];
  recipient: string;
  value: number;
  fee: number;
  changePath: number[];
  changeValue: number;
  totalInput: number;
}
