// Static utility functions
import { Capability, TransactionFactory as EthTxFactory } from '@ethereumjs/tx';
import aes from 'aes-js';
import BigNum from 'bignumber.js';
import { BN } from 'bn.js';
import crc32 from 'crc-32';
import elliptic from 'elliptic';
import { sha256 } from 'hash.js/lib/hash/sha';
import { keccak256 } from 'js-sha3';
import inRange from 'lodash/inRange';
import isInteger from 'lodash/isInteger';
import { decode as rlpDecode, encode as rlpEncode } from 'rlp';
import { ecdsaRecover } from 'secp256k1';
import { Calldata } from '.';
import superagent from 'superagent'
import {
  AES_IV,
  BIP_CONSTANTS,
  NETWORKS_BY_CHAIN_ID,
  HARDENED_OFFSET,
  responseCodes,
  responseMsgs,
  VERSION_BYTE,
  EXTERNAL_NETWORKS_BY_CHAIN_ID_URL,
} from './constants';
const { COINS, PURPOSES } = BIP_CONSTANTS;
const EC = elliptic.ec;
let ec;

//--------------------------------------------------
// LATTICE UTILS
//--------------------------------------------------

/** @internal Parse a response from the Lattice1 */
export const parseLattice1Response = function (r): {
  errorMessage?: string;
  responseCode?: number;
  data?: any;
} {
  const parsed: any = {
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
  if (responseCode !== responseCodes.RESP_SUCCESS) {
    parsed.errorMessage = `${responseMsgs[responseCode] ? responseMsgs[responseCode] : 'Unknown Error'
      } (Lattice)`;
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
export const checksum = function (x) {
  // crc32 returns a signed integer - need to cast it to unsigned
  // Note that this uses the default 0xedb88320 polynomial
  return crc32.buf(x) >>> 0; // Need this to be a uint, hence the bit shift
}

// Get a 74-byte padded DER-encoded signature buffer
// `sig` must be the signature output from elliptic.js
/** @internal */
export const toPaddedDER = function (sig) {
  // We use 74 as the maximum length of a DER signature. All sigs must
  // be right-padded with zeros so that this can be a fixed size field
  const b = Buffer.alloc(74);
  const ds = Buffer.from(sig.toDER());
  ds.copy(b);
  return b;
}

//--------------------------------------------------
// TRANSACTION UTILS
//--------------------------------------------------
/** @internal */
export const isValidAssetPath = function (path, fwConstants) {
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
}

/** @internal */
export const splitFrames = function (data, frameSz) {
  const frames = [];
  const n = Math.ceil(data.length / frameSz);
  let off = 0;
  for (let i = 0; i < n; i++) {
    frames.push(data.slice(off, off + frameSz));
    off += frameSz;
  }
  return frames;
}

/** @internal */
function isBase10NumStr (x) {
  const bn = new BigNum(x).toString().split('.').join('');
  const s = new String(x);
  // Note that the JS native `String()` loses precision for large numbers, but we only
  // want to validate the base of the number so we don't care about far out precision.
  return bn.slice(0, 8) === s.slice(0, 8);
}

/** @internal Ensure a param is represented by a buffer */
export const ensureHexBuffer = function (x, zeroIsNull = true) {
  try {
    // For null values, return a 0-sized buffer. For most situations we assume
    // 0 should be represented with a zero-length buffer (e.g. for RLP-building
    // txs), but it can also be treated as a 1-byte buffer (`00`) if needed
    if (x === null || (x === 0 && zeroIsNull === true)) return Buffer.alloc(0);
    const isNumber = typeof x === 'number' || isBase10NumStr(x);
    // Otherwise try to get this converted to a hex string
    if (isNumber) {
      // If this is a number or a base-10 number string, convert it to hex
      x = `${new BigNum(x).toString(16)}`;
    } else if (typeof x === 'string' && x.slice(0, 2) === '0x') {
      x = x.slice(2);
    } else {
      x = x.toString('hex');
    }
    if (x.length % 2 > 0) x = `0${x}`;
    if (x === '00' && !isNumber) return Buffer.alloc(0);
    return Buffer.from(x, 'hex');
  } catch (err) {
    throw new Error(
      `Cannot convert ${x.toString()} to hex buffer (${err.toString()})`
    );
  }
}

/** @internal */
export const fixLen = function (msg, length) {
  const buf = Buffer.alloc(length);
  if (msg.length < length) {
    msg.copy(buf, length - msg.length);
    return buf;
  }
  return msg.slice(-length);
}

//--------------------------------------------------
// CRYPTO UTILS
//--------------------------------------------------
/** @internal */
export const aes256_encrypt = function (data, key) {
  const iv = Buffer.from(AES_IV);
  const aesCbc = new aes.ModeOfOperation.cbc(key, iv);
  const paddedData =
    data.length % 16 === 0 ? data : aes.padding.pkcs7.pad(data);
  return Buffer.from(aesCbc.encrypt(paddedData));
}

/** @internal */
export const aes256_decrypt = function (data, key) {
  const iv = Buffer.from(AES_IV);
  const aesCbc = new aes.ModeOfOperation.cbc(key, iv);
  return Buffer.from(aesCbc.decrypt(data));
}

// Decode a DER signature. Returns signature object {r, s } or null if there is an error
/** @internal */
export const parseDER = function (sigBuf: Buffer) {
  if (sigBuf[0] !== 0x30 || sigBuf[2] !== 0x02) throw new Error('Failed to decode DER signature');
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
}

/** @internal */
export const getP256KeyPair = function (priv) {
  if (ec === undefined) ec = new EC('p256');
  return ec.keyFromPrivate(priv, 'hex');
}

/** @internal */
export const getP256KeyPairFromPub = function (pub) {
  if (ec === undefined) ec = new EC('p256');
  return ec.keyFromPublic(pub, 'hex');
}

/** @internal */
export const buildSignerPathBuf = function (signerPath, varAddrPathSzAllowed) {
  const buf = Buffer.alloc(24);
  let off = 0;
  if (varAddrPathSzAllowed && signerPath.length > 5)
    throw new Error('Signer path must be <=5 indices.');
  if (!varAddrPathSzAllowed && signerPath.length !== 5)
    throw new Error(
      'Your Lattice firmware only supports 5-index derivation paths. Please upgrade.'
    );
  buf.writeUInt32LE(signerPath.length, off);
  off += 4;
  for (let i = 0; i < 5; i++) {
    if (i < signerPath.length) buf.writeUInt32LE(signerPath[i], off);
    else buf.writeUInt32LE(0, off);
    off += 4;
  }
  return buf;
}

//--------------------------------------------------
// OTHER UTILS
//--------------------------------------------------
/** @internal */
export const isAsciiStr = function (str, allowFormatChars = false) {
  if (typeof str !== 'string') {
    return false;
  }
  const extraChars = allowFormatChars ?
    [
      0x0020, // Space
      0x000a, // New line
    ] : [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (extraChars.indexOf(c) < 0 && (c < 0x0020 || c > 0x007f)) {
      return false;
    }
  }
  return true;
}

/** @internal Check if a value exists in an object. Only checks first level of keys. */
export const existsIn = function (val, obj) {
  return Object.keys(obj).some(key => obj[key] === val);
}

/** @internal Create a buffer of size `n` and fill it with random data */
export const randomBytes = function (n) {
  const buf = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    buf[i] = Math.round(Math.random() * 255);
  }
  return buf;
}

/** @internal `isUInt4` accepts a number and returns true if it is a UInt4 */
export const isUInt4 = (n: number) => isInteger(n) && inRange(n, 0, 16)

/**
 * Generates an application secret for use in maintaining connection to device.
 * @param {Buffer} deviceId - The device ID of the device you want to generate a token for.
 * @param {Buffer} password - The password entered when connecting to the device.
 * @param {Buffer} appName - The name of the application.
 * @returns an application secret as a Buffer
 * @public
 */
export const generateAppSecret = (
  deviceId: Buffer,
  password: Buffer,
  appName: Buffer
): Buffer => {
  const preImage = Buffer.concat([
    deviceId,
    password,
    appName,
  ]);

  return Buffer.from(sha256().update(preImage).digest('hex'), 'hex');
}

/**
 * Generic signing does not return a `v` value like legacy ETH signing requests did.
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
export const getV = function (tx, resp) {
  let chainId, hash, type;
  const txIsBuf = Buffer.isBuffer(tx);
  if (txIsBuf) {
    hash = Buffer.from(keccak256(tx), 'hex');
    try {
      const legacyTxArray = rlpDecode(tx);
      if (legacyTxArray.length === 6) {
        // Six item array means this is a pre-EIP155 transaction
        chainId = null;
      } else {
        // Otherwise the `v` param is the `chainId`
        chainId = new BN(legacyTxArray[6] as Uint8Array);
      }
      // Legacy tx = type 0
      type = 0;
    } catch (err) {
      // This is likely a typed transaction
      try {
        const txObj = EthTxFactory.fromSerializedData(tx);
        //@ts-expect-error -- Accessing private property
        type = txObj._type;
      } catch (err) {
        // If we can't RLP decode and can't hydrate an @ethereumjs/tx object,
        // we don't know what this is and should abort.
        throw new Error('Could not recover V. Bad transaction data.');
      }
    }
  } else {
    // @ethereumjs/tx object passed in
    type = tx._type;
    hash = type ?
      tx.getMessageToSign(true) :             // newer tx types
      rlpEncode(tx.getMessageToSign(false));  // legacy tx
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
    throw new Error('Failed to recover V parameter. Bad signature or transaction data.');
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
}

/**
 * Fetches an external JSON file containing networks indexed by chain id from a GridPlus repo, and
 * returns the parsed JSON.
 */
async function fetchExternalNetworkForChainId (
  chainId: number | string,
): Promise<{
  [key: string]: {
    name: string;
    baseUrl: string;
    apiRoute: string;
  };
}> {
  try {
    const response = await superagent.get(EXTERNAL_NETWORKS_BY_CHAIN_ID_URL);
    if (response && response.body) {
      return response.body[chainId];
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
function buildUrlForSupportedChainAndAddress ({ supportedChain, address }) {
  const baseUrl = supportedChain.baseUrl;
  const apiRoute = supportedChain.apiRoute;
  const urlWithRoute = `${baseUrl}/${apiRoute}&address=${address}`;

  const apiKey = process.env.ETHERSCAN_KEY;
  const apiKeyParam = apiKey ? `&apiKey=${process.env.ETHERSCAN_KEY}` : '';

  return urlWithRoute + apiKeyParam
}

/**
 * Takes a list of ABI data objects and a selector, and returns the earliest ABI data object that
 * matches the selector.
 */
export function selectDefFrom4byteABI (abiData: any[], selector: string) {
  try {
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
          )
          return !!def
        }
        catch (err) {
          return false
        }
      })
    return def ?? null;
  }
  catch (err) {
    console.warn(err.message)
    return null
  }
}

/**
 *  Fetches calldata from a remote scanner based on the transaction's `chainId`
 */
export async function fetchCalldataDecoder (_data: Uint8Array | string, to: string, _chainId: number | string) {
  try {
    // Exit if there is no data. The 2 comes from the 0x prefix, but a later
    // check will confirm that there are at least 4 bytes of data in the buffer.
    if (!_data || _data.length < 2) {
      throw new Error('Data is either undefined or less than two bytes')
    }
    const isHexString = typeof _data === 'string' && _data.slice(0, 2) === '0x'
    const data = isHexString ?
      Buffer.from(_data.slice(2), 'hex') :
      //@ts-expect-error - Buffer doesn't recognize Uint8Array type properly
      Buffer.from(_data, 'hex');

    if (data.length < 4) {
      throw new Error('Data must contain at least 4 bytes of data to define the selector')
    }
    const selector = Buffer.from(data.slice(0, 4)).toString('hex');
    // Convert the chainId to a number and use it to determine if we can call out to
    // an etherscan-like explorer for richer data.
    const chainId = Number(_chainId);
    const cachedNetwork = NETWORKS_BY_CHAIN_ID[chainId];
    const supportedChain = cachedNetwork
      ? cachedNetwork
      : await fetchExternalNetworkForChainId(chainId);

    try {
      if (supportedChain) {
        const url = buildUrlForSupportedChainAndAddress({ supportedChain, address: to })
        return await superagent
          .get(url)
          .then(res => {
            if (res && res.body && res.body.result) {
              const abi = JSON.parse(res.body.result)
              const def = Calldata.EVM.parsers.parseSolidityJSONABI(selector, abi)
              return { abi, def }
            } else {
              throw new Error('Server response was malformed')
            }
          }).catch(() => {
            throw new Error('Fetching data from external network failed')
          })
      } else {
        throw new Error(`Chain (id: ${chainId}) is not supported`)
      }
    } catch (err) {
      console.warn(err.message, '\n', 'Falling back to 4byte');
    }

    // Fallback to checking 4byte
    const url = `https://www.4byte.directory/api/v1/signatures?hex_signature=0x${selector}`
    return await superagent
      .get(url)
      .then(res => {
        if (res && res.body && res.body.results && res.body.results.length) {
          const abi = res.body.results
          const def = selectDefFrom4byteABI(abi, selector)
          return { abi, def }
        } else {
          throw new Error('No results found')
        }
      }).catch(err => {
        throw new Error(`Fetching data from 4byte failed: ${err.message}`)
      })
  } catch (err) {
    console.warn(`Fetching calldata failed: ${err.message}`)
  }
  return { def: null, abi: null }
}

/** @internal */
export const EXTERNAL = {
  getV,
  generateAppSecret,
  fetchCalldataDecoder
}
