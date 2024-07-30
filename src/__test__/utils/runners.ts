import { Client } from '../../client';
import { getEncodedPayload } from '../../genericSigning';
import {
  deriveSECP256K1Key,
  parseWalletJobResp,
  validateGenericSig,
} from './helpers';
import { initializeSeed } from './initializeClient';
import { testRequest } from './testRequest';
import BN from 'bn.js';
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
  validateGenericSig(seed, response.sig, payloadBuf, request.data);
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
  validateGenericSig(seed, resp.sig, payloadBuf, req.data);
  // Sign the original tx and compare
  const { priv } = deriveSECP256K1Key(req.data.signerPath, seed);
  const signedTx: any = tx.sign(priv);
  expect(signedTx.verifySignature()).toEqualElseLog(
    true,
    'Signature failed to verify',
  );
  const refR = ensureHexBuffer(signedTx.r?.toString(16));
  const refS = ensureHexBuffer(signedTx.s?.toString(16));
  const refV = signedTx.v?.toString();
  // Get params from Lattice sig
  const latticeR = Buffer.from(sig.r);
  const latticeS = Buffer.from(sig.s);
  const latticeV = new BN(sig.v);

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
  // One more check -- create a new tx with the signatre params and verify it
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
