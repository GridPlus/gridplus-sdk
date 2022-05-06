---
id: "client.Client"
title: "Class: Client"
sidebar_label: "Client"
custom_edit_url: null
---

[client](../modules/client).Client

`Client` is a class-based interface for managing a Lattice device.

## Constructors

### constructor

• **new Client**(`params`)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `params` | `Object` | Parameters are passed as an object. |
| `params.baseUrl?` | `string` | The base URL of the signing server. |
| `params.name?` | `string` | The name of the client. |
| `params.privKey?` | `string` \| `Buffer` | The private key of the client. |
| `params.retryCount?` | `number` | Number of times to retry a request if it fails. |
| `params.skipRetryOnWrongWallet` | `boolean` | If true we will not retry if we get a wrong wallet error code |
| `params.stateData?` | `string` | User can pass in previous state data to rehydrate connected session |
| `params.timeout?` | `number` | The time to wait for a response before cancelling. |

#### Defined in

[client.ts:96](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L96)

## Properties

### isPaired

• **isPaired**: `boolean`

Is the Lattice paired with this Client.

#### Defined in

[client.ts:53](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L53)

___

### timeout

• **timeout**: `number`

The time to wait for a response before cancelling.

#### Defined in

[client.ts:55](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L55)

## Lattice Methods

### addDecoders

▸ **addDecoders**(`opts`, `_cb?`): `Promise`<`void`\>

`addDecoders` sends an RLP-encoded list of decoders to the Lattice. A "decoder" is a piece of
data that can be used to decode some data in the future. The best example of this is the ABI
defintion of a contract function. This definition is used to deserialize EVM calldata for
future requests that call the specified function (as determined by the function selector).

NOTE: The CRUD API to manage calldata decoders is written, but is currently
compiled out of firmware to free up code space. For now we will leave
these functions commented out.
NOTE: You will need to re-enable `import { encode as rlpEncode } from 'rlp';`

**`deprecated`**

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `Object` |
| `opts.decoderType` | `number` |
| `opts.decoders` | `Buffer`[] |
| `_cb?` | (`err?`: `string`) => `void` |

#### Returns

`Promise`<`void`\>

The decrypted response.

#### Defined in

[client.ts:556](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L556)

___

### addKvRecords

▸ **addKvRecords**(`opts`, `_cb?`): `Promise`<`void`\>

`addKvRecords` takes in a set of key-value records and sends a request to add them to the
Lattice.

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `Object` |
| `opts.caseSensitive` | `boolean` |
| `opts.records` | `KVRecord`[] |
| `opts.type?` | `number` |
| `_cb?` | (`err?`: `string`) => `void` |

#### Returns

`Promise`<`void`\>

A callback with an error or null.

#### Defined in

[client.ts:905](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L905)

___

### addPermissionV0

▸ **addPermissionV0**(`opts`, `_cb?`): `Promise`<`void`\>

`addPermissionV0` takes in a currency, time window, spending limit, and decimals, and builds a
payload to send to the Lattice.

NOTE: This feature has been deprecated, but may be replaced in the future.

**`deprecated`**

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `Object` |
| `opts.asset` | `string` |
| `opts.currency` | `string` |
| `opts.decimals` | `number` |
| `opts.limit` | `number` |
| `opts.timeWindow` | `number` |
| `_cb?` | (`err?`: `string`) => `void` |

#### Returns

`Promise`<`void`\>

#### Defined in

[client.ts:751](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L751)

___

### connect

▸ **connect**(`deviceId`, `_cb?`): `Promise`<`boolean`\>

`connect` will attempt to contact a device based on its deviceId. The response should include
an ephemeral public key, which is used to pair with the device in a later request.

#### Parameters

| Name | Type |
| :------ | :------ |
| `deviceId` | `string` |
| `_cb?` | (`err?`: `string`, `isPaired?`: `boolean`) => `void` |

#### Returns

`Promise`<`boolean`\>

#### Defined in

[client.ts:212](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L212)

___

### getAddresses

▸ **getAddresses**(`opts`, `_cb?`): `Promise`<`Buffer`\>

`getAddresses` takes a starting path and a number to get the addresses associated with the
active wallet.

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `Object` |
| `opts.flag` | `number` |
| `opts.n` | `number` |
| `opts.startPath` | `number`[] |
| `_cb?` | (`err?`: `string`, `data?`: `Buffer` \| `string`[]) => `void` |

#### Returns

`Promise`<`Buffer`\>

An array of addresses.

#### Defined in

[client.ts:325](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L325)

___

### getDecoders

▸ **getDecoders**(`opts`, `_cb?`): `Promise`<{ `decoders`: `Buffer`[] ; `total`: `number`  }\>

`getDecoders` fetches a set of decoders saved on the target Lattice.

NOTE: The CRUD API to manage calldata decoders is written, but is currently
compiled out of firmware to free up code space. For now we will leave
these functions commented out.

**`deprecated`**

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `Object` |
| `opts.decoderType` | `number` |
| `opts.n?` | `number` |
| `opts.skipTotal?` | `boolean` |
| `opts.startIdx?` | `number` |
| `_cb?` | (`err?`: `string`, `data?`: { `decoders`: `Buffer`[] ; `total`: `number`  }) => `void` |

#### Returns

`Promise`<{ `decoders`: `Buffer`[] ; `total`: `number`  }\>

The decrypted response.

#### Defined in

[client.ts:611](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L611)

___

### getKvRecords

▸ **getKvRecords**(`opts`, `_cb?`): `Promise`<`GetKvRecordsData`\>

`getKvRecords` fetches a list of key-value records from the Lattice.

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `Object` |
| `opts.n?` | `number` |
| `opts.start?` | `number` |
| `opts.type?` | `number` |
| `_cb?` | (`err?`: `string`, `data?`: `GetKvRecordsData`) => `void` |

#### Returns

`Promise`<`GetKvRecordsData`\>

#### Defined in

[client.ts:817](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L817)

___

### pair

▸ **pair**(`pairingSecret`, `_cb?`): `Promise`<`boolean`\>

If a pairing secret is provided, `pair` uses it to sign a hash of the public key, name, and
pairing secret. It then sends the name and signature to the device. If no pairing secret is
provided, `pair` sends a zero-length name buffer to the device.

#### Parameters

| Name | Type |
| :------ | :------ |
| `pairingSecret` | `string` |
| `_cb?` | (`err?`: `string`, `hasActiveWallet?`: `boolean`) => `void` |

#### Returns

`Promise`<`boolean`\>

The active wallet object.

#### Defined in

[client.ts:254](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L254)

___

### removeDecoders

▸ **removeDecoders**(`opts`, `_cb?`): `Promise`<`number`\>

`removeDecoders` requests removal of a set of decoders on the target Lattice.

NOTE: The CRUD API to manage calldata decoders is written, but is currently
compiled out of firmware to free up code space. For now we will leave
these functions commented out.
NOTE: You will need to re-enable `import { encode as rlpEncode } from 'rlp';`

**`deprecated`**

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `Object` |
| `opts.decoderType` | `number` |
| `opts.decoders?` | `Buffer`[] |
| `opts.rmAll?` | `boolean` |
| `_cb?` | (`err?`: `string`, `data?`: `number`) => `void` |

#### Returns

`Promise`<`number`\>

The decrypted response.

#### Defined in

[client.ts:683](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L683)

___

### removeKvRecords

▸ **removeKvRecords**(`opts`, `_cb?`): `Promise`<`void`\>

`removeKvRecords` takes in an array of ids and sends a request to remove them from the Lattice.

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `Object` |
| `opts.ids` | `number`[] |
| `opts.type` | `number` |
| `_cb?` | (`err?`: `string`) => `void` |

#### Returns

`Promise`<`void`\>

A callback with an error or null.

#### Defined in

[client.ts:998](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L998)

___

### sign

▸ **sign**(`opts`, `_cb?`, `cachedData?`, `nextCode?`): `Promise`<`SignData`\>

`sign` builds and sends a request for signing to the device.

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `opts` | `Object` | `undefined` |
| `opts.currency` | `string` | `undefined` |
| `opts.data` | `any` | `undefined` |
| `_cb?` | (`err?`: `string`, `data?`: `SignData`) => `void` | `undefined` |
| `cachedData` | `any` | `null` |
| `nextCode` | `any` | `null` |

#### Returns

`Promise`<`SignData`\>

The response from the device.

#### Defined in

[client.ts:413](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L413)

___

## Other Methods

### fetchActiveWallet

▸ **fetchActiveWallet**(`_cb?`): `Promise`<`unknown`\>

Fetch the active wallet in the device.

#### Parameters

| Name | Type |
| :------ | :------ |
| `_cb?` | (`err?`: `string`, `wallet?`: `Buffer`) => `void` |

#### Returns

`Promise`<`unknown`\>

callback with an error or null

#### Defined in

[client.ts:1040](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L1040)

___

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

[client.ts:1724](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L1724)

___

### getAppName

▸ **getAppName**(): `string`

`getAppName` returns the name of the application to which this device is currently paired.

#### Returns

`string`

#### Defined in

[client.ts:199](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L199)

___

### getFwVersion

▸ **getFwVersion**(): `Object`

`getFwVersion` gets the firmware version of the paired device.

#### Returns

`Object`

Either an object with semver properties (fix, minor, and major) or `null`.

| Name | Type |
| :------ | :------ |
| `fix` | `number` |
| `major` | `number` |
| `minor` | `number` |

#### Defined in

[client.ts:181](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L181)

___

### getStateData

▸ **getStateData**(): `string`

Get a JSON string containing state data that can be used to rehydrate a session. Pass the
contents of this to the constructor as `stateData` to rehydrate.

#### Returns

`string`

#### Defined in

[client.ts:173](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/client.ts#L173)
