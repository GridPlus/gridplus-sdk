import { sha256 } from 'hash.js';
import bitcoin from '../bitcoin';
import { CURRENCIES, decResLengths, signingSchema } from '../constants';
import ethereum from '../ethereum';
import { parseGenericSigningResponse } from '../genericSigning';
import {
  buildTransaction,
  decryptResponse,
  encryptRequest,
  request
} from '../shared/functions';
import {
  validateFwConstants,
  validateSharedSecret,
  validateUrl,
  validateWallet
} from '../shared/validators';
import { parseDER } from '../util';

/**
 * `sign` builds and sends a request for signing to the device.
 * @category Lattice
 * @returns The response from the device.
 */
export async function sign ({
  data,
  currency,
  cachedData,
  nextCode,
  client,
}: SignRequestFunctionParams): Promise<SignData> {
  const { url, wallet, sharedSecret, fwConstants } = validateSignRequest({
    url: client.url,
    fwConstants: client.getFwConstants(),
    wallet: client.getActiveWallet(),
    sharedSecret: client.sharedSecret,
  });

  const { request, isGeneric } = buildTransaction({
    data,
    currency,
    fwConstants,
  });

  const { payload, hasExtraPayloads } = encodeSignRequest({
    request,
    fwConstants,
    wallet,
    cachedData,
    nextCode,
  });

  const encryptedPayload = encryptSignRequest({
    payload,
    sharedSecret,
  });

  const encryptedResponse = await requestSign(encryptedPayload, url);

  if (hasExtraPayloads) {
    const { decryptedData, newEphemeralPub } = decryptSignResponse(
      encryptedResponse,
      sharedSecret,
    );

    client.ephemeralPub = newEphemeralPub;

    return client.sign({
      data,
      currency,
      cachedData: request,
      nextCode: decryptedData.slice(65, 73),
    });
  }

  const { decryptedData, newEphemeralPub } = decryptSignResponse(
    encryptedResponse,
    sharedSecret,
  );

  client.ephemeralPub = newEphemeralPub;
  const transaction = decodeSignResponse({
    data: decryptedData,
    request,
    isGeneric,
    currency,
  });

  return transaction;
}

export const validateSignRequest = ({
  url,
  fwConstants,
  sharedSecret,
  wallet,
}: ValidateSignRequestParams) => {
  const validUrl = validateUrl(url);
  const validFwConstants = validateFwConstants(fwConstants);
  const validSharedSecret = validateSharedSecret(sharedSecret);
  const validWallet = validateWallet(wallet);

  return {
    url: validUrl,
    fwConstants: validFwConstants,
    sharedSecret: validSharedSecret,
    wallet: validWallet,
  };
};

export const encodeSignRequest = ({
  request,
  fwConstants,
  wallet,
  cachedData,
  nextCode,
}: EncodeSignRequestParams) => {
  let reqPayload, schema;
  if (cachedData && nextCode) {
    request = cachedData;
    reqPayload = Buffer.concat([nextCode, request.extraDataPayloads.shift()]);
    schema = signingSchema.EXTRA_DATA;
  } else {
    reqPayload = request.payload;
    schema = request.schema;
  }

  const payload = Buffer.alloc(2 + fwConstants.reqMaxDataSz);
  let off = 0;

  const hasExtraPayloads =
    request.extraDataPayloads && Number(request.extraDataPayloads.length > 0);

  payload.writeUInt8(hasExtraPayloads, off);
  off += 1;
  // Copy request schema (e.g. ETH or BTC transfer)
  payload.writeUInt8(schema, off);
  off += 1;
  const validWallet = validateWallet(wallet);
  // Copy the wallet UID
  validWallet.uid?.copy(payload, off);
  off += validWallet.uid?.length ?? 0;
  // Build data based on the type of request
  reqPayload.copy(payload, off);
  return { payload, hasExtraPayloads };
};

export const encryptSignRequest = ({
  payload,
  sharedSecret,
}: EncrypterParams) => {
  return encryptRequest({
    requestCode: 'SIGN_TRANSACTION',
    payload,
    sharedSecret,
  });
};

export const requestSign = async (payload: Buffer, url: string) => {
  return request({ payload, url });
};

export const decodeSignResponse = ({
  data,
  request,
  isGeneric,
  currency,
}: DecodeSignResponseParams): SignData => {
  const PUBKEY_PREFIX_LEN = 65;
  const PKH_PREFIX_LEN = 20;
  let off = PUBKEY_PREFIX_LEN; // Skip past pubkey prefix

  const DERLength = 74; // max size of a DER signature -- all Lattice sigs are this long
  const SIGS_OFFSET = 10 * DERLength; // 10 signature slots precede 10 pubkey slots
  const PUBKEYS_OFFSET = PUBKEY_PREFIX_LEN + PKH_PREFIX_LEN + SIGS_OFFSET;

  // Get the change data if we are making a BTC transaction
  let changeRecipient;
  if (currency === CURRENCIES.BTC) {
    const btcRequest = request as BitcoinSignRequest;
    const changeVersion = bitcoin.getAddressFormat(btcRequest.origData.changePath);
    const changePubKeyHash = data.slice(off, off + PKH_PREFIX_LEN);
    off += PKH_PREFIX_LEN;
    changeRecipient = bitcoin.getBitcoinAddress(
      changePubKeyHash,
      changeVersion,
    );
    const compressedPubLength = 33; // Size of compressed public key
    const pubkeys = [];
    const sigs = [];
    let n = 0;
    // Parse the signature for each output -- they are returned in the serialized payload in form
    // [pubkey, sig] There is one signature per output
    while (off < data.length) {
      // Exit out if we have seen all the returned sigs and pubkeys
      if (data[off] !== 0x30) break;
      // Otherwise grab another set Note that all DER sigs returned fill the maximum 74 byte
      // buffer, but also contain a length at off+1, which we use to parse the non-zero data.
      // First get the signature from its slot
      const sigStart = off;
      const sigEnd = off + 2 + data[off + 1];
      sigs.push(data.slice(sigStart, sigEnd));
      // Next, shift by the full set of signatures to hit the respective pubkey NOTE: The data
      // returned is: [<sig0>, <sig1>, ... <sig9>][<pubkey0>, <pubkey1>, ... <pubkey9>]
      const pubStart = n * compressedPubLength + PUBKEYS_OFFSET;
      const pubEnd = (n + 1) * compressedPubLength + PUBKEYS_OFFSET;
      pubkeys.push(data.slice(pubStart, pubEnd));
      // Update offset to hit the next signature slot
      off += DERLength;
      n += 1;
    }
    // Build the transaction data to be serialized
    const preSerializedData: any = {
      inputs: [],
      outputs: [],
    };

    // First output comes from request dta
    preSerializedData.outputs.push({
      value: btcRequest.origData.value,
      recipient: btcRequest.origData.recipient,
    });
    if (btcRequest.changeData.value > 0) {
      // Second output comes from change data
      preSerializedData.outputs.push({
        value: btcRequest.changeData.value,
        recipient: changeRecipient,
      });
    }

    // Add the inputs
    for (let i = 0; i < sigs.length; i++) {
      preSerializedData.inputs.push({
        hash: btcRequest.origData.prevOuts[i].txHash,
        index: btcRequest.origData.prevOuts[i].index,
        sig: sigs[i],
        pubkey: pubkeys[i],
        signerPath: btcRequest.origData.prevOuts[i].signerPath,
      });
    }

    // Finally, serialize the transaction
    const serializedTx = bitcoin.serializeTx(preSerializedData);
    // Generate the transaction hash so the user can look this transaction up later
    const preImageTxHash = serializedTx;
    const txHashPre: Buffer = Buffer.from(
      sha256().update(Buffer.from(preImageTxHash, 'hex')).digest('hex'),
      'hex',
    );
    // Add extra data for debugging/lookup purposes
    return {
      tx: serializedTx,
      txHash: sha256().update(txHashPre).digest('hex'),
      changeRecipient,
      sigs,
    };
  } else if (currency === CURRENCIES.ETH && !isGeneric) {
    const sig = parseDER(data.slice(off, off + 2 + data[off + 1]));
    off += DERLength;
    const ethAddr = data.slice(off, off + 20);
    // Determine the `v` param and add it to the sig before returning
    const { rawTx, sigWithV } = ethereum.buildEthRawTx(request, sig, ethAddr);
    return {
      tx: `0x${rawTx}`,
      txHash: `0x${ethereum.hashTransaction(rawTx)}`,
      sig: {
        v: sigWithV.v,
        r: sigWithV.r.toString('hex'),
        s: sigWithV.s.toString('hex'),
      },
      signer: ethAddr,
    };
  } else if (currency === CURRENCIES.ETH_MSG) {
    const sig = parseDER(data.slice(off, off + 2 + data[off + 1]));
    off += DERLength;
    const signer = data.slice(off, off + 20);
    const validatedSig = ethereum.validateEthereumMsgResponse(
      { signer, sig },
      request,
    );
    return {
      sig: {
        v: validatedSig.v,
        r: validatedSig.r.toString('hex'),
        s: validatedSig.s.toString('hex'),
      },
      signer,
    };
  } else {
    // Generic signing request
    return parseGenericSigningResponse(data, off, request);
  }
};

export const decryptSignResponse = (response: Buffer, sharedSecret: Buffer) => {
  const { decryptedData, newEphemeralPub } = decryptResponse(
    response,
    decResLengths.sign,
    sharedSecret,
  );
  return { decryptedData, newEphemeralPub };
};
