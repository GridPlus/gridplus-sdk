import { question } from 'readline-sync'
import { pair } from '../../../api'
import { fetchAddresses } from '../../../api/addresses'
import { setupClient } from '../../utils/setup'

describe('Ethereum Addresses', () => {
  test('pair', async () => {
    const isPaired = await setupClient()
    if (!isPaired) {
      const secret = question('Please enter the pairing secret: ')
      await pair(secret.toUpperCase())
    }
  })

  test('Should fetch addressess', async () => {
    const addresses = await fetchAddresses()
    expect(addresses.length).toBe(10)
    expect(addresses.every((addr) => !addr.startsWith('11111'))).toBe(true)
  })
})
