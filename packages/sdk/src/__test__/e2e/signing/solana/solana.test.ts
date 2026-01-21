/**
 * REQUIRED TEST MNEMONIC:
 * These tests require a SafeCard loaded with the standard test mnemonic:
 * "test test test test test test test test test test test junk"
 *
 * Running with a different mnemonic will cause test failures due to
 * incorrect key derivations and signature mismatches.
 */
import { Keypair as SolanaKeypair, PublicKey as SolanaPublicKey, SystemProgram as SolanaSystemProgram, Transaction as SolanaTransaction } from '@solana/web3.js'
import { Constants } from '../../../..'
import { HARDENED_OFFSET } from '../../../../constants'
import { ensureHexBuffer } from '../../../../util'
import { getPrng } from '../../../utils/getters'
import { deriveED25519Key, prandomBuf } from '../../../utils/helpers'
import { runGeneric } from '../../../utils/runners'
import { setupClient } from '../../../utils/setup'
import { TEST_SEED } from '../../../utils/testConstants'
import type { Client } from '../../../../client'

//---------------------------------------
// STATE DATA
//---------------------------------------
const DEFAULT_SOLANA_SIGNER_PATH = [HARDENED_OFFSET + 44, HARDENED_OFFSET + 501, HARDENED_OFFSET, HARDENED_OFFSET]
const prng = getPrng()

describe('[Solana]', () => {
	let client: Client

	beforeAll(async () => {
		client = await setupClient()
	})

	const getReq = (overrides: any) => ({
		data: {
			curveType: Constants.SIGNING.CURVES.ED25519,
			hashType: Constants.SIGNING.HASHES.NONE,
			encodingType: Constants.SIGNING.ENCODINGS.SOLANA,
			payload: null,
			...overrides,
		},
	})

	it('Should validate Solana transaction encoding', async () => {
		// Build a Solana transaction with two signers, each derived from the Lattice's seed.
		// This will require two separate general signing requests, one per signer.

		// Get the full set of Solana addresses and keys
		// NOTE: Solana addresses are just base58 encoded public keys. We do not
		// currently support exporting of Solana addresses in firmware but we can
		// derive them here using the exported seed.
		const seed = TEST_SEED
		const derivedAPath = [...DEFAULT_SOLANA_SIGNER_PATH]
		const derivedBPath = [...DEFAULT_SOLANA_SIGNER_PATH]
		derivedBPath[3] += 1
		const derivedCPath = [...DEFAULT_SOLANA_SIGNER_PATH]
		derivedCPath[3] += 2
		const derivedA = deriveED25519Key(derivedAPath, seed)
		const derivedB = deriveED25519Key(derivedBPath, seed)
		const derivedC = deriveED25519Key(derivedCPath, seed)
		const pubA = new SolanaPublicKey(derivedA.pub)
		const pubB = new SolanaPublicKey(derivedB.pub)
		const pubC = new SolanaPublicKey(derivedC.pub)

		// Define transaction instructions
		const transfer1 = SolanaSystemProgram.transfer({
			fromPubkey: pubA,
			toPubkey: pubC,
			lamports: 111,
		})
		const transfer2 = SolanaSystemProgram.transfer({
			fromPubkey: pubB,
			toPubkey: pubC,
			lamports: 222,
		})

		// Generate a pseudorandom blockhash, which is just a public key appearently.
		const randBuf = prandomBuf(prng, 32, true)
		const recentBlockhash = SolanaKeypair.fromSeed(randBuf).publicKey.toBase58()

		// Build a transaction and sign it using Solana's JS lib
		const txJs = new SolanaTransaction({ recentBlockhash }).add(transfer1, transfer2)
		txJs.setSigners(pubA, pubB)
		txJs.sign(SolanaKeypair.fromSeed(derivedA.priv), SolanaKeypair.fromSeed(derivedB.priv))
		const serTxJs = txJs.serialize().toString('hex')

		// Build a copy of the transaction and get the serialized payload for signing in firmware.
		const txFw = new SolanaTransaction({ recentBlockhash }).add(transfer1, transfer2)
		txFw.setSigners(pubA, pubB)
		// We want to sign the Solana message, not the full transaction
		const payload = txFw.compileMessage().serialize()
		const payloadHex = `0x${payload.toString('hex')}`

		// Sign payload from Lattice and add signatures to tx object
		const sigA = await runGeneric(
			getReq({
				signerPath: derivedAPath,
				payload: payloadHex,
			}),
			client,
		).then((resp) => {
			if (!resp.sig?.r || !resp.sig?.s) {
				throw new Error('Missing signature components in response')
			}
			return Buffer.concat([ensureHexBuffer(resp.sig.r as string | Buffer), ensureHexBuffer(resp.sig.s as string | Buffer)])
		})

		const sigB = await runGeneric(
			getReq({
				signerPath: derivedBPath,
				payload: payloadHex,
			}),
			client,
		).then((resp) => {
			if (!resp.sig?.r || !resp.sig?.s) {
				throw new Error('Missing signature components in response')
			}
			return Buffer.concat([ensureHexBuffer(resp.sig.r as string | Buffer), ensureHexBuffer(resp.sig.s as string | Buffer)])
		})
		txFw.addSignature(pubA, sigA)
		txFw.addSignature(pubB, sigB)

		// Validate the signatures from the Lattice match those of the Solana library
		const serTxFw = txFw.serialize().toString('hex')
		expect(serTxFw).toEqual(serTxJs)
	})
})
