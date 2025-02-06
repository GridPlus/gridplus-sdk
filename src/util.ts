// Static utility functions
import { RLP } from '@ethereumjs/rlp';
import { Capability, TransactionFactory as EthTxFactory } from '@ethereumjs/tx';
import aes from 'aes-js';
import BigNum from 'bignumber.js';
import { BN } from 'bn.js';
import { Buffer } from 'buffer';
import crc32 from 'crc-32';
import { ec as EC } from 'elliptic';
import { sha256 } from 'hash.js/lib/hash/sha';
import { keccak256 } from 'js-sha3';
import inRange from 'lodash/inRange';
import isInteger from 'lodash/isInteger';
import { ecdsaRecover } from 'secp256k1';
import { CALLDATA } from './calldata';
import {
  BIP_CONSTANTS,
  EXTERNAL_NETWORKS_BY_CHAIN_ID_URL,
  HARDENED_OFFSET,
  NETWORKS_BY_CHAIN_ID,
  VERSION_BYTE,
} from './constants';
import { LatticeResponseCode, ProtocolConstants } from './protocol';
import {
  isValid4ByteResponse,
  isValidBlockExplorerResponse,
} from './shared/validators';
import { FirmwareConstants } from './types';
import {
  decodeAbiParameters as viemDecodeAbiParameters,
  parseAbiParameters,
  type AbiParameter,
  decodeFunctionData,
  encodeFunctionData,
  parseAbiItem,
  type AbiFunction,
  getAbiItem,
} from 'viem';
import { parseCanonicalName } from './calldata/evm';
import { AbiParameters } from 'ox';

const { COINS, PURPOSES } = BIP_CONSTANTS;
let ec: EC | undefined;

//--------------------------------------------------
// LATTICE UTILS
//--------------------------------------------------

/** @internal Parse a response from the Lattice1 */
export const parseLattice1Response = function (r: string): {
  errorMessage?: string;
  responseCode?: number;
  data?: Buffer;
} {
  const parsed: {
    errorMessage: string | null;
    data: Buffer | null;
    responseCode?: number;
  } = {
    errorMessage: null,
    data: null,
  };
  const b = Buffer.from(r, 'hex');
  let off = 0;

  // Get protocol version
  const protoVer = b.readUInt8(off);
  off++;
  if (protoVer !== VERSION_BYTE) {
    parsed.errorMessage = 'Incorrect protocol version. Please update your SDK';
    return parsed;
  }

  // Get the type of response
  // Should always be 0x00
  const msgType = b.readUInt8(off);
  off++;
  if (msgType !== 0x00) {
    parsed.errorMessage = 'Incorrect response from Lattice1';
    return parsed;
  }

  // Get the payload
  b.readUInt32BE(off);
  off += 4; // First 4 bytes is the id, but we don't need that anymore
  const len = b.readUInt16BE(off);
  off += 2;
  const payload = b.slice(off, off + len);
  off += len;

  // Get response code
  const responseCode = payload.readUInt8(0);
  if (responseCode !== LatticeResponseCode.success) {
    const errMsg = ProtocolConstants.responseMsg[responseCode];
    parsed.errorMessage = `[Lattice] ${errMsg ? errMsg : 'Unknown Error'}`;
    parsed.responseCode = responseCode;
    return parsed;
  } else {
    parsed.data = payload.slice(1, payload.length);
  }

  // Verify checksum
  const cs = b.readUInt32BE(off);
  const expectedCs = checksum(b.slice(0, b.length - 4));
  if (cs !== expectedCs) {
    parsed.errorMessage = 'Invalid checksum from device response';
    parsed.data = null;
    return parsed;
  }

  return parsed;
};

/** @internal */
export const checksum = function (x: Buffer): number {
  // crc32 returns a signed integer - need to cast it to unsigned
  // Note that this uses the default 0xedb88320 polynomial
  return crc32.buf(x) >>> 0; // Need this to be a uint, hence the bit shift
};

// Get a 74-byte padded DER-encoded signature buffer
// `sig` must be the signature output from elliptic.js
/** @internal */
export const toPaddedDER = function (sig: EC.Signature): Buffer {
  // We use 74 as the maximum length of a DER signature. All sigs must
  // be right-padded with zeros so that this can be a fixed size field
  const b = Buffer.alloc(74);
  const ds = Buffer.from(sig.toDER());
  ds.copy(b);
  return b;
};

//--------------------------------------------------
// TRANSACTION UTILS
//--------------------------------------------------
/** @internal */
export const isValidAssetPath = function (
  path: number[],
  fwConstants: FirmwareConstants,
): boolean {
  const allowedPurposes = [
    PURPOSES.ETH,
    PURPOSES.BTC_LEGACY,
    PURPOSES.BTC_WRAPPED_SEGWIT,
    PURPOSES.BTC_SEGWIT,
  ];
  const allowedCoins = [COINS.ETH, COINS.BTC, COINS.BTC_TESTNET];
  // These coin types were given to us by MyCrypto. They should be allowed, but we expect
  // an Ethereum-type address with these coin types.
  // These all use SLIP44: https://github.com/satoshilabs/slips/blob/master/slip-0044.md
  const allowedMyCryptoCoins = [
    60, 61, 966, 700, 9006, 9000, 1007, 553, 178, 137, 37310, 108, 40, 889,
    1987, 820, 6060, 1620, 1313114, 76, 246529, 246785, 1001, 227, 916, 464,
    2221, 344, 73799, 246,
  ];
  // Make sure firmware supports this Bitcoin path
  const isBitcoin = path[1] === COINS.BTC || path[1] === COINS.BTC_TESTNET;
  const isBitcoinNonWrappedSegwit =
    isBitcoin && path[0] !== PURPOSES.BTC_WRAPPED_SEGWIT;
  if (isBitcoinNonWrappedSegwit && !fwConstants.allowBtcLegacyAndSegwitAddrs)
    return false;
  // Make sure this path is otherwise valid
  return (
    allowedPurposes.indexOf(path[0]) >= 0 &&
    (allowedCoins.indexOf(path[1]) >= 0 ||
      allowedMyCryptoCoins.indexOf(path[1] - HARDENED_OFFSET) > 0)
  );
};

/** @internal */
export const splitFrames = function (data: Buffer, frameSz: number): Buffer[] {
  const frames = [];
  const n = Math.ceil(data.length / frameSz);
  let off = 0;
  for (let i = 0; i < n; i++) {
    frames.push(data.slice(off, off + frameSz));
    off += frameSz;
  }
  return frames;
};

/** @internal */
function isBase10NumStr(x: string): boolean {
  const bn = new BigNum(x).toFixed().split('.').join('');
  const s = new String(x);
  // Note that the JS native `String()` loses precision for large numbers, but we only
  // want to validate the base of the number so we don't care about far out precision.
  return bn.slice(0, 8) === s.slice(0, 8);
}

/** @internal Ensure a param is represented by a buffer */
export const ensureHexBuffer = function (
  x: string | number | Buffer,
  zeroIsNull = true,
): Buffer {
  try {
    if (x === null || (x === 0 && zeroIsNull === true)) return Buffer.alloc(0);
    const isNumber =
      typeof x === 'number' || (typeof x === 'string' && isBase10NumStr(x));
    let hexString: string;
    if (isNumber) {
      hexString = new BigNum(x).toString(16);
    } else if (typeof x === 'string' && x.slice(0, 2) === '0x') {
      hexString = x.slice(2);
    } else if (Buffer.isBuffer(x)) {
      return x;
    } else {
      hexString = x.toString();
    }
    if (hexString.length % 2 > 0) hexString = `0${hexString}`;
    if (hexString === '00' && !isNumber) return Buffer.alloc(0);
    return Buffer.from(hexString, 'hex');
  } catch (err) {
    throw new Error(
      `Cannot convert ${x.toString()} to hex buffer (${(err as Error).message})`,
    );
  }
};

/** @internal */
export const fixLen = function (msg: Buffer, length: number): Buffer {
  const buf = Buffer.alloc(length);
  if (msg.length < length) {
    msg.copy(buf, length - msg.length);
    return buf;
  }
  return msg.slice(-length);
};

//--------------------------------------------------
// CRYPTO UTILS
//--------------------------------------------------
/** @internal */
export const aes256_encrypt = function (data: Buffer, key: Buffer): Buffer {
  const iv = Buffer.from(ProtocolConstants.aesIv);
  const aesCbc = new aes.ModeOfOperation.cbc(key, iv);
  const paddedData =
    data.length % 16 === 0 ? data : aes.padding.pkcs7.pad(data);
  return Buffer.from(aesCbc.encrypt(paddedData));
};

/** @internal */
export const aes256_decrypt = function (data: Buffer, key: Buffer): Buffer {
  const iv = Buffer.from(ProtocolConstants.aesIv);
  const aesCbc = new aes.ModeOfOperation.cbc(key, iv);
  return Buffer.from(aesCbc.decrypt(data));
};

// Decode a DER signature. Returns signature object {r, s } or null if there is an error
/** @internal */
export const parseDER = function (sigBuf: Buffer) {
  if (sigBuf[0] !== 0x30 || sigBuf[2] !== 0x02)
    throw new Error('Failed to decode DER signature');
  let off = 3;
  const rLen = sigBuf[off];
  off++;
  const r = sigBuf.slice(off, off + rLen);
  off += rLen;
  if (sigBuf[off] !== 0x02) throw new Error('Failed to decode DER signature');
  off++;
  const sLen = sigBuf[off];
  off++;
  const s = sigBuf.slice(off, off + sLen);
  return { r, s };
};

/** @internal */
export const getP256KeyPair = function (priv: Buffer | string): EC.KeyPair {
  if (ec === undefined) ec = new EC('p256');
  return ec.keyFromPrivate(priv, 'hex');
};

/** @internal */
export const getP256KeyPairFromPub = function (
  pub: Buffer | string,
): EC.KeyPair {
  if (ec === undefined) ec = new EC('p256');
  return ec.keyFromPublic(pub, 'hex');
};

/** @internal */
export const buildSignerPathBuf = function (
  signerPath: number[],
  varAddrPathSzAllowed: boolean,
): Buffer {
  const buf = Buffer.alloc(24);
  let off = 0;
  if (varAddrPathSzAllowed && signerPath.length > 5)
    throw new Error('Signer path must be <=5 indices.');
  if (!varAddrPathSzAllowed && signerPath.length !== 5)
    throw new Error(
      'Your Lattice firmware only supports 5-index derivation paths. Please upgrade.',
    );
  buf.writeUInt32LE(signerPath.length, off);
  off += 4;
  for (let i = 0; i < 5; i++) {
    if (i < signerPath.length) buf.writeUInt32LE(signerPath[i], off);
    else buf.writeUInt32LE(0, off);
    off += 4;
  }
  return buf;
};

//--------------------------------------------------
// OTHER UTILS
//--------------------------------------------------
/** @internal */
export const isAsciiStr = function (
  str: string,
  allowFormatChars = false,
): boolean {
  if (typeof str !== 'string') {
    return false;
  }
  const extraChars = allowFormatChars
    ? [
        0x0020, // Space
        0x000a, // New line
      ]
    : [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (extraChars.indexOf(c) < 0 && (c < 0x0020 || c > 0x007f)) {
      return false;
    }
  }
  return true;
};

/** @internal Check if a value exists in an object. Only checks first level of keys. */
export const existsIn = function <T>(
  val: T,
  obj: { [key: string]: T },
): boolean {
  return Object.keys(obj).some((key) => obj[key] === val);
};

/** @internal Create a buffer of size `n` and fill it with random data */
export const randomBytes = function (n: number): Buffer {
  const buf = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    buf[i] = Math.round(Math.random() * 255);
  }
  return buf;
};

/** @internal `isUInt4` accepts a number and returns true if it is a UInt4 */
export const isUInt4 = (n: number) => isInteger(n) && inRange(n, 0, 16);

/**
 * Fetches an external JSON file containing networks indexed by chain id from a GridPlus repo, and
 * returns the parsed JSON.
 */
async function fetchExternalNetworkForChainId(
  chainId: number | string,
): Promise<{
  [key: string]: {
    name: string;
    baseUrl: string;
    apiRoute: string;
  };
}> {
  try {
    const body = await fetch(EXTERNAL_NETWORKS_BY_CHAIN_ID_URL).then((res) =>
      res.json(),
    );
    if (body) {
      return body[chainId];
    } else {
      return undefined;
    }
  } catch (err) {
    console.warn('Fetching external networks failed.\n', err);
  }
}

/**
 * Builds a URL for fetching calldata from block explorers for any supported chains
 * */
function buildUrlForSupportedChainAndAddress({ supportedChain, address }) {
  const baseUrl = supportedChain.baseUrl;
  const apiRoute = supportedChain.apiRoute;
  const urlWithRoute = `${baseUrl}/${apiRoute}&address=${address}`;

  const apiKey = process.env.ETHERSCAN_KEY;
  const apiKeyParam = apiKey ? `&apiKey=${process.env.ETHERSCAN_KEY}` : '';

  return urlWithRoute + apiKeyParam;
}

/**
 * Takes a list of ABI data objects and a selector, and returns the earliest ABI data object that
 * matches the selector.
 */
export const selectDefFrom4byteABI = async (result: any[], selector: string): Promise<string[]> => {
  if (!selector || !result?.length) {
    throw new Error('Missing selector or 4byte data');
  }

  const cleanSelector = selector.toLowerCase().startsWith('0x') ? selector.slice(2).toLowerCase() : selector.toLowerCase();
  const match = result.find(item => item.hex_signature.slice(2).toLowerCase() === cleanSelector);

  if (!match) {
    throw new Error('No matching function found in 4byte data');
  }

  const { text_signature } = match;
  const [name, params] = text_signature.split('(');
  if (!name || !params) {
    throw new Error('Invalid function signature format');
  }

  const paramTypes = params.slice(0, -1).split(',').filter(Boolean);
  return [name, ...paramTypes];
};

export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number },
): Promise<Response> {
  const { timeout = 8000 } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(url, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  return response;
}

async function fetchAndCache(
  url: string,
  opts?: RequestInit,
): Promise<Response> {
  try {
    if (globalThis.caches && globalThis.Request) {
      const cache = await caches.open('gp-calldata');
      const request = new Request(url, opts);
      const match = await cache.match(request);
      if (match) {
        return match;
      } else {
        const response = await fetch(request, opts);
        const responseClone = response.clone();
        const data = await response.json();
        if (
          response.ok &&
          (isValidBlockExplorerResponse(data) || isValid4ByteResponse(data))
        ) {
          await cache.put(request, responseClone);
          return cache.match(request);
        }
        return response;
      }
    } else {
      return fetch(url, opts);
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function fetchSupportedChainData(
  address: string,
  supportedChain: {
    name: string;
    baseUrl: string;
    apiRoute: string;
  },
): Promise<any> {
  try {
    const url = buildUrlForSupportedChainAndAddress({ address, supportedChain });
    const res = await fetchAndCache(url);
    const body = await res.json();
    
    if (body && body.result) {
      return body.result;
    }
    console.warn('Server response was malformed');
    return null;
  } catch (error) {
    console.warn('Fetching data from external network failed:', error);
    return null;
  }
}

export async function fetch4byteData(selector: string): Promise<any> {
  try {
    const url = `https://www.4byte.directory/api/v1/signatures/?hex_signature=0x${selector}`;
    const res = await fetch(url);
    const body = await res.json();
    
    if (body && body.results) {
      return body.results;
    }
    console.warn('No results found in 4byte data');
    return null;
  } catch (err) {
    console.warn('Error fetching 4byte data:', err);
    return null;
  }
}

function encodeDef(def: any) {
  if (!def) return null;
  
  if (Array.isArray(def)) {
    const [functionName, ...params] = def;
    const abiParams = params.map((param, idx) => ({
      name: `param${idx}`,
      type: param,
    }));

    try {
      const encoded = AbiParameters.encode(abiParams, def);
      return Buffer.from(encoded.slice(2), 'hex');
    } catch (error) {
      console.warn('Failed to encode def:', error);
      return null;
    }
  }
  return def;
}

/**
 * Post-process fetched ABI definition.
 * @param def - Calldata decoder data definition for calling function
 * @param calldata - Raw transaction calldata
 * @return - Updated `def`
 */
async function postProcessDef(def: string[], calldata: Buffer): Promise<string[]> {
  if (!def?.length) return def;

  const [functionName, ...paramTypes] = def;
  const abiItem: AbiFunction = {
    type: 'function',
    name: functionName,
    inputs: paramTypes.map((type, idx) => ({ name: `param${idx}`, type })),
    outputs: [],
    stateMutability: 'nonpayable'
  };

  try {
    const decoded = decodeFunctionData({
      abi: [abiItem],
      data: `0x${calldata.toString('hex')}`
    });

    const nestedCalls = (decoded.args as unknown[]).reduce<string[]>((acc, arg) => {
      if (typeof arg === 'string' && arg.startsWith('0x')) {
        acc.push(arg);
      }
      return acc;
    }, []);

    if (nestedCalls.length) {
      const nestedDefs = await Promise.all(
        nestedCalls.map(async (nestedData) => {
          try {
            const result = await fetchCalldataDecoder(
              nestedData,
              '0x0000000000000000000000000000000000000000',
              '1',
              true
            );
            return result.def ? result.def.toString('hex') : null;
          } catch {
            return null;
          }
        })
      );

      return [functionName, ...nestedDefs.filter(Boolean)];
    }

    return def;
  } catch (err) {
    console.warn('Failed to post-process def:', err);
    return def;
  }
}

/**
 * Generates an application secret for use in maintaining connection to device.
 * @param deviceId - The device ID of the device you want to generate a token for.
 * @param password - The password entered when connecting to the device.
 * @param appName - The name of the application.
 * @returns an application secret as a Buffer
 * @public
 */
export const generateAppSecret = (
  deviceId: Buffer | string,
  password: Buffer | string,
  appName: Buffer | string,
): Buffer => {
  const deviceIdBuffer =
    typeof deviceId === 'string' ? Buffer.from(deviceId) : deviceId;
  const passwordBuffer =
    typeof password === 'string' ? Buffer.from(password) : password;
  const appNameBuffer =
    typeof appName === 'string' ? Buffer.from(appName) : appName;

  const preImage = Buffer.concat([
    deviceIdBuffer,
    passwordBuffer,
    appNameBuffer,
  ]);

  return Buffer.from(sha256().update(preImage).digest('hex'), 'hex');
};

/**
 * Get the `v` component of the signature as well as an `initV`
 * parameter, which is what you need to use to re-create an `@ethereumjs/tx`
 * object. There is a lot of tech debt in `@ethereumjs/tx` which also
 * inherits the tech debt of ethereumjs-util.
 * 1.  The legacy `Transaction` type can call `_processSignature` with the regular
 *     `v` value.
 * 2.  Newer transaction types such as `FeeMarketEIP1559Transaction` will subtract
 *     27 from the `v` that gets passed in, so we need to add `27` to create `initV`
 * @param tx - An @ethereumjs/tx Transaction object or Buffer (serialized tx)
 * @param resp - response from Lattice. Can be either legacy or generic signing variety
 * @returns bn.js BN object containing the `v` param
 */
export const getV = function (tx: any, resp: any) {
  let chainId, hash, type;
  const txIsBuf = Buffer.isBuffer(tx);
  if (txIsBuf) {
    hash = Buffer.from(keccak256(tx), 'hex');
    try {
      const legacyTxArray = RLP.decode(tx);
      if (legacyTxArray.length === 6) {
        chainId = null;
      } else {
        chainId = new BN(legacyTxArray[6] as Uint8Array);
      }
      type = 0;
    } catch {
      try {
        const txObj = EthTxFactory.fromSerializedData(tx);
        //@ts-expect-error -- Accessing private property
        type = txObj._type;
      } catch {
        throw new Error('Could not recover V. Bad transaction data.');
      }
    }
  } else {
    type = tx._type;
    hash = type
      ? tx.getMessageToSign(true)
      : RLP.encode(tx.getMessageToSign(false));
    if (tx.supports(Capability.EIP155ReplayProtection)) {
      chainId = tx.common.chainIdBN().toNumber();
    }
  }
  const rs = new Uint8Array(Buffer.concat([resp.sig.r, resp.sig.s]));
  const pubkey = new Uint8Array(resp.pubkey);
  const recovery0 = ecdsaRecover(rs, 0, hash, false);
  const recovery1 = ecdsaRecover(rs, 1, hash, false);
  const pubkeyStr = Buffer.from(pubkey).toString('hex');
  const recovery0Str = Buffer.from(recovery0).toString('hex');
  const recovery1Str = Buffer.from(recovery1).toString('hex');
  let recovery;
  if (pubkeyStr === recovery0Str) {
    recovery = 0;
  } else if (pubkeyStr === recovery1Str) {
    recovery = 1;
  } else {
    // If we fail a second time, exit here.
    throw new Error(
      'Failed to recover V parameter. Bad signature or transaction data.',
    );
  }
  // Newer transaction types just use the [0, 1] value
  if (type) {
    return new BN(recovery);
  }
  // If there is no chain ID, this is a pre-EIP155 tx
  if (!chainId) {
    return new BN(recovery).addn(27);
  }
  // EIP155 replay protection is included in the `v` param
  // and uses the chainId value.
  return chainId.muln(2).addn(35).addn(recovery);
};

// Main function
export const fetchCalldataDecoder = async (
  _data: string | Buffer | Uint8Array,
  _to: string,
  _chainId: string | number,
  isDebug = false,
): Promise<{ def: Buffer | null; abi: any }> => {
  try {
    const data = coerceBuffer(_data);
    const to = coerceHexString(_to);
    const chainId = coerceChainId(_chainId);

    const selector = data.slice(0, 4).toString('hex');
    let abi = null;
    let def = null;

    // Try to get ABI from supported chains first
    const supportedChain = await getSupportedChain(chainId);
    if (supportedChain) {
      const contractAbi = await fetchSupportedChainData(to, supportedChain);
      if (contractAbi) {
        try {
          const abiArray = typeof contractAbi === 'string' ? JSON.parse(contractAbi) : contractAbi;
          def = await selectDefFromABI(abiArray, selector);
          if (def && isDebug) {
            def = await postProcessDef(def, data);
          }
          // Store the full ABI for the matching function
          abi = abiArray.find((item: any) => {
            if (item.type !== 'function') return false;
            try {
              const encoded = encodeFunctionData({
                abi: [item],
                functionName: item.name,
                args: item.inputs.map(() => '0x')
              });
              return encoded.slice(0, 10).toLowerCase() === `0x${selector}`.toLowerCase();
            } catch {
              return false;
            }
          });
        } catch (err) {
          console.warn('Error parsing ABI:', err);
        }
      }
    }

    // If we couldn't get the ABI from supported chains, try 4byte
    if (!def) {
      try {
        const fourByteData = await fetch4byteData(selector);
        if (fourByteData?.length) {
          def = await selectDefFrom4byteABI(fourByteData, selector);
          if (def && isDebug) {
            def = await postProcessDef(def, data);
          }
          // For 4byte data, construct a minimal ABI
          if (def) {
            const [name, ...paramTypes] = def;
            abi = {
              type: 'function',
              name,
              inputs: paramTypes.map((type: string, i: number) => ({
                name: `param${i}`,
                type
              })),
              outputs: [],
              stateMutability: 'nonpayable'
            };
          }
        }
      } catch (err) {
        console.warn('Error fetching 4byte data:', err);
      }
    }

    // Convert def to RLP encoded buffer if we have one
    if (def) {
      try {
        const encodedDef = Buffer.from(RLP.encode([
          Buffer.from(def[0]), // Function name
          ...def.slice(1).map((type: string) => Buffer.concat([
            Buffer.from('#'),
            Buffer.from(type),
            Buffer.from([0])
          ]))
        ]));

        return { abi, def: encodedDef };
      } catch (err) {
        console.warn('Error encoding def:', err);
      }
    }

    return { def: null, abi: null };
  } catch (err) {
    console.warn('Error in fetchCalldataDecoder:', err);
    return { def: null, abi: null };
  }
};

/** @internal */
export const EXTERNAL = {
  fetchCalldataDecoder,
  generateAppSecret,
  getV,
};

// Helper functions for type coercion
const coerceBuffer = (_data: string | Buffer | Uint8Array): Buffer => {
  if (Buffer.isBuffer(_data)) return _data;
  if (typeof _data === 'string') {
    return _data.startsWith('0x') 
      ? Buffer.from(_data.slice(2), 'hex')
      : Buffer.from(_data);
  }
  return Buffer.from(_data);
};

const coerceHexString = (_str: string): string => {
  return _str.startsWith('0x') ? _str : `0x${_str}`;
};

const coerceChainId = (_chainId: string | number): number => {
  return typeof _chainId === 'string' ? parseInt(_chainId, 10) : _chainId;
};

export async function getSupportedChain(chainId: number | string): Promise<{
  name: string;
  baseUrl: string;
  apiRoute: string;
} | null> {
  try {
    const networks = await fetchExternalNetworkForChainId(chainId);
    if (!networks) return null;
    
    // Get first network from the response
    const network = Object.values(networks)[0];
    if (!network) return null;
    
    return {
      name: network.name,
      baseUrl: network.baseUrl,
      apiRoute: network.apiRoute
    };
  } catch (err) {
    console.warn('Error getting supported chain:', err);
    return null;
  }
}

const selectDefFromABI = async (abi: any[], selector: string): Promise<string[]> => {
  try {
    const abiItem = abi.find((item) => {
      if (item.type !== 'function') return false;
      try {
        const encoded = encodeFunctionData({
          abi: [item],
          functionName: item.name,
          args: item.inputs.map(() => '0x')
        });
        return encoded.slice(0, 10).toLowerCase() === `0x${selector}`.toLowerCase();
      } catch {
        return false;
      }
    });

    if (!abiItem) {
      throw new Error('No matching function found in ABI');
    }

    return [abiItem.name, ...abiItem.inputs.map(input => input.type)];
  } catch (err) {
    throw new Error(`Failed to parse ABI: ${err.message}`);
  }
};

export const decodeAbiParameters = (
  types: AbiParameter[],
  data: string | Buffer,
  nested = false,
): any[] => {
  const hexData = Buffer.isBuffer(data)
    ? (`0x${data.toString('hex')}` as `0x${string}`)
    : (data as `0x${string}`);

  const abiFunction: AbiFunction = {
    type: 'function',
    name: 'decode',
    inputs: types,
    outputs: [],
    stateMutability: 'pure',
  };

  try {
    const decoded = decodeFunctionData({
      abi: [abiFunction],
      data: hexData,
    });

    return decoded.args.map((param: any) => {
      if (Buffer.isBuffer(param)) {
        return param;
      }
      if (typeof param === 'bigint') {
        return param.toString();
      }
      if (
        nested &&
        Array.isArray(param) &&
        param.every((p) => typeof p === 'string' && p.startsWith('0x'))
      ) {
        return param.map((p) => decodeAbiParameters(types, p, true));
      }
      return param;
    });
  } catch (error) {
    console.warn('Failed to decode ABI parameters:', error);
    return Array(types.length).fill(null);
  }
};

export const formatAbiParameter = (param: AbiParameter, value: any): any => {
  try {
    const abiFunction: AbiFunction = {
      type: 'function',
      name: 'format',
      inputs: [param],
      outputs: [],
      stateMutability: 'pure',
    };

    const encoded = encodeFunctionData({
      abi: [abiFunction],
      args: [value],
    });

    const decoded = decodeFunctionData({
      abi: [abiFunction],
      data: encoded,
    });

    return decoded.args[0];
  } catch (error) {
    console.warn('Failed to format ABI parameter:', error);
    return value;
  }
};

export const formatAbiDefinition = (
  def: { name?: string; inputs?: AbiParameter[] },
  params: any[],
): { name: string; params: any } => {
  if (!def.inputs) {
    return { name: def.name || 'unknown', params: {} };
  }

  try {
    const abiFunction: AbiFunction = {
      type: 'function',
      name: def.name || 'unknown',
      inputs: def.inputs,
      outputs: [],
      stateMutability: 'pure',
    };

    const encoded = encodeFunctionData({
      abi: [abiFunction],
      args: params,
    });

    const decoded = decodeFunctionData({
      abi: [abiFunction],
      data: encoded,
    });

    const formattedParams = def.inputs.reduce(
      (acc: any, param: AbiParameter, i: number) => {
        acc[param.name || `param${i}`] = decoded.args[i];
        return acc;
      },
      {},
    );

    return {
      name: def.name || 'unknown',
      params: formattedParams,
    };
  } catch (error) {
    console.warn('Failed to format ABI definition:', error);
    return { name: def.name || 'unknown', params: {} };
  }
};
