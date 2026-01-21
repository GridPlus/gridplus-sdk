import { Buffer } from 'node:buffer'
import { Hash } from 'ox'
import secp256k1 from 'secp256k1'
import { addRecoveryParam } from '../../ethereum'

describe('Personal Sign Validation - Issue Fix', () => {
	/**
	 * This test validates the fix for the personal sign validation bug.
	 * The issue was in pubToAddrStr function which was incorrectly slicing
	 * the hash buffer, causing address comparison to always fail.
	 */

	it('should correctly validate personal message signature', () => {
		// Create a test private key and derive public key
		const privateKey = Buffer.from(
			'0101010101010101010101010101010101010101010101010101010101010101',
			'hex',
		)
		const publicKey = secp256k1.publicKeyCreate(privateKey, false)

		// Create a test message
		const message = Buffer.from('Test message', 'utf8')

		// Build personal sign prefix and hash
		const prefix = Buffer.from(
			`\u0019Ethereum Signed Message:\n${message.length.toString()}`,
			'utf-8',
		)
		const messageHash = Buffer.from(
			Hash.keccak256(Buffer.concat([prefix, message])),
		)

		// Sign the message
		const sigObj = secp256k1.ecdsaSign(messageHash, privateKey)

		// Prepare signature object
		const sig = {
			r: Buffer.from(sigObj.signature.slice(0, 32)),
			s: Buffer.from(sigObj.signature.slice(32, 64)),
		}

		// Get the Ethereum address from the public key
		// This matches what the firmware returns
		const pubkeyWithoutPrefix = publicKey.slice(1) // Remove 0x04 prefix
		const addressBuffer = Buffer.from(
			Hash.keccak256(pubkeyWithoutPrefix),
		).slice(-20)

		// This is the function that was failing before the fix
		// It should now correctly add the recovery parameter
		const result = addRecoveryParam(messageHash, sig, addressBuffer, {
			chainId: 1,
			useEIP155: false,
		})

		// Verify the signature has a valid v value (27 or 28)
		expect(result.v).toBeDefined()
		const vValue = Buffer.isBuffer(result.v)
			? result.v.readUInt8(0)
			: Number(result.v)
		expect([27, 28]).toContain(vValue)

		// Verify r and s are buffers of correct length
		expect(Buffer.isBuffer(result.r)).toBe(true)
		expect(Buffer.isBuffer(result.s)).toBe(true)
		expect(result.r.length).toBe(32)
		expect(result.s.length).toBe(32)
	})

	it('should throw error when signature does not match address', () => {
		// Create a test message hash
		const messageHash = Buffer.from(Hash.keccak256(Buffer.from('test')))

		// Create a random signature
		const sig = {
			r: Buffer.from('1'.repeat(64), 'hex'),
			s: Buffer.from('2'.repeat(64), 'hex'),
		}

		// Use a random address that won't match the signature
		const wrongAddress = Buffer.from('3'.repeat(40), 'hex')

		// This should throw because the signature doesn't match the address
		expect(() => {
			addRecoveryParam(messageHash, sig, wrongAddress, {
				chainId: 1,
				useEIP155: false,
			})
		}).toThrow() // Just verify it throws, exact message may vary
	})

	it('should handle the exact scenario from Ambire bug report', () => {
		// This is the exact scenario reported by Kalo from Ambire
		const testPayload = '0x54657374206d657373616765' // "Test message" in hex
		const payloadBuffer = Buffer.from(testPayload.slice(2), 'hex')

		// Build personal sign hash
		const prefix = Buffer.from(
			`\u0019Ethereum Signed Message:\n${payloadBuffer.length.toString()}`,
			'utf-8',
		)
		const messageHash = Buffer.from(
			Hash.keccak256(Buffer.concat([prefix, payloadBuffer])),
		)

		// Create a valid signature for this message
		const privateKey = Buffer.from(
			'0101010101010101010101010101010101010101010101010101010101010101',
			'hex',
		)
		const publicKey = secp256k1.publicKeyCreate(privateKey, false)
		const sigObj = secp256k1.ecdsaSign(messageHash, privateKey)

		const sig = {
			r: Buffer.from(sigObj.signature.slice(0, 32)),
			s: Buffer.from(sigObj.signature.slice(32, 64)),
		}

		// Get address from public key
		const pubkeyWithoutPrefix = publicKey.slice(1)
		const addressBuffer = Buffer.from(
			Hash.keccak256(pubkeyWithoutPrefix),
		).slice(-20)

		// This should NOT throw with the fix in place
		expect(() => {
			const result = addRecoveryParam(messageHash, sig, addressBuffer, {
				chainId: 1,
				useEIP155: false,
			})

			// Verify we got a valid result
			expect(result.v).toBeDefined()
			expect(result.r).toBeDefined()
			expect(result.s).toBeDefined()
		}).not.toThrow()
	})
})
