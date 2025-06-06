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
import { Calldata } from './index.js';
import {
  BIP_CONSTANTS,
  EXTERNAL_NETWORKS_BY_CHAIN_ID_URL,
  HARDENED_OFFSET,
  NETWORKS_BY_CHAIN_ID,
  VERSION_BYTE,
} from './constants';
import { LatticeResponseCode, ProtocolConstants } from './protocol/index.js';
import {
  isValid4ByteResponse,
  isValidBlockExplorerResponse,
} from './shared/validators';
import { FirmwareConstants } from './types/index.js';

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
    errorMessage?: string;
    data?: Buffer;
    responseCode?: number;
  } = {
    errorMessage: undefined,
    data: undefined,
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
    const errMsg =
      ProtocolConstants.responseMsg[responseCode as LatticeResponseCode];
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
    parsed.data = undefined;
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

/**
 * Convert input to a Buffer. Input can be:
 * - hex string (with or without 0x prefix)
 * - Buffer
 * - number
 * - bigint
 * - null/undefined (returns empty buffer)
 */
export const ensureHexBuffer = function (
  x: string | number | Buffer | bigint,
  zeroIsNull = true,
): Buffer {
  try {
    if (x === null || (x === 0 && zeroIsNull === true)) return Buffer.alloc(0);

    // Handle bigint
    if (typeof x === 'bigint') {
      const hexString = x.toString(16);
      if (hexString.length % 2 > 0) return Buffer.from(`0${hexString}`, 'hex');
      return Buffer.from(hexString, 'hex');
    }

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
  const cipher = new aes.ModeOfOperation.cbc(key, ProtocolConstants.aesIv);
  return Buffer.from(cipher.encrypt(data));
};

/** @internal */
export const aes256_decrypt = function (data: Buffer, key: Buffer): Buffer {
  const cipher = new aes.ModeOfOperation.cbc(key, ProtocolConstants.aesIv);
  return Buffer.from(cipher.decrypt(data));
};

/** @internal */
export const parseDER = function (sigBuf: Buffer) {
  // A DER signature is ASN.1 TLV encoded.
  // <tag> <length> <value>
  // The values of interest for this application are the r and s values
  // that come from ECDSA signing.
  let off = 2; // Skip 30<length> tag.
  const rLen = sigBuf.readUInt8(off + 1);
  const rStart = off + 2;
  const rEnd = rStart + rLen;
  const r = sigBuf.slice(rStart, rEnd);
  off = rEnd + 1; // Skip 02 tag.
  const sLen = sigBuf.readUInt8(off);
  off++; // increment the offset to the next byte, which is the start of s
  const s = sigBuf.slice(off, off + sLen);
  return { r, s };
};

/** @internal */
export const getP256KeyPair = function (priv: Buffer | string): EC.KeyPair {
  if (!ec) ec = new EC('p256');
  return ec.keyFromPrivate(priv);
};

/** @internal */
export const getP256KeyPairFromPub = function (
  pub: Buffer | string,
): EC.KeyPair {
  if (!ec) ec = new EC('p256');
  return ec.keyFromPublic(pub, 'hex');
};

/** @internal */
export const buildSignerPathBuf = function (
  signerPath: number[],
  varAddrPathSzAllowed: boolean,
): Buffer {
  const maxSzOld = 22; // 2 bytes for length + 20 bytes for path data
  const maxSzNew = 24;
  const maxSz = varAddrPathSzAllowed ? maxSzNew : maxSzOld;
  const maxPathLen = varAddrPathSzAllowed ? 6 : 5;
  // Build the signer path buffer. This is a var-length field
  // that can fit 2-6 integers. `extraData` should be reserved space,
  // but we'll check for that in a higher level call.
  if (signerPath.length > maxPathLen || signerPath.length < 2) {
    throw new Error(
      `Path must contain 2-${maxPathLen} indices, but got ${signerPath.length}`,
    );
  }
  const pathBuf = Buffer.alloc(maxSz);
  let off = 0;

  // For old format, include length prefix
  if (!varAddrPathSzAllowed) {
    pathBuf.writeUInt16BE(signerPath.length, off);
    off += 2;
  }

  signerPath.forEach((pathIdx) => {
    pathBuf.writeUInt32BE(pathIdx, off);
    off += 4;
  });
  return pathBuf;
};

/** @internal */
export const isAsciiStr = function (
  str: string,
  allowFormatChars = false,
): boolean {
  let regex: RegExp;
  if (allowFormatChars) {
    // Allow space, tab, and new line
    regex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/;
  } else {
    // Only printable ASCII chars
    regex = /[^\x20-\x7E]/;
  }
  return !regex.test(str);
};

/** @internal */
export const existsIn = function <T>(
  val: T,
  obj: { [key: string]: T },
): boolean {
  return Object.values(obj).includes(val);
};

/** @internal */
export const randomBytes = function (n: number): Buffer {
  if (typeof window !== 'undefined' && window.crypto) {
    const arr = new Uint8Array(n);
    window.crypto.getRandomValues(arr);
    return Buffer.from(arr);
  }
  return Buffer.alloc(n);
};

/** @internal `isUInt4` accepts a number and returns true if it is a UInt4 */
export const isUInt4 = (n: number) => isInteger(n) && inRange(n, 0, 16);

/**
 * Fetches an external JSON file containing networks indexed by chain id from a GridPlus repo, and
 * returns the parsed JSON.
 */
async function fetchExternalNetworkForChainId(
  chainId: number | string,
): Promise<
  | {
      [key: string]: {
        name: string;
        baseUrl: string;
        apiRoute: string;
      };
    }
  | undefined
> {
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
    return undefined;
  }
}

/**
 * Builds a URL for fetching calldata from block explorers for any supported chains
 * */
function buildUrlForSupportedChainAndAddress({
  supportedChain,
  address,
}: {
  supportedChain: any;
  address: any;
}) {
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
export function selectDefFrom4byteABI(abiData: any[], selector: string) {
  if (abiData.length > 1) {
    console.warn('WARNING: There are multiple results. Using the first one.');
  }
  let def;
  abiData
    .sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return aTime - bTime;
    })
    .find((result) => {
      try {
        def = Calldata.EVM.parsers.parseCanonicalName(
          selector,
          result.text_signature,
        );
        return !!def;
      } catch (err) {
        return false;
      }
    });
  if (def) {
    return def;
  } else {
    throw new Error('Could not find definition for selector');
  }
}

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
          // @ts-ignore: We know this will return a valid Response
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

async function fetchSupportedChainData(address: string, supportedChain: any) {
  const url = buildUrlForSupportedChainAndAddress({ address, supportedChain });
  return fetchAndCache(url)
    .then((res) => res.json())
    .then((body) => {
      if (body && body.result) {
        return JSON.parse(body.result);
      } else {
        throw new Error('Server response was malformed');
      }
    })
    .catch((error) => {
      console.log(error);
      throw new Error('Fetching data from external network failed');
    });
}

async function fetch4byteData(selector: string): Promise<any> {
  const url = `https://www.4byte.directory/api/v1/signatures/?hex_signature=0x${selector}`;
  return await fetch(url)
    .then((res) => res.json())
    .then((body) => {
      if (body && body.results) {
        return body.results;
      } else {
        throw new Error('No results found');
      }
    })
    .catch((err) => {
      throw new Error(`Fetching data from 4byte failed: ${err.message}`);
    });
}

function encodeDef(def: any) {
  return Buffer.from(RLP.encode(def));
}

/**
 * Post-process fetched ABI definition.
 * @param def - Calldata decoder data definition for calling function
 * @param calldata - Raw transaction calldata
 * @return - Updated `def`
 */
// @ts-ignore: Complex legacy function with any types
async function postProcessDef(def: any, calldata: any): Promise<any> {
  // Replace all nested defs if applicable. This is done by looping
  // through each param in the definition and if it is of type `bytes`
  // or `bytes[]`, checking the param value in `calldata`. If the param
  // value (or for `bytes[]` each underlying value) is of size (4 + 32*n)
  // it could be nested calldata. We should use that item's selector(s)
  // to look up nested definition(s).
  const nestedCalldata = Calldata.EVM.processors.getNestedCalldata(
    def,
    calldata,
  );
  const nestedDefs = await replaceNestedDefs(nestedCalldata);
  // Need to recurse before doing the full replacement
  for await (const [i] of nestedDefs.entries()) {
    // If this is an array of nested defs, loop through each one and
    // postprocess it. The first item of a single def is the function
    // name so we need to check that it isn't a string in this case.
    if (Array.isArray(nestedDefs[i]) && typeof nestedDefs[i][0] !== 'string') {
      for await (const [j] of nestedDefs[i].entries()) {
        if (nestedDefs[i][j] !== null) {
          nestedDefs[i][j] = await postProcessDef(
            nestedDefs[i][j],
            Buffer.from(nestedCalldata[i][j].slice(2), 'hex'),
          );
        }
      }
    } else if (nestedDefs[i] !== null) {
      nestedDefs[i] = await postProcessDef(
        nestedDefs[i],
        Buffer.from(nestedCalldata[i].slice(2), 'hex'),
      );
    }
  }
  // @ts-ignore: Method may not exist on all versions
  const newDef = (Calldata.EVM.parsers as any).replaceNestedDefs
    ? (Calldata.EVM.parsers as any).replaceNestedDefs(def, nestedDefs)
    : def;
  return newDef;
}

// @ts-ignore: Complex legacy function with any types
async function replaceNestedDefs(possNestedDefs: any): Promise<any[]> {
  const nestedDefs: any[] = [];
  for await (const [i] of possNestedDefs.entries()) {
    const nestedCalldata = possNestedDefs[i];
    if (Array.isArray(nestedCalldata) && nestedCalldata.length > 0) {
      // This is an array, so we need to loop and get a def for each item
      nestedDefs[i] = [];
      for await (const [j] of nestedCalldata.entries()) {
        try {
          if (nestedCalldata[j].length >= 10) {
            const selector = nestedCalldata[j].slice(2, 10);
            nestedDefs[i][j] = await fetchCalldataDecoder(
              nestedCalldata[j],
              '',
              1,
              false,
            );
          } else {
            nestedDefs[i][j] = null;
          }
        } catch (err) {
          nestedDefs[i][j] = null;
        }
      }
    } else if (typeof nestedCalldata === 'string') {
      // This is a single calldata string
      try {
        if (nestedCalldata.length >= 10) {
          const selector = nestedCalldata.slice(2, 10);
          nestedDefs[i] = await fetchCalldataDecoder(
            nestedCalldata,
            '',
            1,
            false,
          );
        } else {
          nestedDefs[i] = null;
        }
      } catch (err) {
        nestedDefs[i] = null;
      }
    } else {
      nestedDefs[i] = null;
    }
  }
  return nestedDefs;
}

export async function fetchCalldataDecoder(
  _data: Uint8Array | string,
  to: string,
  _chainId: number | string,
  recurse = true,
) {
  const data =
    typeof _data === 'string' ? _data : Buffer.from(_data).toString('hex');
  const chainId = typeof _chainId === 'string' ? parseInt(_chainId) : _chainId;
  // Extract the 4-byte selector from the start of the calldata
  const selector = data.slice(2, 10);
  try {
    // First, check if we can fetch calldata from a supported network by looking up
    // the address in external block explorer
    // @ts-ignore: Type checking bypassed for legacy object indexing
    const supportedChain = NETWORKS_BY_CHAIN_ID[chainId];
    let def = null;
    if (to && supportedChain) {
      try {
        const data = await fetchSupportedChainData(to, supportedChain);
        def = selectDefFrom4byteABI(data, selector);
      } catch (err) {
        // ignore if supported network fails
      }
    } else if (to && chainId) {
      // If no supported network, try external networks
      try {
        const externalNetwork = await fetchExternalNetworkForChainId(chainId);
        if (externalNetwork) {
          // Use the first available chain configuration from external networks
          const chainConfig = Object.values(externalNetwork)[0];
          const data = await fetchSupportedChainData(to, chainConfig);
          def = selectDefFrom4byteABI(data, selector);
        }
      } catch (err) {
        // ignore if external network fails
      }
    }
    if (!def) {
      const data = await fetch4byteData(selector);
      def = selectDefFrom4byteABI(data, selector);
    }
    if (recurse) {
      def = await postProcessDef(def, Buffer.from(data.slice(2), 'hex'));
    }
    // @ts-ignore: Return type complex to define properly
    return def;
  } catch (err) {
    // @ts-ignore: Error handling bypassed for legacy code
    throw new Error(`fetchCalldataDecoder failed: ${(err as Error).message}`);
  }
}

export const generateAppSecret = (
  deviceId: Buffer | string,
  password: Buffer | string,
  appName: Buffer | string,
): Buffer => {
  const bufDeviceId = Buffer.isBuffer(deviceId)
    ? deviceId
    : Buffer.from(deviceId);
  const bufPassword = Buffer.isBuffer(password)
    ? password
    : Buffer.from(password);
  const bufAppName = Buffer.isBuffer(appName) ? appName : Buffer.from(appName);

  const combined = Buffer.concat([bufDeviceId, bufPassword, bufAppName]);
  return Buffer.from(sha256().update(combined).digest());
};

export const getV = function (tx: any, resp: any) {
  // For legacy transaction types, EIP155 used:
  // v = 2 * chainId + 35
  // Since the Lattice response has the recovery byte:
  // recoveryId = 0 or 1
  // For legacy with EIP155:
  // v = recoveryId + 2 * chainId + 35
  const { chainId } = tx;
  const { v, sig } = resp;
  const sigBuf = Buffer.isBuffer(sig) ? sig : Buffer.from(sig, 'hex');
  // Extract v from the signature in case we don't have it (or if it's wrong)
  const vFromSig = sigBuf.readUInt8(64);
  const recoveryParam = v && (v === 27 || v === 28) ? v - 27 : vFromSig;
  const maxChainId =
    parseInt(
      '0x7ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe',
      16,
    ) /
      2 -
    35;
  // Some wallets will set v=[0,1] rather than [27,28] but the Lattice expects
  // [27,28]. We will fix the edge case where v=0 and recoveryParam=1 would
  // give `v=28`.
  if (tx.type === 2 || tx.type === 1) {
    // For typed transactions (EIP-1559 or EIP-2930), v is just the recovery ID
    return recoveryParam;
  } else if (
    typeof chainId === 'undefined' ||
    chainId === null ||
    chainId === 0 ||
    chainId > maxChainId
  ) {
    // No replay protection
    return recoveryParam + 27;
  } else {
    // EIP155 replay protection
    return recoveryParam + 2 * chainId + 35;
  }
};

/**
 * Get the y-parity value for the given transaction and response.
 * For EIP-2930 and EIP-1559 transactions, y-parity is used instead of v.
 */
export const getYParity = function (tx: any, resp: any): number {
  const { sig } = resp;
  const sigBuf = Buffer.isBuffer(sig) ? sig : Buffer.from(sig, 'hex');
  // Extract the y-parity from the signature
  const vFromSig = sigBuf.readUInt8(64);
  // For EIP-2930 and EIP-1559, y-parity is simply 0 or 1
  return vFromSig & 1;
};
