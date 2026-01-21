import { PublicKey } from '@solana/web3.js'
import { question } from 'readline-sync'
import { pair } from '../../../api'
import { fetchSolanaAddresses } from '../../../api/addresses'
import { setupClient } from '../../utils/setup'

describe('Solana Addresses', () => {
  test('pair', async () => {
    const isPaired = await setupClient()
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ')
      await pair(secret.toUpperCase())
    }
  })

  test('Should fetch a single Solana Ed25519 public key using fetchSolanaAddresses', async () => {
    const addresses = await fetchSolanaAddresses({
      n: 10,
    })

    const addrs = addresses
      .filter((addr) => {
        try {
          // Check if the key is a valid Ed25519 public key
          const pk = new PublicKey(addr)
          const isOnCurve = PublicKey.isOnCurve(pk.toBytes())
          expect(isOnCurve).toBe(true)
          return true
        } catch (e) {
          console.error('Invalid Solana public key:', e)
          return false
        }
      })
      .map((addr) => {
        const pk = new PublicKey(addr)
        return pk.toBase58()
      })

    // Ensure we got at least one valid address
    expect(addrs.length).toBeGreaterThan(0)
    // Ensure none of the addresses start with '11111'
    expect(addrs.every((addr) => !addr.startsWith('11111'))).toBe(true)
  })
})
