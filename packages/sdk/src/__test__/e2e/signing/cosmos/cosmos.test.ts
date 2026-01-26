/**
 * REQUIRED TEST MNEMONIC:
 * These tests require a SafeCard loaded with the standard test mnemonic:
 * "test test test test test test test test test test test junk"
 *
 * Running with a different mnemonic will cause test failures due to
 * incorrect key derivations and signature mismatches.
 */
import { createHash } from 'node:crypto';
import { bech32 } from 'bech32';
import { Constants, signCosmos } from '../../../..';
import { COSMOS_DERIVATION } from '../../../../constants';
import { setupClient } from '../../../utils/setup';
import { deriveSECP256K1Key, validateGenericSig } from '../../../utils/helpers';
import { TEST_SEED } from '../../../utils/testConstants';

const encodeVarint = (value: number | bigint) => {
  let v = BigInt(value);
  const bytes: number[] = [];
  while (v >= 0x80n) {
    bytes.push(Number((v & 0x7fn) | 0x80n));
    v >>= 7n;
  }
  bytes.push(Number(v));
  return Buffer.from(bytes);
};

const encodeFieldKey = (tag: number, wireType: number) =>
  encodeVarint((tag << 3) | wireType);

const encodeVarintField = (tag: number, value: number | bigint) =>
  Buffer.concat([encodeFieldKey(tag, 0), encodeVarint(value)]);

const encodeBytesField = (tag: number, value: Buffer) =>
  Buffer.concat([encodeFieldKey(tag, 2), encodeVarint(value.length), value]);

const encodeStringField = (tag: number, value: string) =>
  encodeBytesField(tag, Buffer.from(value, 'utf8'));

const encodeAny = (typeUrl: string, value: Buffer) =>
  Buffer.concat([encodeStringField(1, typeUrl), encodeBytesField(2, value)]);

const encodeCoin = (denom: string, amount: string) =>
  Buffer.concat([encodeStringField(1, denom), encodeStringField(2, amount)]);

const buildMsgSend = (
  from: string,
  to: string,
  denom: string,
  amount: string,
) =>
  Buffer.concat([
    encodeStringField(1, from),
    encodeStringField(2, to),
    encodeBytesField(3, encodeCoin(denom, amount)),
  ]);

const buildMsgMultiSend = (
  inputs: Array<{ address: string; denom: string; amount: string }>,
  outputs: Array<{ address: string; denom: string; amount: string }>,
) => {
  const inputBufs = inputs.map((input) =>
    encodeBytesField(
      1,
      Buffer.concat([
        encodeStringField(1, input.address),
        encodeBytesField(2, encodeCoin(input.denom, input.amount)),
      ]),
    ),
  );
  const outputBufs = outputs.map((output) =>
    encodeBytesField(
      2,
      Buffer.concat([
        encodeStringField(1, output.address),
        encodeBytesField(2, encodeCoin(output.denom, output.amount)),
      ]),
    ),
  );
  return Buffer.concat([...inputBufs, ...outputBufs]);
};

const buildMsgDelegate = (
  delegator: string,
  validator: string,
  denom: string,
  amount: string,
) =>
  Buffer.concat([
    encodeStringField(1, delegator),
    encodeStringField(2, validator),
    encodeBytesField(3, encodeCoin(denom, amount)),
  ]);

const buildMsgRedelegate = (
  delegator: string,
  validatorSrc: string,
  validatorDst: string,
  denom: string,
  amount: string,
) =>
  Buffer.concat([
    encodeStringField(1, delegator),
    encodeStringField(2, validatorSrc),
    encodeStringField(3, validatorDst),
    encodeBytesField(4, encodeCoin(denom, amount)),
  ]);

const buildMsgExecuteContract = (
  sender: string,
  contract: string,
  msg: string,
  denom: string,
  amount: string,
) =>
  Buffer.concat([
    encodeStringField(1, sender),
    encodeStringField(2, contract),
    encodeBytesField(3, Buffer.from(msg, 'utf8')),
    encodeBytesField(5, encodeCoin(denom, amount)),
  ]);

const buildMsgIbcTransfer = (params: {
  port: string;
  channel: string;
  sender: string;
  receiver: string;
  denom: string;
  amount: string;
  timeoutTimestamp: number | bigint;
  memo: string;
}) => {
  const timeoutHeight = Buffer.concat([
    encodeVarintField(1, 1),
    encodeVarintField(2, 123456),
  ]);
  return Buffer.concat([
    encodeStringField(1, params.port),
    encodeStringField(2, params.channel),
    encodeBytesField(3, encodeCoin(params.denom, params.amount)),
    encodeStringField(4, params.sender),
    encodeStringField(5, params.receiver),
    encodeBytesField(6, timeoutHeight),
    encodeVarintField(7, params.timeoutTimestamp),
    encodeStringField(8, params.memo),
  ]);
};

const buildPubKeyAny = (pubkey: Buffer) => {
  const pubKeyMsg = encodeBytesField(1, pubkey);
  return encodeAny('/cosmos.crypto.secp256k1.PubKey', pubKeyMsg);
};

const buildSignerInfo = (pubkey: Buffer, sequence: number) => {
  const modeInfoSingle = encodeVarintField(1, 1); // SIGN_MODE_DIRECT
  const modeInfo = encodeBytesField(1, modeInfoSingle);
  return Buffer.concat([
    encodeBytesField(1, buildPubKeyAny(pubkey)),
    encodeBytesField(2, modeInfo),
    encodeVarintField(3, sequence),
  ]);
};

const buildFee = (denom: string, amount: string, gasLimit: number) =>
  Buffer.concat([
    encodeBytesField(1, encodeCoin(denom, amount)),
    encodeVarintField(2, gasLimit),
  ]);

const buildAuthInfo = (
  pubkey: Buffer,
  sequence: number,
  denom: string,
  amount: string,
  gasLimit: number,
) =>
  Buffer.concat([
    encodeBytesField(1, buildSignerInfo(pubkey, sequence)),
    encodeBytesField(2, buildFee(denom, amount, gasLimit)),
  ]);

const buildTxBody = (msgAny: Buffer, memo: string) =>
  Buffer.concat([encodeBytesField(1, msgAny), encodeStringField(2, memo)]);

const buildSignDoc = (
  bodyBytes: Buffer,
  authInfoBytes: Buffer,
  chainId: string,
  accountNumber: number,
) =>
  Buffer.concat([
    encodeBytesField(1, bodyBytes),
    encodeBytesField(2, authInfoBytes),
    encodeStringField(3, chainId),
    encodeVarintField(4, accountNumber),
  ]);

const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest();
const ripemd160 = (buf: Buffer) => createHash('ripemd160').update(buf).digest();

const getBech32Address = (pubkey: Buffer, hrp: string) => {
  const hash = ripemd160(sha256(pubkey));
  const words = bech32.toWords(hash);
  return bech32.encode(hrp, words);
};

describe('[Cosmos]', () => {
  const chainId = 'cosmoshub-4';
  const feeDenom = 'uatom';
  const feeAmount = '500';
  const feeGas = 200000;
  let pub: Buffer;
  let fromAddr: string;
  let toAddr: string;
  let altAddr: string;
  let valoperA: string;
  let valoperB: string;
  let supportsCosmos = true;

  beforeAll(async () => {
    const client = await setupClient();
    supportsCosmos = Boolean(
      client.getFwConstants()?.genericSigning?.encodingTypes?.COSMOS,
    );
    if (!supportsCosmos) {
      console.warn(
        '[Cosmos] Firmware v0.18.10+ is required for Cosmos encoding; skipping tests.',
      );
    }
    ({ pub } = deriveSECP256K1Key(COSMOS_DERIVATION, TEST_SEED));
    fromAddr = getBech32Address(pub, 'cosmos');
    toAddr = 'cosmos1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqnrql8a';

    const altPath = [...COSMOS_DERIVATION];
    altPath[4] += 1;
    const altPub = deriveSECP256K1Key(altPath, TEST_SEED).pub;
    altAddr = getBech32Address(altPub, 'cosmos');
    valoperA = getBech32Address(pub, 'cosmosvaloper');
    valoperB = getBech32Address(altPub, 'cosmosvaloper');
  });

  const buildSignDocForMsg = (msgAny: Buffer, memo: string) => {
    const txBody = buildTxBody(msgAny, memo);
    const authInfo = buildAuthInfo(pub, 0, feeDenom, feeAmount, feeGas);
    return buildSignDoc(txBody, authInfo, chainId, 0);
  };

  const signAndValidate = async (signDoc: Buffer) => {
    const resp = await signCosmos(signDoc);
    expect(resp.sig).toBeTruthy();

    validateGenericSig(TEST_SEED, resp.sig, signDoc, {
      signerPath: COSMOS_DERIVATION,
      curveType: Constants.SIGNING.CURVES.SECP256K1,
      hashType: Constants.SIGNING.HASHES.SHA256,
    });
  };

  it('Should sign a Cosmos MsgSend SignDoc (SIGN_MODE_DIRECT)', async (ctx) => {
    if (!supportsCosmos) {
      ctx.skip();
      return;
    }
    const msgSend = buildMsgSend(fromAddr, toAddr, 'uatom', '1');
    const msgAny = encodeAny('/cosmos.bank.v1beta1.MsgSend', msgSend);
    await signAndValidate(buildSignDocForMsg(msgAny, 'gridplus cosmos send'));
  });

  it('Should sign a Cosmos MsgMultiSend SignDoc (SIGN_MODE_DIRECT)', async (ctx) => {
    if (!supportsCosmos) {
      ctx.skip();
      return;
    }
    const msgMultiSend = buildMsgMultiSend(
      [
        { address: fromAddr, denom: 'uatom', amount: '3' },
        { address: altAddr, denom: 'uatom', amount: '7' },
      ],
      [{ address: toAddr, denom: 'uatom', amount: '10' }],
    );
    const msgAny = encodeAny('/cosmos.bank.v1beta1.MsgMultiSend', msgMultiSend);
    await signAndValidate(buildSignDocForMsg(msgAny, 'gridplus cosmos multi'));
  });

  it('Should sign a Cosmos MsgTransfer (IBC) SignDoc (SIGN_MODE_DIRECT)', async (ctx) => {
    if (!supportsCosmos) {
      ctx.skip();
      return;
    }
    const msgTransfer = buildMsgIbcTransfer({
      port: 'transfer',
      channel: 'channel-0',
      sender: fromAddr,
      receiver: toAddr,
      denom: 'uatom',
      amount: '42',
      timeoutTimestamp: 1690000000000,
      memo: 'ibc memo',
    });
    const msgAny = encodeAny(
      '/ibc.applications.transfer.v1.MsgTransfer',
      msgTransfer,
    );
    await signAndValidate(buildSignDocForMsg(msgAny, 'gridplus cosmos ibc'));
  });

  it('Should sign a Cosmos MsgDelegate SignDoc (SIGN_MODE_DIRECT)', async (ctx) => {
    if (!supportsCosmos) {
      ctx.skip();
      return;
    }
    const msgDelegate = buildMsgDelegate(fromAddr, valoperA, 'uatom', '25');
    const msgAny = encodeAny(
      '/cosmos.staking.v1beta1.MsgDelegate',
      msgDelegate,
    );
    await signAndValidate(
      buildSignDocForMsg(msgAny, 'gridplus cosmos delegate'),
    );
  });

  it('Should sign a Cosmos MsgUndelegate SignDoc (SIGN_MODE_DIRECT)', async (ctx) => {
    if (!supportsCosmos) {
      ctx.skip();
      return;
    }
    const msgUndelegate = buildMsgDelegate(fromAddr, valoperA, 'uatom', '12');
    const msgAny = encodeAny(
      '/cosmos.staking.v1beta1.MsgUndelegate',
      msgUndelegate,
    );
    await signAndValidate(
      buildSignDocForMsg(msgAny, 'gridplus cosmos undelegate'),
    );
  });

  it('Should sign a Cosmos MsgBeginRedelegate SignDoc (SIGN_MODE_DIRECT)', async (ctx) => {
    if (!supportsCosmos) {
      ctx.skip();
      return;
    }
    const msgRedelegate = buildMsgRedelegate(
      fromAddr,
      valoperA,
      valoperB,
      'uatom',
      '8',
    );
    const msgAny = encodeAny(
      '/cosmos.staking.v1beta1.MsgBeginRedelegate',
      msgRedelegate,
    );
    await signAndValidate(
      buildSignDocForMsg(msgAny, 'gridplus cosmos redelegate'),
    );
  });

  it('Should sign a Cosmos MsgExecuteContract SignDoc (SIGN_MODE_DIRECT)', async (ctx) => {
    if (!supportsCosmos) {
      ctx.skip();
      return;
    }
    const execMsg = '{"transfer":{"recipient":"cosmos1deadbeef","amount":"5"}}';
    const msgExecute = buildMsgExecuteContract(
      fromAddr,
      toAddr,
      execMsg,
      'uatom',
      '5',
    );
    const msgAny = encodeAny(
      '/cosmwasm.wasm.v1.MsgExecuteContract',
      msgExecute,
    );
    await signAndValidate(buildSignDocForMsg(msgAny, 'gridplus cosmos wasm'));
  });

  it('Should sign a Terra legacy MsgExecuteContract SignDoc (SIGN_MODE_DIRECT)', async (ctx) => {
    if (!supportsCosmos) {
      ctx.skip();
      return;
    }
    const execMsg = '{"send":{"to":"cosmos1deadbeef","amount":"7"}}';
    const msgExecute = buildMsgExecuteContract(
      fromAddr,
      toAddr,
      execMsg,
      'uatom',
      '7',
    );
    const msgAny = encodeAny(
      '/terra.wasm.v1beta1.MsgExecuteContract',
      msgExecute,
    );
    await signAndValidate(buildSignDocForMsg(msgAny, 'gridplus terra wasm'));
  });
});
