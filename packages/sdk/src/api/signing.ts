import { RLP } from '@ethereumjs/rlp'
import { Hash } from 'ox'
import {
	type Address,
	type Authorization,
	type Hex,
	type TransactionSerializable,
	type TransactionSerializableEIP7702,
	serializeTransaction,
} from 'viem'
import { Constants } from '..'
import {
	BTC_LEGACY_DERIVATION,
	BTC_SEGWIT_DERIVATION,
	BTC_WRAPPED_SEGWIT_DERIVATION,
	CURRENCIES,
	DEFAULT_ETH_DERIVATION,
	SOLANA_DERIVATION,
} from '../constants'
import { fetchDecoder } from '../functions/fetchDecoder'
import type {
	BitcoinSignPayload,
	EIP712MessagePayload,
	SignData,
	SignRequestParams,
	SigningPayload,
	TransactionRequest,
} from '../types'
import { getYParity } from '../util'
import { isEIP712Payload, queue } from './utilities'

// Define the authorization request type based on Viem's structure
type AuthorizationRequest = {
	chainId: number
	nonce: number
} & ({ address: Address } | { contractAddress: Address })

/**
 * Sign a transaction using Viem-compatible transaction types
 */
type RawTransaction = Hex | Uint8Array | Buffer

export const sign = async (
	transaction: TransactionSerializable | RawTransaction,
	overrides?: Omit<SignRequestParams, 'data'>,
): Promise<SignData> => {
	const isRaw = isRawTransaction(transaction)
	const serializedTx = isRaw
		? normalizeRawTransaction(transaction)
		: serializeTransaction(transaction as TransactionSerializable)

	// Determine the encoding type based on transaction type
	let encodingType:
		| typeof Constants.SIGNING.ENCODINGS.EVM
		| typeof Constants.SIGNING.ENCODINGS.EIP7702_AUTH
		| typeof Constants.SIGNING.ENCODINGS.EIP7702_AUTH_LIST =
		Constants.SIGNING.ENCODINGS.EVM
	if (!isRaw && (transaction as TransactionSerializable).type === 'eip7702') {
		const eip7702Tx = transaction as TransactionSerializableEIP7702
		const hasAuthList =
			eip7702Tx.authorizationList && eip7702Tx.authorizationList.length > 0
		encodingType = hasAuthList
			? Constants.SIGNING.ENCODINGS.EIP7702_AUTH_LIST
			: Constants.SIGNING.ENCODINGS.EIP7702_AUTH
	}

	// Only fetch decoder if we have the required fields
	let decoder: Buffer | undefined
	if (
		!isRaw &&
		'data' in (transaction as TransactionSerializable) &&
		'to' in (transaction as TransactionSerializable) &&
		'chainId' in (transaction as TransactionSerializable)
	) {
		decoder = await fetchDecoder({
			data: (transaction as TransactionSerializable).data,
			to: (transaction as TransactionSerializable).to,
			chainId: (transaction as TransactionSerializable).chainId,
		} as TransactionRequest)
	}

	const payload: SigningPayload = {
		signerPath: DEFAULT_ETH_DERIVATION,
		curveType: Constants.SIGNING.CURVES.SECP256K1,
		hashType: Constants.SIGNING.HASHES.KECCAK256,
		encodingType,
		payload: serializedTx,
		decoder,
	}

	return queue((client) => client.sign({ data: payload, ...overrides }))
}

/**
 * Sign a message with support for EIP-712 typed data and const assertions
 */
export function signMessage(
	payload:
		| string
		| Uint8Array
		| Buffer
		| Buffer[]
		| EIP712MessagePayload<Record<string, unknown>>,
	overrides?: Omit<SignRequestParams, 'data'>,
): Promise<SignData> {
	const basePayload: SigningPayload<Record<string, unknown>> = {
		signerPath: DEFAULT_ETH_DERIVATION,
		curveType: Constants.SIGNING.CURVES.SECP256K1,
		hashType: Constants.SIGNING.HASHES.KECCAK256,
		protocol: isEIP712Payload(payload) ? 'eip712' : 'signPersonal',
		payload: payload as SigningPayload<Record<string, unknown>>['payload'],
	}

	const tx: SignRequestParams = {
		data: basePayload as SignRequestParams['data'],
		currency: overrides?.currency ?? CURRENCIES.ETH_MSG,
		...(overrides ?? {}),
	}

	return queue((client) => client.sign(tx))
}

function isRawTransaction(
	value: TransactionSerializable | RawTransaction,
): value is RawTransaction {
	return (
		typeof value === 'string' ||
		value instanceof Uint8Array ||
		Buffer.isBuffer(value)
	)
}

function normalizeRawTransaction(tx: RawTransaction): Hex | Buffer {
	if (typeof tx === 'string') {
		return tx.startsWith('0x') ? (tx as Hex) : (`0x${tx}` as Hex)
	}
	return Buffer.from(tx)
}

/**
 * Signs an EIP-7702 authorization to set code for an externally owned account (EOA).
 * Returns a Viem-compatible authorization object.
 */
export const signAuthorization = async (
	authorization: AuthorizationRequest,
	overrides?: Omit<SignRequestParams, 'data'>,
): Promise<Authorization> => {
	// EIP-7702 authorization message is: MAGIC || rlp([chain_id, address, nonce])
	// MAGIC = 0x05 per EIP-7702 spec
	const MAGIC = Buffer.from([0x05])

	// Handle the address/contractAddress alias
	const address =
		'address' in authorization
			? authorization.address
			: authorization.contractAddress

	const message = Buffer.concat([
		MAGIC,
		Buffer.from(
			RLP.encode([authorization.chainId, address, authorization.nonce]),
		),
	])

	const payload: SigningPayload = {
		signerPath: DEFAULT_ETH_DERIVATION,
		curveType: Constants.SIGNING.CURVES.SECP256K1,
		hashType: Constants.SIGNING.HASHES.KECCAK256,
		encodingType: Constants.SIGNING.ENCODINGS.EIP7702_AUTH,
		payload: message,
	}

	// Get the signature with all components
	const response = await queue((client) =>
		client.sign({ data: payload, ...overrides }),
	)

	// Extract signature components if they exist
	if (response.sig && response.pubkey) {
		// Calculate the correct y-parity value
		const messageHash = Buffer.from(Hash.keccak256(message))
		const yParity = getYParity(messageHash, response.sig, response.pubkey)

		// Handle both Buffer and string formats for r and s
		const rValue = Buffer.isBuffer(response.sig.r)
			? `0x${response.sig.r.toString('hex')}`
			: response.sig.r
		const sValue = Buffer.isBuffer(response.sig.s)
			? `0x${response.sig.s.toString('hex')}`
			: response.sig.s

		// Create a complete Authorization object with all required signature components
		const result: Authorization = {
			address, // Viem compatibility
			chainId: authorization.chainId,
			nonce: authorization.nonce,
			yParity,
			r: rValue as Hex,
			s: sValue as Hex,
		}

		return result
	}

	throw new Error('Failed to get signature from device')
}

/**
 * Sign an EIP-7702 transaction using Viem-compatible types
 */
export const signAuthorizationList = async (
	tx: TransactionSerializableEIP7702,
): Promise<SignData> => {
	const serializedTx = serializeTransaction(tx)

	const payload: SigningPayload = {
		signerPath: DEFAULT_ETH_DERIVATION,
		curveType: Constants.SIGNING.CURVES.SECP256K1,
		hashType: Constants.SIGNING.HASHES.KECCAK256,
		encodingType: Constants.SIGNING.ENCODINGS.EIP7702_AUTH_LIST,
		payload: serializedTx,
	}

	const signedPayload = await queue((client) => client.sign({ data: payload }))

	// Return the SignData structure from Lattice, not the converted signature
	return signedPayload
}

export const signBtcLegacyTx = async (
	payload: BitcoinSignPayload,
): Promise<SignData> => {
	const tx = {
		data: {
			signerPath: BTC_LEGACY_DERIVATION,
			...payload,
		},
		currency: CURRENCIES.BTC,
	}
	return queue((client) => client.sign(tx))
}

export const signBtcSegwitTx = async (
	payload: BitcoinSignPayload,
): Promise<SignData> => {
	const tx = {
		data: {
			signerPath: BTC_SEGWIT_DERIVATION,
			...payload,
		},
		currency: CURRENCIES.BTC,
	}
	return queue((client) => client.sign(tx))
}

export const signBtcWrappedSegwitTx = async (
	payload: BitcoinSignPayload,
): Promise<SignData> => {
	const tx = {
		data: {
			signerPath: BTC_WRAPPED_SEGWIT_DERIVATION,
			...payload,
		},
		currency: CURRENCIES.BTC,
	}
	return queue((client) => client.sign(tx))
}

export const signSolanaTx = async (
	payload: Buffer,
	overrides?: SignRequestParams,
): Promise<SignData> => {
	const tx = {
		data: {
			signerPath: SOLANA_DERIVATION,
			curveType: Constants.SIGNING.CURVES.ED25519,
			hashType: Constants.SIGNING.HASHES.NONE,
			encodingType: Constants.SIGNING.ENCODINGS.SOLANA,
			payload,
			...overrides,
		},
	}
	return queue((client) => client.sign(tx))
}
