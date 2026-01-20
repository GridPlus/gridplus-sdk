import type {
  WalletSummary,
  WalletSnapshot,
  WalletUtxo,
  BtcPurpose,
  ScriptType,
} from './types';
import type { BtcProvider, BlockbookUtxo } from './provider/types';
import { inferPurpose } from './slip132';
import { HARDENED_OFFSET } from './constants';

/**
 * Safely parse a string to an integer, throwing a descriptive error if invalid.
 *
 * @param value - The string value to parse
 * @param fieldName - The name of the field for error messages
 * @returns The parsed integer
 * @throws Error if the value cannot be parsed to a valid integer
 */
function safeParseInt(value: string, fieldName: string): number {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(
      `Invalid ${fieldName}: expected numeric string but received "${value}"`,
    );
  }
  return parsed;
}

export interface WalletOptions {
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
      const indexStr = part.replace(/['h]/g, '');
      const index = safeParseInt(indexStr, `path component "${part}"`);
      return isHardened ? index + HARDENED_OFFSET : index;
    });
}

/**
 * Determine script type from purpose.
 */
function getScriptType(purpose: BtcPurpose): ScriptType {
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
    value: safeParseInt(utxo.value, 'utxo.value'),
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
export async function getSummary(
  options: WalletOptions,
): Promise<WalletSummary> {
  const { xpub, provider } = options;

  const blockbookSummary = await provider.getSummary(xpub);
  const utxos = await provider.getUtxos(xpub);

  return {
    balance: safeParseInt(blockbookSummary.balance, 'balance'),
    unconfirmedBalance: safeParseInt(
      blockbookSummary.unconfirmedBalance,
      'unconfirmedBalance',
    ),
    totalReceived: safeParseInt(
      blockbookSummary.totalReceived,
      'totalReceived',
    ),
    totalSent: safeParseInt(blockbookSummary.totalSent, 'totalSent'),
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
      const indexPart = parts[parts.length - 1];
      const index = safeParseInt(
        indexPart,
        `address index in path "${token.path}"`,
      );

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
    balance: safeParseInt(blockbookSummary.balance, 'balance'),
    unconfirmedBalance: safeParseInt(
      blockbookSummary.unconfirmedBalance,
      'unconfirmedBalance',
    ),
    totalReceived: safeParseInt(
      blockbookSummary.totalReceived,
      'totalReceived',
    ),
    totalSent: safeParseInt(blockbookSummary.totalSent, 'totalSent'),
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
