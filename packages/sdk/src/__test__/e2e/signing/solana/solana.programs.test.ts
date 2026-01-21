/**
 * REQUIRED TEST MNEMONIC:
 * These tests require a SafeCard loaded with the standard test mnemonic:
 * "test test test test test test test test test test test junk"
 *
 * Running with a different mnemonic will cause test failures due to
 * incorrect key derivations and signature mismatches.
 */
import { Constants } from '../../../..'
import type { Client } from '../../../../client'
import { setupClient } from '../../../utils/setup'
import { dexlabProgram, raydiumProgram } from './__mocks__/programs'

describe('Solana Programs', () => {
  let client: Client

  beforeAll(async () => {
    client = await setupClient()
  })

  it('should sign Dexlab program', async () => {
    const payload = dexlabProgram
    const signedMessage = await client.sign({
      data: {
        signerPath: [0x80000000 + 44, 0x80000000 + 501, 0x80000000],
        curveType: Constants.SIGNING.CURVES.ED25519,
        hashType: Constants.SIGNING.HASHES.NONE,
        encodingType: Constants.SIGNING.ENCODINGS.SOLANA,
        payload,
      },
    })
    expect(signedMessage).toBeTruthy()
  })

  it('should sign Raydium program', async () => {
    const payload = raydiumProgram
    const signedMessage = await client.sign({
      data: {
        signerPath: [0x80000000 + 44, 0x80000000 + 501, 0x80000000],
        curveType: Constants.SIGNING.CURVES.ED25519,
        hashType: Constants.SIGNING.HASHES.NONE,
        encodingType: Constants.SIGNING.ENCODINGS.SOLANA,
        payload,
      },
    })
    expect(signedMessage).toBeTruthy()
  })
})
