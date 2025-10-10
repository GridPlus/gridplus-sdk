import { Client } from '../../client';
import { getEncodedPayload } from '../../genericSigning';
import {
  deriveSECP256K1Key,
  parseWalletJobResp,
  validateGenericSig,
  getSignatureVBN,
} from './helpers';
import { initializeSeed } from './initializeClient';
import { testRequest } from './testRequest';
import { Constants } from '../..';
import { TransactionFactory as EthTxFactory } from '@ethereumjs/tx';
import { RLP } from '@ethereumjs/rlp';
import { getDeviceId } from './getters';
import { ensureHexBuffer } from '../../util';

export async function runTestCase(
  payload: TestRequestPayload,
  expectedCode: number,
) {
  const res = await testRequest(payload);
  //@ts-expect-error - Accessing private property
  const fwVersion = payload.client.fwVersion;
  const parsedRes = parseWalletJobResp(res, fwVersion);
  expect(parsedRes.resultStatus).toEqual(expectedCode);
  return parsedRes;
}

export async function runGeneric(request: SignRequestParams, client: Client) {
  const response = await client.sign(request);
  // If no encoding type is specified we encode in hex or ascii
  const encodingType = request.data.encodingType || null;
  const allowedEncodings = client.getFwConstants().genericSigning.encodingTypes;
  const { payloadBuf } = getEncodedPayload(
    request.data.payload,
    encodingType,
    allowedEncodings,
  );
  const seed = await initializeSeed(client);
  validateGenericSig(
    seed,
    response.sig,
    payloadBuf,
    request.data,
    response.pubkey,
  );
  return response;
}

export async function runEvm(
  req: any,
  client: Client,
  seed: any,
  bypassSetPayload = false,
  shouldFail = false,
  useLegacySigning = false,
) {
  // Construct an @ethereumjs/tx object with data
  const txData = JSON.parse(JSON.stringify(req.txData));
  const tx = EthTxFactory.fromTxData(txData, { common: req.common });
  if (useLegacySigning) {
    // [TODO: Deprecate]
    req.data = {
      ...req.data,
      ...req.txData,
    };
  }
  //@ts-expect-error - Accessing private property
  if (tx._type === 0 && !bypassSetPayload) {
    // The @ethereumjs/tx Transaction APIs differ here
    // Legacy transaction
    req.data.payload = RLP.encode(tx.getMessageToSign(false));
  } else if (!bypassSetPayload) {
    // Newer transaction type
    req.data.payload = tx.getMessageToSign(false);
  }
  // Request signature and validate it
  await client.connect(getDeviceId());
  const resp = await client.sign(req);
  const sig = resp.sig ? resp.sig : null;
  if (shouldFail || !sig) {
    // Exit here without continuing tests. If this block is reached it indicates
    // the Lattice did not throw an error when we expected it to do so.
    return;
  }
  const encodingType = req.data.encodingType || null;
  const allowedEncodings = client.getFwConstants().genericSigning.encodingTypes;
  const { payloadBuf } = getEncodedPayload(
    req.data.payload,
    encodingType,
    allowedEncodings,
  );
  if (useLegacySigning) {
    // [TODO: Deprecate]
    req.data.curveType = Constants.SIGNING.CURVES.SECP256K1;
    req.data.hashType = Constants.SIGNING.HASHES.KECCAK256;
    req.data.encodingType = Constants.SIGNING.ENCODINGS.EVM;
  }
  if (!seed) {
    seed = await initializeSeed(client);
  }
  validateGenericSig(seed, resp.sig, payloadBuf, req.data, resp.pubkey);
  // Sign the original tx and compare
  const { priv } = deriveSECP256K1Key(req.data.signerPath, seed);
  const signedTx: any = tx.sign(priv);
  expect(signedTx.verifySignature()).toEqualElseLog(
    true,
    'Signature failed to verify',
  );

  const refR = ensureHexBuffer(signedTx.r?.toString(16));
  const refS = ensureHexBuffer(signedTx.s?.toString(16));

  // Handle the V parameter differently based on transaction type
  let refV;
  if (tx._type && tx._type > 0) {
    // For EIP-1559 and newer transaction types, use y-parity (0 or 1)
    refV = signedTx.v?.toString();
  } else {
    // For legacy transactions
    refV = signedTx.v?.toString();
  }

  // Get params from Lattice sig
  const latticeR = Buffer.from(sig.r);
  const latticeS = Buffer.from(sig.s);
  const latticeV = (() => {
    const value = sig.v;
    if (value === null || value === undefined) {
      return 0n;
    }
    if (typeof value === 'bigint') {
      return value;
    }
    if (typeof value === 'number') {
      return BigInt(value);
    }
    if (typeof value === 'string') {
      const normalized = value.startsWith('0x') ? value : `0x${value}`;
      return BigInt(normalized);
    }
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
      const hex = Buffer.from(value).toString('hex');
      return hex ? BigInt(`0x${hex}`) : 0n;
    }
    if (typeof (value as any)?.toArray === 'function') {
      const hex = Buffer.from((value as any).toArray('be')).toString('hex');
      return hex ? BigInt(`0x${hex}`) : 0n;
    }
    if (typeof (value as any)?.toString === 'function') {
      const str = (value as any).toString();
      if (/^0x[0-9a-f]+$/i.test(str) || /^[0-9]+$/i.test(str)) {
        return BigInt(str.startsWith('0x') ? str : `0x${str}`);
      }
    }
    return 0n;
  })();

  // Validate the signature
  expect(latticeR.equals(refR)).toEqualElseLog(
    true,
    'Signature R component does not match reference',
  );
  expect(latticeS.equals(refS)).toEqualElseLog(
    true,
    'Signature S component does not match reference',
  );
  expect(latticeV.toString()).toEqualElseLog(
    refV.toString(),
    'Signature V component does not match reference',
  );
  // One more check -- create a new tx with the signature params and verify it
  const signedTxData = JSON.parse(JSON.stringify(txData));
  signedTxData.v = latticeV;
  signedTxData.r = latticeR;
  signedTxData.s = latticeS;

  const verifTx = EthTxFactory.fromTxData(signedTxData, {
    common: req.common,
  });
  expect(verifTx.verifySignature()).toEqualElseLog(
    true,
    'Signature did not validate in recreated @ethereumjs/tx object',
  );
}

export const runEthMsg = async (req: SignRequestParams, client: Client) => {
  const sig = await client.sign(req);
  expect(sig.sig).not.toEqual(null);
};
