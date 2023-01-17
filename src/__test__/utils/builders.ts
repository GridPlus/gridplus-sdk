import Common, { Chain, Hardfork } from '@ethereumjs/common';
import {
  TransactionFactory as EthTxFactory,
  TypedTransaction,
} from '@ethereumjs/tx';
import { AbiCoder } from '@ethersproject/abi';
import { keccak256 } from 'js-sha3';
import randomWords from 'random-words';
import { decode as rlpDecode, encode as rlpEncode } from 'rlp';
import { Calldata, Constants } from '../..';
import { Client } from '../../client';
import {
  CURRENCIES,
  getFwVersionConst,
  HARDENED_OFFSET,
} from '../../constants';
import { randomBytes } from '../../util';
import { MSG_PAYLOAD_METADATA_SZ } from './constants';
import { convertDecoderToEthers } from './ethers';
import { getN, getPrng } from './getters';
import {
  BTC_PURPOSE_P2PKH,
  buildRandomEip712Object,
  copyBuffer,
  ETH_COIN,
  getTestVectors,
  serializeJobData,
} from './helpers';
const prng = getPrng();

export const getFwVersionsList = () => {
  const arr: number[][] = [];
  Array.from({ length: 1 }, (x, i) => {
    Array.from({ length: 10 }, (y, j) => {
      Array.from({ length: 5 }, (z, k) => {
        arr.push([i, j + 10, k]);
      });
    });
  });
  return arr;
};

export const buildFirmwareConstants = (...overrides: any) => {
  return {
    abiCategorySz: 32,
    abiMaxRmv: 200,
    addrFlagsAllowed: true,
    allowBtcLegacyAndSegwitAddrs: true,
    allowedEthTxTypes: [1, 2],
    contractDeployKey: '0x08002e0fec8e6acf00835f43c9764f7364fa3f42',
    eip712MaxTypeParams: 36,
    eip712Supported: true,
    ethMaxDataSz: 1519,
    ethMaxGasPrice: 20000000000000,
    ethMaxMsgSz: 1540,
    ethMsgPreHashAllowed: true,
    extraDataFrameSz: 1500,
    extraDataMaxFrames: 1,
    genericSigning: {
      baseReqSz: 1552,
      baseDataSz: 1519,
      hashTypes: { NONE: 0, KECCAK256: 1, SHA256: 2 },
      curveTypes: { SECP256K1: 0, ED25519: 1 },
      encodingTypes: { NONE: 1, SOLANA: 2, EVM: 4 },
      calldataDecoding: { reserved: 2895728, maxSz: 1024 },
    },
    getAddressFlags: [4, 3],
    kvActionMaxNum: 10,
    kvActionsAllowed: true,
    kvKeyMaxStrSz: 63,
    kvRemoveMaxNum: 100,
    kvValMaxStrSz: 63,
    maxDecoderBufSz: 1600,
    personalSignHeaderSz: 72,
    prehashAllowed: true,
    reqMaxDataSz: 1678,
    varAddrPathSzAllowed: true,
    ...overrides,
  } as FirmwareConstants;
};

export const buildWallet = (overrides?) => ({
  uid: Buffer.from(
    '162b56efe561c12bc93f703dc7026b3ec3d53923270c9259e2b08015fb9defd2',
    'hex',
  ),
  capabilities: 1,
  external: true,
  ...overrides,
});

export const buildGetAddressesObject = (overrides?) => ({
  startPath: [0x80000000 + 44, 0x80000000 + 60, 0x80000000, 0, 0],
  n: 1,
  flag: 1,
  fwConstants: buildFirmwareConstants(),
  wallet: buildWallet(),
  ...overrides,
});

export const buildSignObject = (fwVersion, overrides?) => {
  const fwConstants = getFwVersionConst(fwVersion);
  return {
    data: {
      to: '0xc0c8f96C2fE011cc96770D2e37CfbfeAFB585F0e',
      from: '0xc0c8f96C2fE011cc96770D2e37CfbfeAFB585F0e',
      value: 0x80000000,
      data: 0x0,
      signerPath: [0x80000000 + 44, 0x80000000 + 60, 0x80000000, 0, 0],
      nonce: 0x80000000,
      gasLimit: 0x80000000,
      gasPrice: 0x80000000,
    },
    currency: CURRENCIES.ETH as Currency,
    fwConstants,
    ...overrides,
  };
};

export const buildSharedSecret = () => {
  return Buffer.from([
    89, 60, 130, 80, 168, 252, 34, 136, 230, 71, 230, 158, 51, 13, 239, 237, 6,
    246, 71, 232, 232, 175, 193, 106, 106, 185, 38, 1, 163, 14, 225, 101,
  ]);
};

export const getNumIter = (n: number | string | undefined = getN()) =>
  n ? parseInt(`${n}`) : 5;

/** Generate a bunch of random test vectors using the PRNG */
export const buildRandomVectors = (n: number | string | undefined = getN()) => {
  const numIter = getNumIter(n);

  // Generate a bunch of random test vectors using the PRNG
  const RANDOM_VEC: any[] = [];
  for (let i = 0; i < numIter; i++) {
    RANDOM_VEC.push(Math.floor(1000000000 * prng.quick()).toString(16));
  }
  return RANDOM_VEC;
};

export const buildTestRequestPayload = (
  client: Client,
  jobType: number,
  jobData: any,
): TestRequestPayload => {
  const activeWalletUID = copyBuffer(client.getActiveWallet()?.uid);
  return {
    client,
    testID: 0, // wallet_job test ID
    payload: serializeJobData(jobType, activeWalletUID, jobData),
  };
};

export const DEFAULT_SIGNER = [
  BTC_PURPOSE_P2PKH,
  ETH_COIN,
  HARDENED_OFFSET,
  0,
  0,
];

export const buildTx = (data = '0xdeadbeef') => {
  return EthTxFactory.fromTxData(
    {
      type: 2,
      maxFeePerGas: 1200000000,
      maxPriorityFeePerGas: 1200000000,
      nonce: 0,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 100,
      data,
    },
    {
      common: new Common({
        chain: Chain.Mainnet,
        hardfork: Hardfork.London,
      }),
    },
  );
};

export const buildEthSignRequest = async (
  client: Client,
  txDataOverrides?: any,
): Promise<any> => {
  if (client.getFwVersion()?.major === 0 && client.getFwVersion()?.minor < 15) {
    console.warn('Please update firmware. Skipping ETH signing tests.');
    return;
  }

  const fwConstants = client.getFwConstants();
  const signerPath = [BTC_PURPOSE_P2PKH, ETH_COIN, HARDENED_OFFSET, 0, 0];
  const common = new Common({
    chain: Chain.Mainnet,
    hardfork: Hardfork.London,
  });
  const txData = {
    type: 2,
    maxFeePerGas: 1200000000,
    maxPriorityFeePerGas: 1200000000,
    nonce: 0,
    gasLimit: 50000,
    to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
    value: 1000000000000,
    data: '0x17e914679b7e160613be4f8c2d3203d236286d74eb9192f6d6f71b9118a42bb033ccd8e8',
    ...txDataOverrides,
  };
  const tx = EthTxFactory.fromTxData(txData, { common });
  const req = {
    data: {
      signerPath,
      payload: tx.getMessageToSign(false),
      curveType: Constants.SIGNING.CURVES.SECP256K1,
      hashType: Constants.SIGNING.HASHES.KECCAK256,
      encodingType: Constants.SIGNING.ENCODINGS.EVM,
    },
  };
  const maxDataSz =
    fwConstants.ethMaxDataSz +
    fwConstants.extraDataMaxFrames * fwConstants.extraDataFrameSz;
  return {
    fwConstants,
    signerPath,
    common,
    txData,
    tx,
    req,
    maxDataSz,
  };
};

export const buildTxReq = (tx: TypedTransaction) => ({
  data: {
    signerPath: DEFAULT_SIGNER,
    payload: tx.getMessageToSign(false),
    curveType: Constants.SIGNING.CURVES.SECP256K1,
    hashType: Constants.SIGNING.HASHES.KECCAK256,
    encodingType: Constants.SIGNING.ENCODINGS.EVM,
  },
});

export const buildMsgReq = (
  payload = 'hello ethereum',
  protocol = 'signPersonal',
) => ({
  currency: 'ETH_MSG',
  data: {
    signerPath: DEFAULT_SIGNER,
    protocol,
    payload,
  },
});

export const buildEvmReq = (overrides?: {
  data?: any;
  txData?: any;
  common?: any;
}) => {
  let chainInfo = null;
  if (overrides?.common) {
    chainInfo = overrides.common;
  } else if (overrides?.txData?.chainId !== '0x1') {
    chainInfo = Common.custom({ chainId: 137 }, { hardfork: Hardfork.London });
  } else {
    chainInfo = new Common({
      chain: Chain.Mainnet,
      hardfork: Hardfork.London,
    });
  }
  const req = {
    data: {
      signerPath: DEFAULT_SIGNER,
      curveType: Constants.SIGNING.CURVES.SECP256K1,
      hashType: Constants.SIGNING.HASHES.KECCAK256,
      encodingType: Constants.SIGNING.ENCODINGS.EVM,
      payload: null,
      ...overrides?.data,
    },
    txData: {
      type: 2,
      maxFeePerGas: 1200000000,
      maxPriorityFeePerGas: 1200000000,
      nonce: 0,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 100,
      data: '0xdeadbeef',
      ...overrides?.txData,
    },
    common: chainInfo,
  };
  return req;
};

export const buildEncDefs = (vectors: any) => {
  const coder = new AbiCoder();
  const EVMCalldata = Calldata.EVM;
  const encDefs: any[] = [];
  const encDefsCalldata: any[] = [];
  for (let i = 0; i < vectors.canonicalNames.length; i++) {
    const name = vectors.canonicalNames[i];
    const selector = `0x${keccak256(name).slice(0, 8)}`;
    const def = EVMCalldata.parsers.parseCanonicalName(selector, name);
    const encDef = Buffer.from(rlpEncode(def));
    encDefs.push(encDef);
    const { types, data } = convertDecoderToEthers(rlpDecode(encDef).slice(1));
    const calldata = coder.encode(types, data);
    encDefsCalldata.push(`${selector}${calldata.slice(2)}`);
  }
  return { encDefs, encDefsCalldata };
};

export function buildRandomMsg(type = 'signPersonal', client: Client) {
  function randInt(n: number) {
    return Math.floor(n * prng.quick());
  }

  if (type === 'signPersonal') {
    // A random string will do
    const isHexStr = randInt(2) > 0 ? true : false;
    const fwConstants = client.getFwConstants();
    const L = randInt(fwConstants.ethMaxDataSz - MSG_PAYLOAD_METADATA_SZ);
    if (isHexStr) return `0x${randomBytes(L).toString('hex')}`;
    // Get L hex bytes (represented with a string with 2*L chars)
    else return randomWords({ exactly: L, join: ' ' }).slice(0, L); // Get L ASCII characters (bytes)
  } else if (type === 'eip712') {
    return buildRandomEip712Object(randInt);
  }
}

export function buildEthMsgReq(
  payload: any,
  protocol: string,
  signerPath = [
    BTC_PURPOSE_P2PKH,
    ETH_COIN,
    HARDENED_OFFSET,
    0,
    0,
  ] as SigningPath,
): SignRequestParams {
  return {
    currency: CURRENCIES.ETH_MSG,
    data: {
      signerPath,
      payload,
      protocol,
    },
  };
}

export const buildValidateConnectObject = (overrides?) => ({
  deviceId: 'test',
  key: 'test',
  baseUrl: 'https://www.test.com',
  ...overrides,
});

export const buildValidateRequestObject = (overrides?) => {
  const fwConstants = buildFirmwareConstants();
  return {
    fwConstants,
    ...overrides,
  };
};

// Most of the endpoint validators (for encrypted requests)
// will require a connected client instance.
export function buildMockConnectedClient(opts) {
  const _stateData = JSON.parse(getTestVectors().dehydratedClientState);
  const stateData = {
    ..._stateData,
    ...opts,
  };
  return new Client({
    stateData: JSON.stringify(stateData),
  });
}
