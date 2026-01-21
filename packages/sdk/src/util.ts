import { Buffer } from 'node:buffer'
// Static utility functions
import { RLP } from '@ethereumjs/rlp'
import aes from 'aes-js'
import BigNum from 'bignumber.js'
import { BN } from 'bn.js'
import crc32 from 'crc-32'
import elliptic from 'elliptic'
import inRange from 'lodash/inRange.js'
import isInteger from 'lodash/isInteger.js'
import { Hash } from 'ox'
import secp256k1 from 'secp256k1'
import { type Hex, parseTransaction } from 'viem'

const EC = elliptic.ec
const { ecdsaRecover } = secp256k1
import { Calldata } from '.'
import {
  BIP_CONSTANTS,
  EXTERNAL_NETWORKS_BY_CHAIN_ID_URL,
  HARDENED_OFFSET,
  NETWORKS_BY_CHAIN_ID,
  VERSION_BYTE,
} from './constants'
import { LatticeResponseCode, ProtocolConstants } from './protocol'
import {
  isValid4ByteResponse,
  isValidBlockExplorerResponse,
} from './shared/validators'
import type { FirmwareConstants } from './types'

const { COINS, PURPOSES } = BIP_CONSTANTS
let ec: any

//--------------------------------------------------
// LATTICE UTILS
//--------------------------------------------------

/** @internal Parse a response from the Lattice1 */
export const parseLattice1Response = (
  r: string,
): {
  errorMessage?: string
  responseCode?: number
  data?: Buffer
} => {
  const parsed: {
    errorMessage: string | null
    data: Buffer | null
    responseCode?: number
  } = {
    errorMessage: null,
    data: null,
  }
  const b = Buffer.from(r, 'hex')
  let off = 0

  // Get protocol version
  const protoVer = b.readUInt8(off)
  off++
  if (protoVer !== VERSION_BYTE) {
    parsed.errorMessage = 'Incorrect protocol version. Please update your SDK'
    return parsed
  }

  // Get the type of response
  // Should always be 0x00
  const msgType = b.readUInt8(off)
  off++
  if (msgType !== 0x00) {
    parsed.errorMessage = 'Incorrect response from Lattice1'
    return parsed
  }

  // Get the payload
  b.readUInt32BE(off)
  off += 4 // First 4 bytes is the id, but we don't need that anymore
  const len = b.readUInt16BE(off)
  off += 2
  const payload = b.slice(off, off + len)
  off += len

  // Get response code
  const responseCode = payload.readUInt8(0)
  if (responseCode !== LatticeResponseCode.success) {
    const errMsg = ProtocolConstants.responseMsg[responseCode]
    parsed.errorMessage = `[Lattice] ${errMsg ? errMsg : 'Unknown Error'}`
    parsed.responseCode = responseCode
    return parsed
  } else {
    parsed.data = payload.slice(1, payload.length)
  }

  // Verify checksum
  const cs = b.readUInt32BE(off)
  const expectedCs = checksum(b.slice(0, b.length - 4))
  if (cs !== expectedCs) {
    parsed.errorMessage = 'Invalid checksum from device response'
    parsed.data = null
    return parsed
  }

  return parsed
}

/** @internal */
export const checksum = (x: Buffer): number => {
  // crc32 returns a signed integer - need to cast it to unsigned
  // Note that this uses the default 0xedb88320 polynomial
  return crc32.buf(x) >>> 0 // Need this to be a uint, hence the bit shift
}

// Get a 74-byte padded DER-encoded signature buffer
// `sig` must be the signature output from elliptic.js
/** @internal */
export const toPaddedDER = (sig: any): Buffer => {
  // We use 74 as the maximum length of a DER signature. All sigs must
  // be right-padded with zeros so that this can be a fixed size field
  const b = Buffer.alloc(74)
  const ds = Buffer.from(sig.toDER())
  ds.copy(b)
  return b
}

//--------------------------------------------------
// TRANSACTION UTILS
//--------------------------------------------------
/** @internal */
export const isValidAssetPath = (
  path: number[],
  fwConstants: FirmwareConstants,
): boolean => {
  const allowedPurposes = [
    PURPOSES.ETH,
    PURPOSES.BTC_LEGACY,
    PURPOSES.BTC_WRAPPED_SEGWIT,
    PURPOSES.BTC_SEGWIT,
  ]
  const allowedCoins = [COINS.ETH, COINS.BTC, COINS.BTC_TESTNET]
  // These coin types were given to us by MyCrypto. They should be allowed, but we expect
  // an Ethereum-type address with these coin types.
  // These all use SLIP44: https://github.com/satoshilabs/slips/blob/master/slip-0044.md
  const allowedMyCryptoCoins = [
    60, 61, 966, 700, 9006, 9000, 1007, 553, 178, 137, 37310, 108, 40, 889,
    1987, 820, 6060, 1620, 1313114, 76, 246529, 246785, 1001, 227, 916, 464,
    2221, 344, 73799, 246,
  ]
  // Make sure firmware supports this Bitcoin path
  const isBitcoin = path[1] === COINS.BTC || path[1] === COINS.BTC_TESTNET
  const isBitcoinNonWrappedSegwit =
    isBitcoin && path[0] !== PURPOSES.BTC_WRAPPED_SEGWIT
  if (isBitcoinNonWrappedSegwit && !fwConstants.allowBtcLegacyAndSegwitAddrs)
    return false
  // Make sure this path is otherwise valid
  return (
    allowedPurposes.indexOf(path[0]) >= 0 &&
    (allowedCoins.indexOf(path[1]) >= 0 ||
      allowedMyCryptoCoins.indexOf(path[1] - HARDENED_OFFSET) > 0)
  )
}

/** @internal */
export const splitFrames = (data: Buffer, frameSz: number): Buffer[] => {
  const frames = []
  const n = Math.ceil(data.length / frameSz)
  let off = 0
  for (let i = 0; i < n; i++) {
    frames.push(data.slice(off, off + frameSz))
    off += frameSz
  }
  return frames
}

/** @internal */
function isBase10NumStr(x: string): boolean {
  const bn = new BigNum(x).toFixed().split('.').join('')
  const s = new String(x)
  // Note that the JS native `String()` loses precision for large numbers, but we only
  // want to validate the base of the number so we don't care about far out precision.
  return bn.slice(0, 8) === s.slice(0, 8)
}

/** @internal Ensure a param is represented by a buffer */
export const ensureHexBuffer = (
  x: string | number | bigint | Buffer,
  zeroIsNull = true,
): Buffer => {
  try {
    const isZeroNumber = typeof x === 'number' && x === 0
    const isZeroBigInt = typeof x === 'bigint' && x === 0n
    if (x === null || ((isZeroNumber || isZeroBigInt) && zeroIsNull === true))
      return Buffer.alloc(0)
    const isDecimalInput =
      typeof x === 'number' ||
      typeof x === 'bigint' ||
      (typeof x === 'string' && isBase10NumStr(x))
    let hexString: string
    if (isDecimalInput) {
      const formatted =
        typeof x === 'bigint' ? x.toString(10) : (x as string | number)
      hexString = new BigNum(formatted).toString(16)
    } else if (typeof x === 'string' && x.slice(0, 2) === '0x') {
      hexString = x.slice(2)
    } else if (Buffer.isBuffer(x)) {
      return x
    } else {
      hexString = x.toString()
    }
    if (hexString.length % 2 > 0) hexString = `0${hexString}`
    if (hexString === '00' && !isDecimalInput) return Buffer.alloc(0)
    return Buffer.from(hexString, 'hex')
  } catch (_err) {
    throw new Error(
      `Cannot convert ${x.toString()} to hex buffer (${(_err as Error).message})`,
    )
  }
}

/** @internal */
export const fixLen = (msg: Buffer, length: number): Buffer => {
  const buf = Buffer.alloc(length)
  if (msg.length < length) {
    msg.copy(buf, length - msg.length)
    return buf
  }
  return msg.slice(-length)
}

//--------------------------------------------------
// CRYPTO UTILS
//--------------------------------------------------
/** @internal */
export const aes256_encrypt = (data: Buffer, key: Buffer): Buffer => {
  const iv = Buffer.from(ProtocolConstants.aesIv)
  const aesCbc = new aes.ModeOfOperation.cbc(key, iv)
  const paddedData = data.length % 16 === 0 ? data : aes.padding.pkcs7.pad(data)
  return Buffer.from(aesCbc.encrypt(paddedData))
}

/** @internal */
export const aes256_decrypt = (data: Buffer, key: Buffer): Buffer => {
  const iv = Buffer.from(ProtocolConstants.aesIv)
  const aesCbc = new aes.ModeOfOperation.cbc(key, iv)
  return Buffer.from(aesCbc.decrypt(data))
}

// Decode a DER signature. Returns signature object {r, s } or null if there is an error
/** @internal */
export const parseDER = (sigBuf: Buffer) => {
  if (sigBuf[0] !== 0x30 || sigBuf[2] !== 0x02)
    throw new Error('Failed to decode DER signature')
  let off = 3
  const rLen = sigBuf[off]
  off++
  const r = sigBuf.slice(off, off + rLen)
  off += rLen
  if (sigBuf[off] !== 0x02) throw new Error('Failed to decode DER signature')
  off++
  const sLen = sigBuf[off]
  off++
  const s = sigBuf.slice(off, off + sLen)
  return { r, s }
}

/** @internal */
export const getP256KeyPair = (priv: Buffer | string): any => {
  if (ec === undefined) ec = new EC('p256')
  return ec.keyFromPrivate(priv, 'hex')
}

/** @internal */
export const getP256KeyPairFromPub = (pub: Buffer | string): any => {
  if (ec === undefined) ec = new EC('p256')
  // Convert Buffer to hex string if needed
  const pubHex = Buffer.isBuffer(pub) ? pub.toString('hex') : pub
  return ec.keyFromPublic(pubHex, 'hex')
}

/** @internal */
export const buildSignerPathBuf = (
  signerPath: number[],
  varAddrPathSzAllowed: boolean,
): Buffer => {
  const buf = Buffer.alloc(24)
  let off = 0
  if (varAddrPathSzAllowed && signerPath.length > 5)
    throw new Error('Signer path must be <=5 indices.')
  if (!varAddrPathSzAllowed && signerPath.length !== 5)
    throw new Error(
      'Your Lattice firmware only supports 5-index derivation paths. Please upgrade.',
    )
  buf.writeUInt32LE(signerPath.length, off)
  off += 4
  for (let i = 0; i < 5; i++) {
    if (i < signerPath.length) buf.writeUInt32LE(signerPath[i], off)
    else buf.writeUInt32LE(0, off)
    off += 4
  }
  return buf
}

//--------------------------------------------------
// OTHER UTILS
//--------------------------------------------------
/** @internal */
export const isAsciiStr = (str: string, allowFormatChars = false): boolean => {
  if (typeof str !== 'string') {
    return false
  }
  const extraChars = allowFormatChars
    ? [
        0x0020, // Space
        0x000a, // New line
      ]
    : []
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (extraChars.indexOf(c) < 0 && (c < 0x0020 || c > 0x007f)) {
      return false
    }
  }
  return true
}

/** @internal Check if a value exists in an object. Only checks first level of keys. */
export const existsIn = <T>(val: T, obj: { [key: string]: T }): boolean =>
  Object.keys(obj).some((key) => obj[key] === val)

/** @internal Create a buffer of size `n` and fill it with random data */
export const randomBytes = (n: number): Buffer => {
  const buf = Buffer.alloc(n)
  for (let i = 0; i < n; i++) {
    buf[i] = Math.round(Math.random() * 255)
  }
  return buf
}

/** @internal `isUInt4` accepts a number and returns true if it is a UInt4 */
export const isUInt4 = (n: number) => isInteger(n) && inRange(n, 0, 16)

/**
 * Fetches an external JSON file containing networks indexed by chain id from a GridPlus repo, and
 * returns the parsed JSON.
 */
async function fetchExternalNetworkForChainId(
  chainId: number | string,
): Promise<{
  [key: string]: {
    name: string
    baseUrl: string
    apiRoute: string
  }
}> {
  try {
    const body = await fetch(EXTERNAL_NETWORKS_BY_CHAIN_ID_URL).then((res) =>
      res.json(),
    )
    if (body) {
      return body[chainId]
    } else {
      return undefined
    }
  } catch (_err) {
    console.warn('Fetching external networks failed.\n', _err)
  }
}

/**
 * Builds a URL for fetching calldata from block explorers for any supported chains
 * */
function buildUrlForSupportedChainAndAddress({ supportedChain, address }) {
  const baseUrl = supportedChain.baseUrl
  const apiRoute = supportedChain.apiRoute
  const urlWithRoute = `${baseUrl}/${apiRoute}&address=${address}`

  const apiKey = process.env.ETHERSCAN_KEY
  const apiKeyParam = apiKey ? `&apiKey=${process.env.ETHERSCAN_KEY}` : ''

  return urlWithRoute + apiKeyParam
}

/**
 * Takes a list of ABI data objects and a selector, and returns the earliest ABI data object that
 * matches the selector.
 */
export function selectDefFrom4byteABI(abiData: any[], selector: string) {
  if (abiData.length > 1) {
    console.warn('WARNING: There are multiple results. Using the first one.')
  }
  let def: unknown[] | undefined
  abiData
    .sort((a, b) => {
      const aTime = new Date(a.created_at).getTime()
      const bTime = new Date(b.created_at).getTime()
      return aTime - bTime
    })
    .find((result) => {
      try {
        def = Calldata.EVM.parsers.parseCanonicalName(
          selector,
          result.text_signature,
        )
        return !!def
      } catch (_err) {
        console.error('Failed to parse canonical name:', _err)
        return false
      }
    })
  if (def) {
    return def
  } else {
    throw new Error('Could not find definition for selector')
  }
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number },
): Promise<Response> {
  const { timeout = 8000 } = options
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  const response = await fetch(url, {
    ...options,
    signal: controller.signal,
  })
  clearTimeout(timeoutId)
  return response
}

async function fetchAndCache(
  url: string,
  opts?: RequestInit,
): Promise<Response> {
  try {
    if (globalThis.caches && globalThis.Request) {
      const cache = await caches.open('gp-calldata')
      const request = new Request(url, opts)
      const match = await cache.match(request)
      if (match) {
        return match
      } else {
        const response = await fetch(request, opts)
        const responseClone = response.clone()
        const data = await response.json()
        if (
          response.ok &&
          (isValidBlockExplorerResponse(data) || isValid4ByteResponse(data))
        ) {
          await cache.put(request, responseClone)
          return cache.match(request)
        }
        return response
      }
    } else {
      return fetch(url, opts)
    }
  } catch (err) {
    console.error(err)
    throw err
  }
}

async function fetchSupportedChainData(
  address: string,
  supportedChain: number,
) {
  const url = buildUrlForSupportedChainAndAddress({ address, supportedChain })
  return fetchAndCache(url)
    .then((res) => res.json())
    .then((body) => {
      if (body?.result) {
        try {
          return JSON.parse(body.result)
        } catch {
          throw new Error(
            `Invalid JSON in response: ${body.result.substring(0, 50)}`,
          )
        }
      } else {
        throw new Error('Server response was malformed')
      }
    })
    .catch((error) => {
      console.log(error)
      throw new Error('Fetching data from external network failed')
    })
}

async function fetch4byteData(selector: string): Promise<any> {
  const url = `https://www.4byte.directory/api/v1/signatures/?hex_signature=0x${selector}`
  return await fetch(url)
    .then((res) => res.json())
    .then((body) => {
      if (body?.results) {
        return body.results
      } else {
        throw new Error('No results found')
      }
    })
    .catch((err) => {
      throw new Error(`Fetching data from 4byte failed: ${err.message}`)
    })
}

function encodeDef(def: any) {
  return Buffer.from(RLP.encode(def))
}

/**
 * Post-process fetched ABI definition.
 * @param def - Calldata decoder data definition for calling function
 * @param calldata - Raw transaction calldata
 * @return - Updated `def`
 */
async function postProcessDef(def, calldata) {
  // Replace all nested defs if applicable. This is done by looping
  // through each param in the definition and if it is of type `bytes`
  // or `bytes[]`, checking the param value in `calldata`. If the param
  // value (or for `bytes[]` each underlying value) is of size (4 + 32*n)
  // it could be nested calldata. We should use that item's selector(s)
  // to look up nested definition(s).
  const nestedCalldata = Calldata.EVM.processors.getNestedCalldata(
    def,
    calldata,
  )
  const nestedDefs = await replaceNestedDefs(nestedCalldata)
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
          )
        }
      }
    } else if (nestedDefs[i] !== null) {
      nestedDefs[i] = await postProcessDef(
        nestedDefs[i],
        Buffer.from(nestedCalldata[i].slice(2), 'hex'),
      )
    }
  }
  // Replace any nested defs
  const newDef = Calldata.EVM.processors.replaceNestedDefs(def, nestedDefs)
  return newDef
}

/**
 * Given a set of possible nested defs, slice out selectors and look up
 * definitions on 4byte.
 * @param possNestedDefs - result of `getPossibleNestedDefs` processor
 * @return Array containing calldata decoding data for each parameter
 *          that had a possible nested def. If there was no possible
 *          nested def or if a def could not be fetched from 4byte, the
 *          array item will be `null`. In the case of multiple possible
 *          defs behind one param (e.g. multicall pattern), ALL nested
 *          items must have defs associated or the item will map to a
 *          single `null` value in the return array.
 *
 */
async function replaceNestedDefs(possNestedDefs) {
  // For all possible nested defs, attempt to fetch the underlying def
  const nestedDefs = []
  for await (const d of possNestedDefs) {
    if (d !== null) {
      if (Array.isArray(d)) {
        const _nestedDefs = []
        let shouldInclude = true
        for await (const _d of d) {
          try {
            const _nestedSelector = _d.slice(2, 10)
            const _nestedAbi = await fetch4byteData(_nestedSelector)
            const _nestedDef = selectDefFrom4byteABI(
              _nestedAbi,
              _nestedSelector,
            )
            _nestedDefs.push(_nestedDef)
          } catch (_err) {
            console.error('Failed to fetch nested 4byte data:', _err)
            shouldInclude = false
            _nestedDefs.push(null)
          }
        }
        if (shouldInclude) {
          nestedDefs.push(_nestedDefs)
        } else {
          nestedDefs.push(null)
        }
      } else {
        try {
          const nestedSelector = d.slice(2, 10)
          const nestedAbi = await fetch4byteData(nestedSelector)
          const nestedDef = selectDefFrom4byteABI(nestedAbi, nestedSelector)
          nestedDefs.push(nestedDef)
        } catch (_err) {
          console.error('Failed to fetch nested definition:', _err)
          nestedDefs.push(null)
        }
      }
    } else {
      nestedDefs.push(null)
    }
  }
  // For all nested defs, replace the
  return nestedDefs
}

//--------------------------------------------------
//--------------------------------------------------
// EXTERNAL UTILS
//--------------------------------------------------
//--------------------------------------------------
/**
 *  Fetches calldata from a remote scanner based on the transaction's `chainId`
 */
export async function fetchCalldataDecoder(
  _data: Uint8Array | string,
  to: string,
  _chainId: number | string,
  recurse = true,
) {
  try {
    // Exit if there is no data. The 2 comes from the 0x prefix, but a later
    // check will confirm that there are at least 4 bytes of data in the buffer.
    if (!_data || _data.length < 2) {
      throw new Error('Data is either undefined or less than two bytes')
    }
    const isHexString = typeof _data === 'string' && _data.slice(0, 2) === '0x'
    const data = isHexString
      ? Buffer.from(_data.slice(2), 'hex')
      : //@ts-expect-error - Buffer doesn't recognize Uint8Array type properly
        Buffer.from(_data, 'hex')

    // For empty data (just '0x'), return early - no calldata to decode
    if (data.length === 0) {
      return { def: null, abi: null }
    }

    if (data.length < 4) {
      throw new Error(
        'Data must contain at least 4 bytes of data to define the selector',
      )
    }
    const selector = Buffer.from(data.slice(0, 4)).toString('hex')
    // Convert the chainId to a number and use it to determine if we can call out to
    // an etherscan-like explorer for richer data.
    const chainId = Number(_chainId)
    const cachedNetwork = NETWORKS_BY_CHAIN_ID[chainId]
    const supportedChain = cachedNetwork
      ? cachedNetwork
      : await fetchExternalNetworkForChainId(chainId)
    try {
      if (supportedChain) {
        const abi = await fetchSupportedChainData(to, supportedChain)
        const parsedAbi = Calldata.EVM.parsers.parseSolidityJSONABI(
          selector,
          abi,
        )
        let def = parsedAbi.def
        if (recurse) {
          def = await postProcessDef(def, data)
        }
        return { abi, def: encodeDef(def) }
      } else {
        throw new Error(`Chain (id: ${chainId}) is not supported`)
      }
    } catch (err) {
      console.warn(err.message, '\n', 'Falling back to 4byte')
    }

    // Fallback to checking 4byte
    const abi = await fetch4byteData(selector)
    let def = selectDefFrom4byteABI(abi, selector)
    if (recurse) {
      def = await postProcessDef(def, data)
    }
    return { abi, def: encodeDef(def) }
  } catch (err) {
    console.warn(`Fetching calldata failed: ${err.message}`)
  }

  return { def: null, abi: null }
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
    typeof deviceId === 'string' ? Buffer.from(deviceId) : deviceId
  const passwordBuffer =
    typeof password === 'string' ? Buffer.from(password) : password
  const appNameBuffer =
    typeof appName === 'string' ? Buffer.from(appName) : appName

  const preImage = Buffer.concat([
    deviceIdBuffer,
    passwordBuffer,
    appNameBuffer,
  ])

  return Buffer.from(Hash.sha256(preImage))
}

/**
 * Get the `v` component of signature using viem parsing.
 * @param tx - Serialized transaction (Buffer or hex string)
 * @param resp - Lattice response with sig and pubkey
 * @returns BN object containing the `v` param
 */
export const getV = (tx: any, resp: any) => {
  let chainId: string | undefined
  let hash: Uint8Array
  let type: string | number | undefined
  let useEIP155 = false

  if (Buffer.isBuffer(tx) || typeof tx === 'string') {
    const txHex = Buffer.isBuffer(tx)
      ? (`0x${tx.toString('hex')}` as Hex)
      : (tx as Hex)
    const txBuf = Buffer.isBuffer(tx) ? tx : Buffer.from(tx.slice(2), 'hex')

    hash = Buffer.from(Hash.keccak256(txBuf))

    try {
      const parsedTx = parseTransaction(txHex)
      type = parsedTx.type

      if (parsedTx.chainId !== undefined && parsedTx.chainId !== null) {
        chainId = parsedTx.chainId.toString()
        if (type === 'legacy') {
          useEIP155 = true
        }
      }

      if (type === 'legacy' && !useEIP155) {
        const legacyTxArray = RLP.decode(txBuf)
        if (legacyTxArray.length >= 9) {
          const vBuf = legacyTxArray[6] as Uint8Array
          if (vBuf && vBuf.length > 0) {
            chainId = new BN(vBuf).toString()
            useEIP155 = true
          }
        }
      }
    } catch (err) {
      console.error('Failed to parse transaction, trying legacy format:', err)
      try {
        const txBufRaw = Buffer.isBuffer(tx)
          ? tx
          : Buffer.from(tx.slice(2), 'hex')
        const legacyTxArray = RLP.decode(txBufRaw)

        type = 'legacy'
        if (legacyTxArray.length >= 9) {
          const vBuf = legacyTxArray[6] as Uint8Array
          if (vBuf && vBuf.length > 0) {
            chainId = new BN(vBuf).toString()
            useEIP155 = true
          }
        }
      } catch {
        throw new Error('Could not recover V. Bad transaction data.')
      }
    }
  } else {
    throw new Error(
      'Unsupported transaction format. Expected Buffer or hex string.',
    )
  }

  const rBuf = Buffer.isBuffer(resp.sig.r)
    ? resp.sig.r
    : Buffer.from(resp.sig.r.slice(2), 'hex')
  const sBuf = Buffer.isBuffer(resp.sig.s)
    ? resp.sig.s
    : Buffer.from(resp.sig.s.slice(2), 'hex')
  const rs = new Uint8Array(Buffer.concat([rBuf, sBuf]))
  const pubkeyInput = resp.pubkey

  if (!pubkeyInput) {
    throw new Error('Response did not include a public key.')
  }

  let pubkeyBuf: Buffer
  if (Buffer.isBuffer(pubkeyInput)) {
    pubkeyBuf = Buffer.from(pubkeyInput)
  } else if (pubkeyInput instanceof Uint8Array) {
    pubkeyBuf = Buffer.from(pubkeyInput)
  } else if (typeof pubkeyInput === 'string') {
    const hex = pubkeyInput.startsWith('0x')
      ? pubkeyInput.slice(2)
      : pubkeyInput
    pubkeyBuf = Buffer.from(hex, 'hex')
  } else {
    pubkeyBuf = Buffer.from(pubkeyInput)
  }

  if (pubkeyBuf.length === 64) {
    pubkeyBuf = Buffer.concat([Buffer.from([0x04]), pubkeyBuf])
  }

  const isCompressedPubkey =
    pubkeyBuf.length === 33 && (pubkeyBuf[0] === 0x02 || pubkeyBuf[0] === 0x03)
  const isUncompressedPubkey = pubkeyBuf.length === 65 && pubkeyBuf[0] === 0x04

  if (!isCompressedPubkey && !isUncompressedPubkey) {
    throw new Error('Unsupported public key format returned by device.')
  }

  const recovery0 = Buffer.from(ecdsaRecover(rs, 0, hash, isCompressedPubkey))
  const recovery1 = Buffer.from(ecdsaRecover(rs, 1, hash, isCompressedPubkey))

  const pubkeyStr = pubkeyBuf.toString('hex')
  const recovery0Str = recovery0.toString('hex')
  const recovery1Str = recovery1.toString('hex')

  let recovery: number
  if (pubkeyStr === recovery0Str) {
    recovery = 0
  } else if (pubkeyStr === recovery1Str) {
    recovery = 1
  } else {
    throw new Error(
      'Failed to recover V parameter. Bad signature or transaction data.',
    )
  }

  // Use the consolidated v parameter conversion logic
  const result = convertRecoveryToV(recovery, {
    chainId,
    useEIP155,
    type,
  })

  // Always return BN for consistent interface - convertRecoveryToV returns Buffer for typed txs
  if (Buffer.isBuffer(result)) {
    // For typed transactions that return recovery value (0 or 1) as buffer
    if (result.length === 0) {
      return new BN(0) // Empty buffer means 0
    } else {
      return new BN(result.toString('hex'), 16)
    }
  } else {
    return result // Already a BN
  }
}

/**
 * Convert a recovery parameter (0/1) to the proper v value format based on transaction type.
 * Consolidates the v parameter conversion logic used across ethereum.ts and util.ts.
 *
 * @param recovery - Recovery parameter (0 or 1)
 * @param txData - Transaction data containing chainId, useEIP155, and type
 * @returns The properly formatted v value as Buffer or BN
 */
export const convertRecoveryToV = (
  recovery: number,
  txData: any = {},
): Buffer | InstanceType<typeof BN> => {
  const { chainId, useEIP155, type } = txData

  // For typed transactions (EIP-2930, EIP-1559, EIP-7702), we want the recoveryParam (0 or 1)
  // rather than the `v` value because the `chainId` is already included in the
  // transaction payload.
  if (
    type === 1 ||
    type === 2 ||
    type === 4 ||
    type === 'eip2930' ||
    type === 'eip1559' ||
    type === 'eip7702'
  ) {
    return ensureHexBuffer(recovery, true) // 0 or 1, with 0 expected as an empty buffer
  } else if (!useEIP155 || !chainId) {
    // For ETH messages and non-EIP155 chains the set should be [27, 28] for `v`
    return new BN(recovery).addn(27)
  }

  // We will use EIP155 in most cases. Convert recovery to a bignum and operate on it.
  // Note that the protocol calls for v = (CHAIN_ID*2) + 35/36, where 35 or 36
  // is decided on based on the ecrecover result. `recovery` is passed in as either 0 or 1
  // so we add 35 to that.
  return new BN(chainId).muln(2).addn(35).addn(recovery)
}

/**
 * Get the y-parity value for a signature by recovering the public key.
 *
 * Usage:
 * - Simple: getYParity(messageHash, signature, publicKey)
 * - Object: getYParity({ messageHash, signature, publicKey })
 * - Legacy: getYParity(tx, response)
 *
 * @param messageHash - The 32-byte message hash (or tx object for legacy)
 * @param signature - Object with r and s values
 * @param publicKey - Expected public key
 * @returns 0 or 1 for the y-parity value
 */
export const getYParity = (
  messageHash:
    | Buffer
    | Uint8Array
    | string
    | { messageHash: any; signature: any; publicKey: any }
    | any,
  signature?: { r: any; s: any } | any,
  publicKey?: Buffer | Uint8Array | string,
): number => {
  // Handle legacy object format for backward compatibility
  if (
    typeof messageHash === 'object' &&
    messageHash &&
    'messageHash' in messageHash
  ) {
    return getYParity(
      messageHash.messageHash,
      messageHash.signature,
      messageHash.publicKey,
    )
  }

  // Handle legacy transaction format for backward compatibility
  if (signature?.sig && signature.pubkey && !publicKey) {
    return getYParity(messageHash, signature.sig, signature.pubkey)
  }

  // Validate required parameters
  if (!signature || !publicKey) {
    throw new Error('Response with sig and pubkey required for legacy format')
  }

  if (!signature.r || !signature.s) {
    throw new Error('Response with sig and pubkey required for legacy format')
  }

  // Handle transaction objects with getMessageToSign
  let hash = messageHash
  if (
    typeof messageHash === 'object' &&
    messageHash &&
    typeof messageHash.getMessageToSign === 'function'
  ) {
    const type = messageHash._type
    if (type !== undefined && type !== null) {
      // EIP-1559 / EIP-2930 / future typed transactions
      hash = messageHash.getMessageToSign(true)
    } else {
      // Legacy transaction objects
      const preimage = RLP.encode(messageHash.getMessageToSign(false))
      hash = Buffer.from(Hash.keccak256(preimage))
    }
  } else if (Buffer.isBuffer(messageHash) && messageHash.length !== 32) {
    // If it's a buffer but not 32 bytes, hash it
    hash = Buffer.from(Hash.keccak256(messageHash))
  }

  // Normalize inputs to Buffers
  const toBuffer = (data: any): Buffer => {
    if (!data) throw new Error('Invalid data')
    if (Buffer.isBuffer(data)) return data
    if (data instanceof Uint8Array) return Buffer.from(data)
    if (typeof data === 'string') {
      return Buffer.from(data.replace(/^0x/i, ''), 'hex')
    }
    throw new Error('Invalid data type')
  }

  const hashBuf = toBuffer(hash)
  const rBuf = toBuffer(signature.r)
  const sBuf = toBuffer(signature.s)
  const pubkeyBuf = toBuffer(publicKey)

  // For non-32 byte hashes, hash them (legacy support)
  const finalHash =
    hashBuf.length === 32 ? hashBuf : Buffer.from(Hash.keccak256(hashBuf))

  // Combine r and s
  const rs = new Uint8Array(Buffer.concat([rBuf, sBuf]))
  const hashBytes = new Uint8Array(finalHash)
  const isCompressed = pubkeyBuf.length === 33

  // Try both recovery values
  for (let recovery = 0; recovery <= 1; recovery++) {
    try {
      const recovered = ecdsaRecover(rs, recovery, hashBytes, isCompressed)
      if (Buffer.from(recovered).equals(pubkeyBuf)) {
        return recovery
      }
    } catch {}
  }

  throw new Error(
    'Failed to recover Y parity. Bad signature or transaction data.',
  )
}

/** @internal */
export const EXTERNAL = {
  fetchCalldataDecoder,
  generateAppSecret,
  getV,
  getYParity,
  convertRecoveryToV,
}
