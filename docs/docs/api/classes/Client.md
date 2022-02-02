---
id: "Client"
title: "Class: Client"
sidebar_label: "Client"
sidebar_position: 0
custom_edit_url: null
---

`Client` is a class-based interface for managing a Lattice device.

## Constructors

### constructor

• **new Client**(`params`)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | Parameters are passed as an object. |
| `params.baseUrl?` | `string` | The base URL of the signing server. |
| `params.crypto` | `string` | The crypto library to use. Currently only 'secp256k1' is supported. |
| `params.key?` | `string` | The public key of the client. |
| `params.name` | `string` | The name of the client. |
| `params.pairingSalt?` | `string` | A random string used to salt the pairing code. |
| `params.privKey?` | `string` | The private key of the client. |
| `params.retryCount?` | `number` | Number of times to retry a request if it fails. |
| `params.timeout?` | `number` | The time to wait for a response before cancelling. |

#### Defined in

[client.ts:88](https://github.com/GridPlus/gridplus-sdk/blob/f7e52cf/src/client.ts#L88)

## Properties

### isPaired

• **isPaired**: `boolean`

Is the Lattice paired with this Client.

#### Defined in

[client.ts:42](https://github.com/GridPlus/gridplus-sdk/blob/f7e52cf/src/client.ts#L42)

___

### timeout

• **timeout**: `number`

The time to wait for a response before cancelling.

#### Defined in

[client.ts:44](https://github.com/GridPlus/gridplus-sdk/blob/f7e52cf/src/client.ts#L44)

## Lattice Methods

### addAbiDefs

▸ **addAbiDefs**(`defs`, `cb`, `nextCode?`): `any`

`addAbiDefs` sends a list of ABI definitions to the device in chunks of up to `MAX_ABI_DEFS`.

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `defs` | `any` | `undefined` |
| `cb` | `any` | `undefined` |
| `nextCode` | `any` | `null` |

#### Returns

`any`

The decrypted response.

#### Defined in

[client.ts:402](https://github.com/GridPlus/gridplus-sdk/blob/f7e52cf/src/client.ts#L402)

___

### addKvRecords

▸ **addKvRecords**(`opts`, `cb`): `any`

`addKvRecords` takes in a set of key-value records and sends a request to add them to the
Lattice.

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `any` |
| `cb` | `any` |

#### Returns

`any`

A callback with an error or null.

#### Defined in

[client.ts:562](https://github.com/GridPlus/gridplus-sdk/blob/f7e52cf/src/client.ts#L562)

___

### addPermissionV0

▸ **addPermissionV0**(`opts`, `cb`): `any`

`addPermissionV0` takes in a currency, time window, spending limit, and decimals, and builds a
payload to send to the Lattice.

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `any` |
| `cb` | `any` |

#### Returns

`any`

#### Defined in

[client.ts:439](https://github.com/GridPlus/gridplus-sdk/blob/f7e52cf/src/client.ts#L439)

___

### connect

▸ **connect**(`deviceId`, `cb`): `any`

`connect` will attempt to contact a device based on its deviceId. The response should include
an ephemeral public key, which is used to pair with the device in a later request.

#### Parameters

| Name | Type |
| :------ | :------ |
| `deviceId` | `any` |
| `cb` | `any` |

#### Returns

`any`

#### Defined in

[client.ts:157](https://github.com/GridPlus/gridplus-sdk/blob/f7e52cf/src/client.ts#L157)

___

### getAddresses

▸ **getAddresses**(`opts`, `cb`): `any`

`getAddresses` takes a starting path and a number to get the addresses associated with the
active wallet.

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `Object` |
| `opts.n` | `UInt4` |
| `opts.startPath` | `number`[] |
| `cb` | `any` |

#### Returns

`any`

An array of addresses.

#### Defined in

[client.ts:257](https://github.com/GridPlus/gridplus-sdk/blob/f7e52cf/src/client.ts#L257)

___

### getKvRecords

▸ **getKvRecords**(`opts`, `cb`): `Buffer`

`getKvRecords` fetches a list of key-value records from the Lattice.

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `any` |
| `cb` | `any` |

#### Returns

`Buffer`

#### Defined in

[client.ts:488](https://github.com/GridPlus/gridplus-sdk/blob/f7e52cf/src/client.ts#L488)

___

### pair

▸ **pair**(`pairingSecret`, `cb`): `any`

If a pairing secret is provided, `pair` uses it to sign a hash of the public key, name, and
pairing secret. It then sends the name and signature to the device. If no pairing secret is
provided, `pair` sends a zero-length name buffer to the device.

#### Parameters

| Name | Type |
| :------ | :------ |
| `pairingSecret` | `any` |
| `cb` | `any` |

#### Returns

`any`

The active wallet object.

#### Defined in

[client.ts:192](https://github.com/GridPlus/gridplus-sdk/blob/f7e52cf/src/client.ts#L192)

___

### removeKvRecords

▸ **removeKvRecords**(`opts`, `cb`): `any`

`removeKvRecords` takes in an array of ids and sends a request to remove them from the Lattice.

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `any` |
| `cb` | `any` |

#### Returns

`any`

A callback with an error or null.

#### Defined in

[client.ts:646](https://github.com/GridPlus/gridplus-sdk/blob/f7e52cf/src/client.ts#L646)

___

### sign

▸ **sign**(`opts`, `cb`, `cachedData?`, `nextCode?`): `any`

`sign` builds and sends a request for signing to the device.

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `opts` | `any` | `undefined` |
| `cb` | `any` | `undefined` |
| `cachedData` | `any` | `null` |
| `nextCode` | `any` | `null` |

#### Returns

`any`

The response from the device.

#### Defined in

[client.ts:325](https://github.com/GridPlus/gridplus-sdk/blob/f7e52cf/src/client.ts#L325)

___

## Other Methods

### getActiveWallet

▸ **getActiveWallet**(): `Object`

Get the active wallet.

#### Returns

`Object`

The active wallet.

| Name | Type | Description |
| :------ | :------ | :------ |
| `capabilities` | `number` | 4 byte flag |
| `external` | `boolean` | External or internal wallet |
| `name` | `Buffer` | 20 char (max) string |
| `uid` | `Buffer` | 32 byte id |

#### Defined in

[client.ts:1217](https://github.com/GridPlus/gridplus-sdk/blob/f7e52cf/src/client.ts#L1217)

___

### parseAbi

▸ **parseAbi**(`source`, `data`, `skipErrors?`): `any`

TODO: Find a better way to export this.
`parseAbi` takes a source and data as arguments, and returns the parsed ABI.

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `source` | `any` | `undefined` | The name of the source of the ABI data. |
| `data` | `any` | `undefined` | The data to parse. |
| `skipErrors` | `boolean` | `false` | If true, errors will be skipped and the function will return an object with an error property. |

#### Returns

`any`

The parsed ABI.

#### Defined in

[client.ts:1265](https://github.com/GridPlus/gridplus-sdk/blob/f7e52cf/src/client.ts#L1265)
