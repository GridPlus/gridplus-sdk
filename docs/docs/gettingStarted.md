---
id: "getting-started"
sidebar_position: 1
---

# 🎬 Getting Started

First install this SDK with:

```bash
npm install --save gridplus-sdk
```

To connect to a Lattice, you need to create an instance of `Client`:

```ts
import { Client } from 'gridplus-sdk'
```

You can use the following options:

| Param | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `name` | string | Y | A human readable name for your app. This will be displayed with your app's pairing on the user's Lattice. |
| `privKey` | `Buffer` | N | 32-byte buffer, not required but highly recommended. If none is specified, a random one will be created at initialization. This is used to build the encrypted channel. If you want to manually restart a connection with a new `Client` instance, you will need to use the same `privKey` in the constructor. |
| `retryCount` | number | N | Default is 3. Number of automatic retries allowed per request. Covers timeouts and certain device errors. |
| `timeout` | number | N | Milliseconds to timeout HTTP request. Defaults to 60s. |
| `stateData` | string | N | Used to rehydrate a session without other params. Result of call to `getStateData()`. |

## 🔗 Connecting to a Lattice

Once `Client` is initialized, you need to connect to the target Lattice. This can happen one of three ways:

### 1️⃣ Pairing with a new Lattice

If you have not setup a pairing with the Lattice in question, you will need to do that first.

1. Call `connect` with the `deviceId` of the target Lattice
2. The Lattice should generate and display a pairing code, valid for 60 seconds. Call `pair` with this code.
3. If successful, you should now have a pairing between the SDK and the Lattice. This pairing maintains an encrypted channel. If that ever gets out of sync, it should repair automatically with a retry.

#### Example: pairing with a Lattice

```ts
const isPaired = await client.connect(deviceID)
if (!isPaired) {
  // Wait for the user to enter the pairing secret displayed on the device  
  const secret = await question('Enter pairing secret: ')
  await client.pair(secret)
}
```

### 2️⃣ Connecting to a known Lattice

If the Lattice in question already has a pairing with your app (and therefore a recoverable encrypted channel), the connection process is easy.

1. Call `connect` with the `deviceId` of the target Lattice

#### Example: connecting to a known Lattice

```ts
const isPaired = await client.connect(deviceID)

expect(isPaired).to.equal(true)
```

### 3️⃣ Rehydrating an SDK session

You can always start a new SDK session with the same `privKey` in the constructor, which will always build an encrypted channel when you call `connect` on a paired Lattice. However, you can skip this step by exporting state data and then using that in the constructor. First you need to get the state data before you stop using the connection.

#### Example: drying and rehydrating a client session

```ts
// Fetch some addresses from existing client
const addrs1 = await client.getAddresses(addrReqData)

// Capture the state data from that client
const stateData = client.getStateData()

// Create a new client with the state data
const clientDos = new Client({ stateData })

// You can now call this without connecting
const addrs2 = await clientDos.getAddresses(addrReqData)

// The addresses should match and there should be no errors
expect(addrs1).to.equal(addrs2)
```
