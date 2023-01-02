# Functional API

The functional API is a set of functions that can be used to connect, pair,
 get addresses, get address tags, and sign transactions.

## Functions

### `connect`

### `pair`

### `getAddresses`

### `getAddressTags`

### `sign`

## How To Use

```ts
import { setup, connect, pair, getAddresses, getAddressTags, sign } from '@gridplus/api'

// setup

setup('deviceId', 'password', 'name')
// Initialize connection
await connect('deviceId')
  .then((isPaired) => {
    if (!isPaired) {
    // Pair with device
    await pair('pairing code')
    }
  })
// Get addresses
const addresses = await getAddresses()

// Get address tags
const addressTags = await getAddressTags()
// Sign transaction
const signedTx = await sign(tx)
```
