import type {
  WalletSummary,
  WalletSnapshot,
  WalletUtxo,
  BtcPurpose,
} from './types';
import type { BtcProvider, BlockbookUtxo } from './provider/types';
import { inferPurpose } from './slip132';
import { HARDENED_OFFSET } from '../constants';

interface WalletOptions {
  xpub: string;
  purpose?: BtcPurpose;
  provider: BtcProvider;
}

/**
 * Parse a BIP32 path string to array format.
 */
function parsePath(pathStr: string): number[] {
  return pathStr
    .replace('m/', '')
    .split('/')
    .map((part) => {
      const isHardened = part.endsWith("'") || part.endsWith('h');
      const index = parseInt(part.replace(/['h]/g, ''), 10);
      return isHardened ? index + HARDENED_OFFSET : index;
    });
}

/**
 * Determine script type from purpose.
 */
function getScriptType(
  purpose: BtcPurpose,
): 'p2pkh' | 'p2sh-p2wpkh' | 'p2wpkh' {
  switch (purpose) {
    case 44:
      return 'p2pkh';
    case 49:
      return 'p2sh-p2wpkh';
    case 84:
      return 'p2wpkh';
    default:
      throw new Error(`Unknown purpose: ${purpose}`);
  }
}

/**
 * Convert Blockbook UTXO to wallet UTXO with derivation info.
 */
function toWalletUtxo(utxo: BlockbookUtxo, purpose: BtcPurpose): WalletUtxo {
  return {
    txid: utxo.txid,
    vout: utxo.vout,
    value: parseInt(utxo.value, 10),
    confirmations: utxo.confirmations,
    address: utxo.address ?? '',
    path: utxo.path ? parsePath(utxo.path) : [],
    scriptType: getScriptType(purpose),
  };
}

/**
 * Get wallet summary from an xpub.
 *
 * @param options - Wallet options
 * @returns Wallet summary with balance info
 *
 * @example
 * const summary = await getSummary({
 *   xpub: 'zpub...',
 *   provider: createBlockbookProvider(),
 * });
 * console.log(`Balance: ${summary.balance} sats`);
 */
export async function getSummary(options: WalletOptions): Promise<WalletSummary> {
  const { xpub, provider } = options;

  const blockbookSummary = await provider.getSummary(xpub);
  const utxos = await provider.getUtxos(xpub);

  return {
    balance: parseInt(blockbookSummary.balance, 10),
    unconfirmedBalance: parseInt(blockbookSummary.unconfirmedBalance, 10),
    totalReceived: parseInt(blockbookSummary.totalReceived, 10),
    totalSent: parseInt(blockbookSummary.totalSent, 10),
    txCount: blockbookSummary.txs,
    utxoCount: utxos.length,
  };
}

/**
 * Get full wallet snapshot for transaction building.
 *
 * @param options - Wallet options
 * @returns Complete wallet snapshot with UTXOs and address info
 *
 * @example
 * const snapshot = await getSnapshot({
 *   xpub: 'zpub...',
 *   provider: createBlockbookProvider(),
 * });
 * const txReq = buildTxReq({ utxos: snapshot.utxos, ... });
 */
export async function getSnapshot(
  options: WalletOptions,
): Promise<WalletSnapshot> {
  const { xpub, provider } = options;
  const purpose = options.purpose ?? inferPurpose(xpub);

  const [blockbookSummary, blockbookUtxos] = await Promise.all([
    provider.getSummary(xpub),
    provider.getUtxos(xpub),
  ]);

  const utxos = blockbookUtxos.map((utxo) => toWalletUtxo(utxo, purpose));

  const tokens = blockbookSummary.tokens ?? [];
  let nextReceiveIndex = 0;
  let nextChangeIndex = 0;
  const receivingAddresses: string[] = [];
  const changeAddresses: string[] = [];

  for (const token of tokens) {
    if (token.path) {
      const parts = token.path.split('/');
      const isChange = parts[parts.length - 2] === '1';
      const index = parseInt(parts[parts.length - 1], 10);

      if (isChange) {
        changeAddresses.push(token.name);
        nextChangeIndex = Math.max(nextChangeIndex, index + 1);
      } else {
        receivingAddresses.push(token.name);
        nextReceiveIndex = Math.max(nextReceiveIndex, index + 1);
      }
    }
  }

  const summary: WalletSummary = {
    balance: parseInt(blockbookSummary.balance, 10),
    unconfirmedBalance: parseInt(blockbookSummary.unconfirmedBalance, 10),
    totalReceived: parseInt(blockbookSummary.totalReceived, 10),
    totalSent: parseInt(blockbookSummary.totalSent, 10),
    txCount: blockbookSummary.txs,
    utxoCount: utxos.length,
  };

  return {
    summary,
    utxos,
    addresses: {
      receiving: receivingAddresses,
      change: changeAddresses,
    },
    nextReceiveIndex,
    nextChangeIndex,
  };
}
