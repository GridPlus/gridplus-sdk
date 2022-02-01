---
id: "Client"
title: "Class: Client"
sidebar_label: "Client"
sidebar_position: 0
custom_edit_url: null
---

## Constructors

### constructor

• **new Client**(`__namedParameters`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `__namedParameters` | `ClientParams` |

#### Defined in

[client.ts:75](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L75)

## Properties

### activeWallets

• **activeWallets**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `external` | `Object` |
| `external.capabilities` | `any` |
| `external.external` | `boolean` |
| `external.name` | `any` |
| `external.uid` | `Buffer` |
| `internal` | `Object` |
| `internal.capabilities` | `any` |
| `internal.external` | `boolean` |
| `internal.name` | `any` |
| `internal.uid` | `Buffer` |

#### Defined in

[client.ts:59](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L59)

___

### baseUrl

• **baseUrl**: `any`

#### Defined in

[client.ts:47](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L47)

___

### crypto

• **crypto**: `any`

#### Defined in

[client.ts:48](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L48)

___

### deviceId

• **deviceId**: `any`

#### Defined in

[client.ts:55](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L55)

___

### ephemeralPub

• **ephemeralPub**: `any`

#### Defined in

[client.ts:52](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L52)

___

### fwVersion

• **fwVersion**: `any`

#### Defined in

[client.ts:58](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L58)

___

### isPaired

• **isPaired**: `boolean`

#### Defined in

[client.ts:56](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L56)

___

### key

• **key**: `any`

#### Defined in

[client.ts:51](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L51)

___

### name

• **name**: `any`

#### Defined in

[client.ts:49](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L49)

___

### pairingSalt

• **pairingSalt**: `any`

#### Defined in

[client.ts:73](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L73)

___

### privKey

• **privKey**: `any`

#### Defined in

[client.ts:50](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L50)

___

### retryCount

• **retryCount**: `any`

#### Defined in

[client.ts:57](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L57)

___

### sharedSecret

• **sharedSecret**: `any`

#### Defined in

[client.ts:53](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L53)

___

### timeout

• **timeout**: `any`

#### Defined in

[client.ts:54](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L54)

## Methods

### \_buildEncRequest

▸ **_buildEncRequest**(`enc_request_code`, `payload`): `Buffer`

#### Parameters

| Name | Type |
| :------ | :------ |
| `enc_request_code` | `any` |
| `payload` | `any` |

#### Returns

`Buffer`

#### Defined in

[client.ts:653](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L653)

___

### \_buildRequest

▸ **_buildRequest**(`request_code`, `payload`): `Buffer`

#### Parameters

| Name | Type |
| :------ | :------ |
| `request_code` | `any` |
| `payload` | `any` |

#### Returns

`Buffer`

#### Defined in

[client.ts:688](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L688)

___

### \_getActiveWallet

▸ **_getActiveWallet**(`cb`, `forceRefresh?`): `any`

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `cb` | `any` | `undefined` |
| `forceRefresh` | `boolean` | `false` |

#### Returns

`any`

#### Defined in

[client.ts:610](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L610)

___

### \_getEphemId

▸ **_getEphemId**(): `any`

#### Returns

`any`

#### Defined in

[client.ts:645](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L645)

___

### \_getSharedSecret

▸ **_getSharedSecret**(): `Buffer`

#### Returns

`Buffer`

#### Defined in

[client.ts:633](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L633)

___

### \_handleConnect

▸ **_handleConnect**(`res`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `res` | `any` |

#### Returns

`boolean`

#### Defined in

[client.ts:800](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L800)

___

### \_handleEncResponse

▸ **_handleEncResponse**(`encRes`, `len`): { `data`: `undefined` = res; `err`: `string`  } \| { `data`: `Buffer` = res; `err`: `any` = null }

#### Parameters

| Name | Type |
| :------ | :------ |
| `encRes` | `any` |
| `len` | `any` |

#### Returns

{ `data`: `undefined` = res; `err`: `string`  } \| { `data`: `Buffer` = res; `err`: `any` = null }

#### Defined in

[client.ts:819](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L819)

___

### \_handleGetAddresses

▸ **_handleGetAddresses**(`encRes`): { `data`: `undefined` = res; `err`: `string`  } \| { `data`: `Buffer` = res; `err`: `any` = null } \| { `data`: `any`[] = addrs; `err`: `any` = null }

#### Parameters

| Name | Type |
| :------ | :------ |
| `encRes` | `any` |

#### Returns

{ `data`: `undefined` = res; `err`: `string`  } \| { `data`: `Buffer` = res; `err`: `any` = null } \| { `data`: `any`[] = addrs; `err`: `any` = null }

#### Defined in

[client.ts:861](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L861)

___

### \_handleGetWallets

▸ **_handleGetWallets**(`encRes`): ``"No active wallet."`` \| { `data`: `undefined` = res; `err`: `string`  } \| { `data`: `Buffer` = res; `err`: `any` = null }

#### Parameters

| Name | Type |
| :------ | :------ |
| `encRes` | `any` |

#### Returns

``"No active wallet."`` \| { `data`: `undefined` = res; `err`: `string`  } \| { `data`: `Buffer` = res; `err`: `any` = null }

#### Defined in

[client.ts:883](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L883)

___

### \_handlePair

▸ **_handlePair**(`encRes`): `any`

#### Parameters

| Name | Type |
| :------ | :------ |
| `encRes` | `any` |

#### Returns

`any`

#### Defined in

[client.ts:851](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L851)

___

### \_handleSign

▸ **_handleSign**(`encRes`, `currencyType`, `req?`): { `data`: `any` = null; `err`: `any` = null } \| { `err`: `any` = decrypted.err }

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `encRes` | `any` | `undefined` |
| `currencyType` | `any` | `undefined` |
| `req` | `any` | `null` |

#### Returns

{ `data`: `any` = null; `err`: `any` = null } \| { `err`: `any` = decrypted.err }

#### Defined in

[client.ts:923](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L923)

___

### \_request

▸ **_request**(`payload`, `encReqCode`, `cb`, `retryCount?`): `any`

#### Parameters

| Name | Type |
| :------ | :------ |
| `payload` | `any` |
| `encReqCode` | `any` |
| `cb` | `any` |
| `retryCount` | `any` |

#### Returns

`any`

#### Defined in

[client.ts:714](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L714)

___

### \_resetActiveWallets

▸ **_resetActiveWallets**(): `void`

#### Returns

`void`

#### Defined in

[client.ts:1072](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L1072)

___

### addAbiDefs

▸ **addAbiDefs**(`defs`, `cb`, `nextCode?`): `any`

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `defs` | `any` | `undefined` |
| `cb` | `any` | `undefined` |
| `nextCode` | `any` | `null` |

#### Returns

`any`

#### Defined in

[client.ts:343](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L343)

___

### addKvRecords

▸ **addKvRecords**(`opts`, `cb`): `any`

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `any` |
| `cb` | `any` |

#### Returns

`any`

#### Defined in

[client.ts:489](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L489)

___

### addPermissionV0

▸ **addPermissionV0**(`opts`, `cb`): `any`

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `any` |
| `cb` | `any` |

#### Returns

`any`

#### Defined in

[client.ts:375](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L375)

___

### connect

▸ **connect**(`deviceId`, `cb`): `any`

#### Parameters

| Name | Type |
| :------ | :------ |
| `deviceId` | `any` |
| `cb` | `any` |

#### Returns

`any`

#### Defined in

[client.ts:125](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L125)

___

### getActiveWallet

▸ **getActiveWallet**(): `Object`

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `capabilities` | `any` |
| `external` | `boolean` |
| `name` | `any` |
| `uid` | `Buffer` |

#### Defined in

[client.ts:1082](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L1082)

___

### getAddresses

▸ **getAddresses**(`opts`, `cb`): `any`

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `any` |
| `cb` | `any` |

#### Returns

`any`

#### Defined in

[client.ts:208](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L208)

___

### getKvRecords

▸ **getKvRecords**(`opts`, `cb`): `any`

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `any` |
| `cb` | `any` |

#### Returns

`any`

#### Defined in

[client.ts:420](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L420)

___

### hasActiveWallet

▸ **hasActiveWallet**(): `boolean`

#### Returns

`boolean`

#### Defined in

[client.ts:1092](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L1092)

___

### pair

▸ **pair**(`pairingSecret`, `cb`): `any`

#### Parameters

| Name | Type |
| :------ | :------ |
| `pairingSecret` | `any` |
| `cb` | `any` |

#### Returns

`any`

#### Defined in

[client.ts:153](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L153)

___

### parseAbi

▸ **parseAbi**(`source`, `data`, `skipErrors?`): `any`

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `source` | `any` | `undefined` |
| `data` | `any` | `undefined` |
| `skipErrors` | `boolean` | `false` |

#### Returns

`any`

#### Defined in

[client.ts:1114](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L1114)

___

### pubKeyBytes

▸ **pubKeyBytes**(`LE?`): `Buffer`

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `LE` | `boolean` | `false` |

#### Returns

`Buffer`

#### Defined in

[client.ts:1098](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L1098)

___

### removeKvRecords

▸ **removeKvRecords**(`opts`, `cb`): `any`

#### Parameters

| Name | Type |
| :------ | :------ |
| `opts` | `any` |
| `cb` | `any` |

#### Returns

`any`

#### Defined in

[client.ts:568](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L568)

___

### sign

▸ **sign**(`opts`, `cb`, `cachedData?`, `nextCode?`): `any`

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `opts` | `any` | `undefined` |
| `cb` | `any` | `undefined` |
| `cachedData` | `any` | `null` |
| `nextCode` | `any` | `null` |

#### Returns

`any`

#### Defined in

[client.ts:271](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L271)

___

### test

▸ **test**(`data`, `cb`): `any`

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | `any` |
| `cb` | `any` |

#### Returns

`any`

#### Defined in

[client.ts:192](https://github.com/GridPlus/gridplus-sdk/blob/5eeff82/src/client.ts#L192)
