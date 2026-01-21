import { useState } from 'react'
import {
  addAddressTags,
  fetchAddressTags,
  fetchAddresses,
  fetchLedgerLiveAddresses,
  removeAddressTags,
  sign,
  signMessage,
  type AddressTag,
} from 'gridplus-sdk'
import { Button } from './Button'

interface LatticeProps {
  label: string
}

export const Lattice = ({ label }: LatticeProps) => {
  const [addresses, setAddresses] = useState<string[]>([])
  const [addressTags, setAddressTags] = useState<AddressTag[]>([])
  const [ledgerAddresses, setLedgerAddresses] = useState<string[]>([])

  // Example EIP-1559 transaction payload using raw hex format
  const getTxPayload = (): `0x${string}` => {
    // Pre-serialized EIP-1559 transaction for example purposes
    return '0x02f8620180843b9aca00843b9aca0082c350940000000000000000000000000000000000000000880de0b6b3a764000080c0'
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        margin: '10px',
        padding: '25px',
        border: '1px solid black',
      }}
    >
      <h2>{label}</h2>
      <Button
        onClick={async () => {
          await sign(getTxPayload())
        }}
      >
        Sign
      </Button>
      <Button
        onClick={async () => {
          await signMessage('test message')
        }}
      >
        Sign Message
      </Button>

      <div>
        <h3>Addresses</h3>
        <ul>
          {addresses?.map((address) => (
            <li key={address}>{address}</li>
          ))}
        </ul>
      </div>
      <Button
        onClick={async () => {
          const addresses = await fetchAddresses()
          setAddresses(addresses)
        }}
      >
        Fetch Addresses
      </Button>
      <Button
        onClick={async () => {
          await addAddressTags([{ test: 'test' }])
          const addressTags = await fetchAddressTags()
          setAddressTags(addressTags)
        }}
      >
        Add Address Tag
      </Button>
      <Button
        onClick={async () => {
          const fetchedAddressTags = await fetchAddressTags()
          setAddressTags(fetchedAddressTags)
        }}
      >
        Fetch Address Tags
      </Button>
      <Button
        onClick={async () => {
          await removeAddressTags(addressTags)
          const fetchedAddressTags = await fetchAddressTags()
          setAddressTags(fetchedAddressTags)
        }}
      >
        Remove Address Tags
      </Button>
      <div>
        <h3>Address Tags</h3>
        <ul>
          {addressTags?.map((tag) => (
            <li key={tag.key}>
              {tag.key}: {tag.val}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3>Ledger Addresses</h3>
        <ul>
          {ledgerAddresses?.map((ledgerAddress) => (
            <li key={ledgerAddress}>{ledgerAddress}</li>
          ))}
        </ul>
      </div>
      <Button
        onClick={async () => {
          const ledgerAddresses = await fetchLedgerLiveAddresses()
          setLedgerAddresses(ledgerAddresses)
        }}
      >
        Fetch Ledger Addresses
      </Button>
    </div>
  )
}
