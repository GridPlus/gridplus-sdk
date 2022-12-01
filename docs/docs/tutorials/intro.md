# 📜 Tutorials Overview

This section contains various tutorials, which are designed to showcase more advanced (but still useful) Lattice functionality. Typically these patterns would be integrated into a UI such as the [Lattice Manager](https://lattice.gridplus.io) or an integrated app such as [MetaMask](https://metamask.io).

## Setting up a Connection

The first step to each of these tutorials is to instantiate the GridPlus SDK and connect that instance to your Lattice. Each tutorial will reference this section.

As discussed in [Getting Started](../getting-started), you need to instantiate a new [`Client`](../api/classes/client.Client) object with, at a minimum, the name of your requesting app (see [`Client` doc](../api/classes/client.Client) for a full list of options). The `name` used to instantiate `Client` will show up on the desired Lattice when pairing, so you should name it something relevant to your app/service.

### Discovering a Lattice

:::info
Lattices are discoverable over a combination of `deviceID` and `baseUrl`. By default, `baseUrl` points to the GridPlus routing cloud service, but you can also create your own endpoint using [Lattice Connect](https://github.com/GridPlus/lattice-connect-v2). When a Lattice connects to a routing server for the first time, that server should generate a `deviceID` for the connecting Lattice. At this point, the Lattice will save the newly issued `deviceID` and will listen for messages using that id (note that messages are always encrypted). The Lattice should be permanently discoverable at this `baseUrl`/`deviceID` unless/until its user resets the Lattice Router or switches the device to a new routing service.
:::

If you are **not** paired to the target Lattice already, the connection request will cause the Lattice to generate a new pairing code and display that on the device's screen. That code must be sent to the SDK instance within 60 seconds, i.e. before it expires. This process only happens once per pairing, so subsequent `connect` requests should reach the target Lattice without having to re-pair.

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

## Using the `Client` Instance

Now that you are paired, you can perform all supported actions on the target Lattice. Some actions, such as signatures, require user authorization on the device or they will time out. Others, such as fetching public keys, can be made as long as there is a pairing with the target Lattice.

:::note
Any Lattice user may remove any pairing from the device at any time. If this happens, you will need to re-pair with the device in order to make any new requests.
:::