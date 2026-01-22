# util

## convertRecoveryToV()

> **convertRecoveryToV**(`recovery`: `number`, `txData`: `any`): `Buffer`\<`ArrayBufferLike`\> \| `BN`

Convert a recovery parameter (0/1) to the proper v value format based on transaction type.
Consolidates the v parameter conversion logic used across ethereum.ts and util.ts.

### Parameters

| Parameter | Type | Description |
| :------ | :------ | :------ |
| `recovery` | `number` | Recovery parameter (0 or 1) |
| `txData` | `any` | Transaction data containing chainId, useEIP155, and type |

### Returns

`Buffer`\<`ArrayBufferLike`\> \| `BN`

The properly formatted v value as Buffer or BN

### Source

packages/sdk/src/util.ts:873

***

## fetchCalldataDecoder()

> **fetchCalldataDecoder**(`_data`: `string` \| `Uint8Array`\<`ArrayBufferLike`\>, `to`: `string`, `_chainId`: `string` \| `number`, `recurse`: `boolean`): `Promise`\<\{`abi`: `any`;`def`: `Buffer`\<`ArrayBuffer`\>; \}\>

Fetches calldata from a remote scanner based on the transaction's `chainId`

### Parameters

| Parameter | Type | Default value |
| :------ | :------ | :------ |
| `_data` | `string` \| `Uint8Array`\<`ArrayBufferLike`\> | `undefined` |
| `to` | `string` | `undefined` |
| `_chainId` | `string` \| `number` | `undefined` |
| `recurse` | `boolean` | `true` |

### Returns

`Promise`\<\{`abi`: `any`;`def`: `Buffer`\<`ArrayBuffer`\>; \}\>

| Member | Type | Value |
| :------ | :------ | :------ |
| `abi` | `any` | - |
| `def` | `Buffer`\<`ArrayBuffer`\> | ... |

### Source

packages/sdk/src/util.ts:623

***

## generateAppSecret()

> **generateAppSecret**(`deviceId`: `string` \| `Buffer`\<`ArrayBufferLike`\>, `password`: `string` \| `Buffer`\<`ArrayBufferLike`\>, `appName`: `string` \| `Buffer`\<`ArrayBufferLike`\>): `Buffer`\<`ArrayBufferLike`\>

Generates an application secret for use in maintaining connection to device.

### Parameters

| Parameter | Type | Description |
| :------ | :------ | :------ |
| `deviceId` | `string` \| `Buffer`\<`ArrayBufferLike`\> | The device ID of the device you want to generate a token for. |
| `password` | `string` \| `Buffer`\<`ArrayBufferLike`\> | The password entered when connecting to the device. |
| `appName` | `string` \| `Buffer`\<`ArrayBufferLike`\> | The name of the application. |

### Returns

`Buffer`\<`ArrayBufferLike`\>

an application secret as a Buffer

### Source

packages/sdk/src/util.ts:700

***

## getV()

> **getV**(`tx`: `any`, `resp`: `any`): `BN`

Get the `v` component of signature using viem parsing.

### Parameters

| Parameter | Type | Description |
| :------ | :------ | :------ |
| `tx` | `any` | Serialized transaction (Buffer or hex string) |
| `resp` | `any` | Lattice response with sig and pubkey |

### Returns

`BN`

BN object containing the `v` param

### Source

packages/sdk/src/util.ts:727

***

## getYParity()

> **getYParity**(`messageHash`: `any`, `signature`?: `any`, `publicKey`?: `string` \| `Buffer`\<`ArrayBufferLike`\> \| `Uint8Array`\<`ArrayBufferLike`\>): `number`

Get the y-parity value for a signature by recovering the public key.

Usage:
- Simple: getYParity(messageHash, signature, publicKey)
- Object: getYParity(\{ messageHash, signature, publicKey \})
- Legacy: getYParity(tx, response)

### Parameters

| Parameter | Type | Description |
| :------ | :------ | :------ |
| `messageHash` | `any` | The 32-byte message hash (or tx object for legacy) |
| `signature`? | `any` | Object with r and s values |
| `publicKey`? | `string` \| `Buffer`\<`ArrayBufferLike`\> \| `Uint8Array`\<`ArrayBufferLike`\> | Expected public key |

### Returns

`number`

0 or 1 for the y-parity value

### Source

packages/sdk/src/util.ts:916

***

## selectDefFrom4byteABI()

> **selectDefFrom4byteABI**(`abiData`: `any`[], `selector`: `string`): `unknown`[]

Takes a list of ABI data objects and a selector, and returns the earliest ABI data object that
matches the selector.

### Parameters

| Parameter | Type |
| :------ | :------ |
| `abiData` | `any`[] |
| `selector` | `string` |

### Returns

`unknown`[]

### Source

packages/sdk/src/util.ts:387
