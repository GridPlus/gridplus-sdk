---
id: "index"
title: "👋 Getting Started"
slug: "/"
sidebar_position: 0
custom_edit_url: null
---

# GridPlus SDK

The [GridPlus SDK](https://github.com/GridPlus/gridplus-sdk) is designed to facilitate communication between an app or service and a user's [Lattice1 hardware wallet](https://gridplus.io/lattice).

:::note
The [Lattice1](https://gridplus.io/lattice) is an Internet-connected device which listens for end-to-end encrypted requests. HTTPS requests originate from this SDK and responses are returned **asynchronously**. Some requests require user authorization and will time out if the user does not approve them.

If you are using the `gridplus-sdk` in a Node.js application with a version of Node lower than v18, you will need to patch the `fetch()` API in the global scope. One solution is to use the `node-fetch` package. See [the `node-fetch` README](https://github.com/node-fetch/node-fetch#installation) for instructions. Other options are available on NPM.

:::

## Installing

First install this SDK with:

```bash
npm install --save gridplus-sdk
```

## Connecting to a Lattice

You first need to instantiate a new [`Client`](./api/classes/client.Client) object with, at a minimum, the name of your requesting app (see [`Client` doc](./api/classes/client.Client) for a full list of options). The `name` used to instantiate `Client` will show up on the desired Lattice when pairing, so you should name it something relevant to your app/service.

```ts
import { Client } from 'gridplus-sdk';

const client = new Client({ name: 'SDK Connectooor' });
```

You can now use your `client` object to connect to a specific Lattice1 device, which should have a unique `deviceID`, discoverable through the client's `baseUrl`.

:::info
Lattices are discoverable over a combination of `deviceID` and `baseUrl`. By default, `baseUrl` (an attribute of `Client` and a config option when creating an instance) points to the GridPlus routing cloud service, but you can also create your own endpoint using [Lattice Connect](https://github.com/GridPlus/lattice-connect-v2). 

When a Lattice connects to a routing service (located at some `baseUrl`) for the first time, that server should generate a `deviceID` for the connecting Lattice. At this point, the Lattice will save the newly issued `deviceID` and will listen for corresponding messages coming from `baseUrl` (these messages are always **end-to-end encrypted**). The Lattice should be permanently discoverable at this `baseUrl`/`deviceID` combination unless/until its user resets the Lattice Router or switches the device to a new routing service.
:::

### Pairing vs Connecting 

The connection process depends on whether your app/service is already **paired** to the target Lattice. **Pairing** is a process involving key exchange and [ECDH](https://en.wikipedia.org/wiki/Elliptic-curve_Diffie%E2%80%93Hellman) shared key generation between the target Lattice and your `Client` instance, such that future messages can be end-to-end encrypted.

:::caution
`Client` has a `privKey` attribute (a 32-byte buffer or hex string), which is used to encrypt/decrypt messages. By default, `privKey` is generated randomly, but it is **highly recommended** you generate your own private key deterministically or [stash and rehydrate](#stashing-and-rehydrating-an-sdk-instance) the instance if you wish to re-use the app/service with the target Lattice(s). If you naively create a new `Client` instance with a random `privKey`, it will force a re-pairing with the target Lattice(s).
:::

If you are **not** paired to the target Lattice already, the connection request will cause the Lattice to generate a new **pairing code** and display that on the device's screen. That code must be entered into the `Client` instance within 60 seconds, i.e. before it expires. This process only happens **once per pairing**, so subsequent `connect` requests should reach the target Lattice without having to re-pair. However, any Lattice user may remove any pairing from their device at any time. If this happens, you will need to re-pair with the device in order to make any new requests.

```ts
import { Client, Constants, Utils } from 'gridplus-sdk';
import { question } from 'readline-sync';
const deviceID = 'XXXXXX';
const numValidators = 5;

// Instantiate the `Client` object with a name. Here we will use the
// default `baseUrl`, i.e. GridPlus routing service.
const client = new Client({ name: 'SDK Connectooor' });

// Call `connect` to determine if we are already paired
const isPaired = await client.connect(deviceID);

if (!isPaired) {
  // If not paired, the secret needs to get sent to `pair`
  const secret = await question('Enter pairing secret: ');
  await client.pair(secret);
}
```


### Stashing and Rehydrating an SDK Instance

As mentioned above, naively generating new `Client` instances without deterministically generating a `privKey` will require a pairing with target Lattice(s). If you don't want to deterministically generate and set the `privKey` attribute, you can also let `Client` generate a random one and then stash your `Client` instance:

```ts
const clientStash = client.getStateData();
const client2 = new Client({ stateData: clientStash, });
```

## Now What?

Once your `client` is paired or otherwise connected to the target Lattice, you can make full use of the SDK. 

Some actions, such as requesting signatures, require **user authorization** on the device or they will time out. Other actions, such as fetching public keys, can be made as long as there is a pairing with the target Lattice.

The rest of these docs will cover basic functionality (e.g. [getting addresses](./addresses) and [making signatures](./signing)) as well as tutorials on more advanced topics, which would typically be built into a UI such as the [Lattice Manager](https://lattice.gridplus.io) or an integrated app such as [MetaMask](https://metamask.io).

You can always consult the [API Docs](./api/classes/client.Client) for more specific information on options related to various SDK functions.
