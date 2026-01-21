import { HARDENED_OFFSET } from '../../../constants'
import type { SignRequestParams, WalletPath } from '../../../types'
import { randomBytes } from '../../../util'
import { DEFAULT_SIGNER, buildMsgReq, buildRandomVectors, buildTx, buildTxReq } from '../../utils/builders'
import { deriveAddress, signEip712JS, signPersonalJS, testUniformSigs } from '../../utils/determinism'
/**
 * REQUIRED TEST MNEMONIC:
 * These tests require a SafeCard loaded with the standard test mnemonic:
 * "test test test test test test test test test test test junk"
 *
 * Running with a different mnemonic will cause test failures due to
 * incorrect address derivations and signature mismatches.
 */
import { getDeviceId } from '../../utils/getters'
import { BTC_PURPOSE_P2PKH, ETH_COIN, getSigStr } from '../../utils/helpers'
import { setupClient } from '../../utils/setup'
import { TEST_SEED } from '../../utils/testConstants'
import type { Client } from '../../../client'

describe('[Determinism]', () => {
	let client: Client

	beforeAll(async () => {
		client = await setupClient()
	})

	describe('Setup and validate seed', () => {
		it('Should re-connect to the Lattice and update the walletUID.', async () => {
			expect(getDeviceId()).to.not.equal(null)
			await client.connect(getDeviceId())
			expect(client.isPaired).toEqual(true)
			expect(!!client.getActiveWallet()).toEqual(true)
		})

		it('Should validate some Ledger addresses derived from the test seed', async () => {
			const path0 = [BTC_PURPOSE_P2PKH, ETH_COIN, HARDENED_OFFSET, 0, 0] as WalletPath
			const addr0 = deriveAddress(TEST_SEED, path0)
			const path1 = [BTC_PURPOSE_P2PKH, ETH_COIN, HARDENED_OFFSET + 1, 0, 0] as WalletPath
			const addr1 = deriveAddress(TEST_SEED, path1)
			const path8 = [BTC_PURPOSE_P2PKH, ETH_COIN, HARDENED_OFFSET + 8, 0, 0] as WalletPath
			const addr8 = deriveAddress(TEST_SEED, path8)
			// Fetch these addresses from the Lattice and validate

			const req = {
				currency: 'ETH',
				startPath: path0,
				n: 1,
			}
			const latAddr0 = await client.getAddresses(req)
			expect((latAddr0[0] as string).toLowerCase()).toEqualElseLog(addr0.toLowerCase(), 'Incorrect address 0 fetched. Ensure your SafeCard is loaded with the test mnemonic: "test test test test test test test test test test test junk"')
			req.startPath = path1
			const latAddr1 = await client.getAddresses(req)
			expect((latAddr1[0] as string).toLowerCase()).toEqualElseLog(addr1.toLowerCase(), 'Incorrect address 1 fetched. Ensure your SafeCard is loaded with the test mnemonic: "test test test test test test test test test test test junk"')
			req.startPath = path8
			const latAddr8 = await client.getAddresses(req)
			expect((latAddr8[0] as string).toLowerCase()).toEqualElseLog(addr8.toLowerCase(), 'Incorrect address 8 fetched. Ensure your SafeCard is loaded with the test mnemonic: "test test test test test test test test test test test junk"')
		})
	})

	describe('Test uniformity of Ethereum transaction sigs', () => {
		it("Should validate uniformity sigs on m/44'/60'/0'/0/0", async () => {
			const tx = buildTx()
			const txReq = buildTxReq(tx)
			txReq.data.signerPath[2] = HARDENED_OFFSET
			await testUniformSigs(txReq, tx, client)
		})

		it("Should validate uniformity sigs on m/44'/60'/1'/0/0", async () => {
			const tx = buildTx()
			const txReq = buildTxReq(tx)
			txReq.data.signerPath[2] = HARDENED_OFFSET + 1
			await testUniformSigs(txReq, tx, client)
		})

		it("Should validate uniformity sigs on m/44'/60'/8'/0/0", async () => {
			const tx = buildTx()
			const txReq = buildTxReq(tx)
			txReq.data.signerPath[2] = HARDENED_OFFSET + 8
			await testUniformSigs(txReq, tx, client)
		})

		it("Should validate uniformity sigs on m/44'/60'/0'/0/0", async () => {
			const tx = buildTx(`0x${randomBytes(4000).toString('hex')}`)
			const txReq = buildTxReq(tx)
			txReq.data.signerPath[2] = HARDENED_OFFSET
			await testUniformSigs(txReq, tx, client)
		})

		it("Should validate uniformity sigs on m/44'/60'/1'/0/0", async () => {
			const tx = buildTx(`0x${randomBytes(4000).toString('hex')}`)
			const txReq = buildTxReq(tx)
			txReq.data.signerPath[2] = HARDENED_OFFSET + 1
			await testUniformSigs(txReq, tx, client)
		})

		it("Should validate uniformity sigs on m/44'/60'/8'/0/0", async () => {
			const tx = buildTx(`0x${randomBytes(4000).toString('hex')}`)
			const txReq = buildTxReq(tx)
			txReq.data.signerPath[2] = HARDENED_OFFSET + 8
			await testUniformSigs(txReq, tx, client)
		})
	})

	describe('Compare personal_sign signatures vs Ledger vectors (1)', () => {
		it('Should validate signature from addr0', async () => {
			const msgReq = buildMsgReq()
			msgReq.data.signerPath[2] = HARDENED_OFFSET
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice sig does not match JS reference')
		})

		it('Should validate signature from addr1', async () => {
			const msgReq = buildMsgReq()
			msgReq.data.signerPath[2] = HARDENED_OFFSET + 1
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice sig does not match JS reference')
		})

		it('Should validate signature from addr8', async () => {
			const msgReq = buildMsgReq()
			msgReq.data.signerPath[2] = HARDENED_OFFSET + 8
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice sig does not match JS reference')
		})
	})

	describe('Compare personal_sign signatures vs Ledger vectors (2)', () => {
		it('Should validate signature from addr0', async () => {
			const msgReq = buildMsgReq('hello ethereum this is another message')
			msgReq.data.signerPath[2] = HARDENED_OFFSET
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice sig does not match JS reference')
		})

		it('Should validate signature from addr1', async () => {
			const msgReq = buildMsgReq('hello ethereum this is another message')
			msgReq.data.signerPath[2] = HARDENED_OFFSET + 1
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice sig does not match JS reference')
		})

		it('Should validate signature from addr8', async () => {
			const msgReq = buildMsgReq('hello ethereum this is another message')
			msgReq.data.signerPath[2] = HARDENED_OFFSET + 8
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice sig does not match JS reference')
		})
	})

	describe('Compare personal_sign signatures vs Ledger vectors (3)', () => {
		it('Should validate signature from addr0', async () => {
			const msgReq = buildMsgReq('third vector yo')
			msgReq.data.signerPath[2] = HARDENED_OFFSET
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice sig does not match JS reference')
		})

		it('Should validate signature from addr1', async () => {
			const msgReq = buildMsgReq('third vector yo')
			msgReq.data.signerPath[2] = HARDENED_OFFSET + 1
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice sig does not match JS reference')
		})

		it('Should validate signature from addr8', async () => {
			const msgReq = buildMsgReq('third vector yo')
			msgReq.data.signerPath[2] = HARDENED_OFFSET + 8
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signPersonalJS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice sig does not match JS reference')
		})
	})

	describe('Compare EIP712 signatures vs Ledger vectors (1)', () => {
		const msgReq = {
			currency: 'ETH_MSG',
			data: {
				signerPath: DEFAULT_SIGNER,
				protocol: 'eip712',
				payload: {
					types: {
						Greeting: [
							{
								name: 'salutation',
								type: 'string',
							},
							{
								name: 'target',
								type: 'string',
							},
							{
								name: 'born',
								type: 'int32',
							},
						],
						EIP712Domain: [
							{
								name: 'chainId',
								type: 'uint256',
							},
						],
					},
					domain: {
						chainId: 1,
					},
					primaryType: 'Greeting',
					message: {
						salutation: 'Hello',
						target: 'Ethereum',
						born: '2015',
					},
				},
			},
		}

		it('Should validate signature from addr0', async () => {
			msgReq.data.signerPath[2] = HARDENED_OFFSET
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signEip712JS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice EIP712 sig does not match JS reference')
		})

		it('Should validate signature from addr1', async () => {
			msgReq.data.signerPath[2] = HARDENED_OFFSET + 1
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signEip712JS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice EIP712 sig does not match JS reference')
		})

		it('Should validate signature from addr8', async () => {
			msgReq.data.signerPath[2] = HARDENED_OFFSET + 8
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signEip712JS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice EIP712 sig does not match JS reference')
		})
	})

	describe('Compare EIP712 signatures vs Ledger vectors (2)', () => {
		const msgReq = {
			currency: 'ETH_MSG',
			data: {
				signerPath: DEFAULT_SIGNER,
				protocol: 'eip712',
				payload: {
					types: {
						MuhType: [
							{
								name: 'thing',
								type: 'string',
							},
						],
						EIP712Domain: [
							{
								name: 'chainId',
								type: 'uint256',
							},
						],
					},
					domain: {
						chainId: 1,
					},
					primaryType: 'MuhType',
					message: {
						thing: 'I am a string',
					},
				},
			},
		}

		it('Should validate signature from addr0', async () => {
			msgReq.data.signerPath[2] = HARDENED_OFFSET
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signEip712JS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice EIP712 sig does not match JS reference')
		})

		it('Should validate signature from addr1', async () => {
			msgReq.data.signerPath[2] = HARDENED_OFFSET + 1
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signEip712JS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice EIP712 sig does not match JS reference')
		})

		it('Should validate signature from addr8', async () => {
			msgReq.data.signerPath[2] = HARDENED_OFFSET + 8
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signEip712JS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice EIP712 sig does not match JS reference')
		})
	})

	describe('Compare EIP712 signatures vs Ledger vectors (3)', () => {
		const msgReq = {
			currency: 'ETH_MSG',
			data: {
				signerPath: DEFAULT_SIGNER,
				protocol: 'eip712',
				payload: {
					types: {
						MuhType: [
							{
								name: 'numbawang',
								type: 'uint32',
							},
						],
						EIP712Domain: [
							{
								name: 'chainId',
								type: 'uint256',
							},
						],
					},
					domain: {
						chainId: 1,
					},
					primaryType: 'MuhType',
					message: {
						numbawang: 999,
					},
				},
			},
		}

		it('Should validate signature from addr0', async () => {
			msgReq.data.signerPath[2] = HARDENED_OFFSET
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signEip712JS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice EIP712 sig does not match JS reference')
		})
		it('Should validate signature from addr1', async () => {
			msgReq.data.signerPath[2] = HARDENED_OFFSET + 1
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signEip712JS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice EIP712 sig does not match JS reference')
		})
		it('Should validate signature from addr8', async () => {
			msgReq.data.signerPath[2] = HARDENED_OFFSET + 8
			const res = await client.sign(msgReq as unknown as SignRequestParams)
			const sig = getSigStr(res)
			const jsSig = signEip712JS(msgReq.data.payload, msgReq.data.signerPath)
			expect(sig).toEqualElseLog(jsSig, 'Lattice EIP712 sig does not match JS reference')
		})
	})

	describe('Test random personal_sign messages against JS signatures', () => {
		const randomVectors = buildRandomVectors()
		const signerPathOffsets = [0, 1, 8]

		randomVectors.forEach((payload, i) => {
			signerPathOffsets.forEach(async (offset) => {
				it(`Should test random vector: ${i} with offset ${offset}`, async () => {
					const req = {
						currency: 'ETH_MSG',
						data: {
							signerPath: DEFAULT_SIGNER,
							protocol: 'signPersonal',
							payload,
						},
					}
					req.data.signerPath[2] = HARDENED_OFFSET + offset
					const jsSig = signPersonalJS(req.data.payload, req.data.signerPath)
					const res = await client.sign(req as unknown as SignRequestParams)
					const sig = getSigStr(res)
					expect(sig).toEqualElseLog(jsSig, `Addr${offset} sig failed`)
				})
			})
		})
	})
})
