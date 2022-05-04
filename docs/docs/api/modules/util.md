---
id: "util"
title: "Module: util"
sidebar_label: "util"
sidebar_position: 0
custom_edit_url: null
---

## Functions

### generateAppSecret

▸ `Const` **generateAppSecret**(`deviceId`, `password`, `appName`): `Buffer`

Generates an application secret for use in maintaining connection to device.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `deviceId` | `Buffer` | The device ID of the device you want to generate a token for. |
| `password` | `Buffer` | The password entered when connecting to the device. |
| `appName` | `Buffer` | The name of the application. |

#### Returns

`Buffer`

an application secret as a Buffer

#### Defined in

[util.ts:326](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/util.ts#L326)

___

### getV

▸ **getV**(`tx`, `resp`): `any`

Generic signing does not return a `v` value like legacy ETH signing requests did.
Get the `v` component of the signature as well as an `initV`
parameter, which is what you need to use to re-create an `@ethereumjs/tx`
object. There is a lot of tech debt in `@ethereumjs/tx` which also
inherits the tech debt of ethereumjs-util.
1.  The legacy `Transaction` type can call `_processSignature` with the regular
    `v` value.
2.  Newer transaction types such as `FeeMarketEIP1559Transaction` will subtract
    27 from the `v` that gets passed in, so we need to add `27` to create `initV`

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `tx` | `any` | An `@ethereumjs/tx` Transaction object |
| `resp` | `any` | response from Lattice. Can be either legacy or generic signing variety |

#### Returns

`any`

#### Defined in

[util.ts:354](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/util.ts#L354)
