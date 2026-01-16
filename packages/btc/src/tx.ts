import { HARDENED_OFFSET, BTC_COIN_TYPES } from './constants';
import type {
  TxBuildInput,
  TxBuildResult,
  WalletUtxo,
  BtcPurpose,
  BtcCoinType,
  ScriptType,
} from './types';

const VBYTE_SIZES = {
  P2PKH_INPUT: 148,
  P2SH_P2WPKH_INPUT: 91,
  P2WPKH_INPUT: 68,
  P2PKH_OUTPUT: 34,
  P2SH_OUTPUT: 32,
  P2WPKH_OUTPUT: 31,
  VERSION: 4,
  LOCKTIME: 4,
  SEGWIT_MARKER: 2,
  INPUT_COUNT: 1,
  OUTPUT_COUNT: 1,
} as const;

/**
 * Get output size based on script type.
 */
function getOutputSize(scriptType: ScriptType): number {
  switch (scriptType) {
    case 'p2pkh':
      return VBYTE_SIZES.P2PKH_OUTPUT;
    case 'p2sh-p2wpkh':
      return VBYTE_SIZES.P2SH_OUTPUT;
    case 'p2wpkh':
      return VBYTE_SIZES.P2WPKH_OUTPUT;
  }
}

/**
 * Estimate transaction size in virtual bytes.
 */
function estimateTxVbytes(
  inputCount: number,
  outputCount: number,
  inputType: ScriptType,
): number {
  let inputSize: number;
  switch (inputType) {
    case 'p2pkh':
      inputSize = VBYTE_SIZES.P2PKH_INPUT;
      break;
    case 'p2sh-p2wpkh':
      inputSize = VBYTE_SIZES.P2SH_P2WPKH_INPUT;
      break;
    case 'p2wpkh':
      inputSize = VBYTE_SIZES.P2WPKH_INPUT;
      break;
  }

  const overhead =
    VBYTE_SIZES.VERSION +
    VBYTE_SIZES.LOCKTIME +
    VBYTE_SIZES.INPUT_COUNT +
    VBYTE_SIZES.OUTPUT_COUNT;

  const hasSegwit = inputType !== 'p2pkh';
  const segwitOverhead = hasSegwit ? VBYTE_SIZES.SEGWIT_MARKER : 0;

  const outputSize = getOutputSize(inputType);

  return (
    overhead +
    segwitOverhead +
    inputCount * inputSize +
    outputCount * outputSize
  );
}

/**
 * Select UTXOs for a transaction using simple largest-first strategy.
 */
function selectUtxos(
  utxos: WalletUtxo[],
  targetValue: number,
  feeRate: number,
): { selected: WalletUtxo[]; fee: number } {
  const sorted = [...utxos].sort((a, b) => b.value - a.value);

  const selected: WalletUtxo[] = [];
  let totalValue = 0;

  for (const utxo of sorted) {
    selected.push(utxo);
    totalValue += utxo.value;

    const vbytes = estimateTxVbytes(selected.length, 2, selected[0].scriptType);
    const estimatedFee = Math.ceil(vbytes * feeRate);

    if (totalValue >= targetValue + estimatedFee) {
      return { selected, fee: estimatedFee };
    }
  }

  throw new Error(
    `Insufficient funds: have ${totalValue} sats, need ${targetValue} + fees`,
  );
}

/**
 * Extract account index from a derivation path.
 * Path format: [purpose', coinType', account', change, index]
 */
function extractAccountFromPath(path: number[]): number {
  if (path.length < 3) {
    throw new Error('Invalid derivation path: too short to extract account');
  }
  return path[2];
}

/**
 * Build derivation path for change address.
 */
function buildChangePath(
  purpose: BtcPurpose,
  coinType: BtcCoinType,
  account: number,
  changeIndex: number,
): number[] {
  return [
    purpose + HARDENED_OFFSET,
    coinType + HARDENED_OFFSET,
    account,
    1,
    changeIndex,
  ];
}

/**
 * Build a transaction request from wallet UTXOs.
 *
 * @param input - Transaction building parameters
 * @returns Transaction request ready for signing
 *
 * @example
 * const txReq = buildTxReq({
 *   utxos: walletSnapshot.utxos,
 *   recipient: 'bc1q...',
 *   value: 50000,
 *   feeRate: 10,
 *   purpose: 84,
 *   changeIndex: 5,
 * });
 */
export function buildTxReq(input: TxBuildInput): TxBuildResult {
  const {
    utxos,
    recipient,
    value,
    feeRate,
    purpose,
    coinType = BTC_COIN_TYPES.MAINNET,
    changeIndex,
  } = input;

  if (utxos.length === 0) {
    throw new Error('No UTXOs available');
  }

  if (value <= 0) {
    throw new Error('Value must be positive');
  }

  if (feeRate <= 0) {
    throw new Error('Fee rate must be positive');
  }

  const { selected, fee } = selectUtxos(utxos, value, feeRate);

  const totalInput = selected.reduce((sum, utxo) => sum + utxo.value, 0);
  const changeValue = totalInput - value - fee;

  if (changeValue < 0) {
    throw new Error(
      `Insufficient funds: need ${value + fee} sats, have ${totalInput} sats`,
    );
  }

  const prevOuts = selected.map((utxo) => ({
    txHash: utxo.txid,
    value: utxo.value,
    index: utxo.vout,
    signerPath: utxo.path,
  }));

  const account = extractAccountFromPath(selected[0].path);
  const changePath = buildChangePath(purpose, coinType, account, changeIndex);

  return {
    prevOuts,
    recipient,
    value,
    fee,
    changePath,
    changeValue,
    totalInput,
  };
}

/**
 * Estimate fee for a transaction.
 */
export function estimateFee(
  utxoCount: number,
  feeRate: number,
  inputType: ScriptType = 'p2wpkh',
): number {
  const vbytes = estimateTxVbytes(utxoCount, 2, inputType);
  return Math.ceil(vbytes * feeRate);
}
