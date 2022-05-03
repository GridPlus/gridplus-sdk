---
id: "index"
title: "gridplus-sdk"
slug: "/api/"
sidebar_label: "Exports"
sidebar_position: 0.5
custom_edit_url: null
---

## Classes

- [Client](classes/Client)

## Variables

### Calldata

• **Calldata**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `EVM` | `Object` |
| `EVM.parsers` | `Object` |
| `EVM.parsers.parseCanonicalName` | (`sig`: `string`, `name`: `string`) => `Buffer` |
| `EVM.parsers.parseSolidityJSONABI` | (`sig`: `string`, `abi`: `any`[]) => `Buffer` |
| `EVM.type` | `number` |

#### Defined in

[calldata/index.ts:8](https://github.com/GridPlus/gridplus-sdk/blob/f0e0175/src/calldata/index.ts#L8)

___

### Constants

• **Constants**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `GET_ADDR_FLAGS` | `Object` |
| `GET_ADDR_FLAGS.ED25519_PUB` | `number` |
| `GET_ADDR_FLAGS.SECP256K1_PUB` | `number` |
| `SIGNING` | `Object` |
| `SIGNING.CURVES` | `Object` |
| `SIGNING.CURVES.ED25519` | `number` |
| `SIGNING.CURVES.SECP256K1` | `number` |
| `SIGNING.ENCODINGS` | `Object` |
| `SIGNING.ENCODINGS.EVM` | `number` |
| `SIGNING.ENCODINGS.NONE` | `number` |
| `SIGNING.ENCODINGS.SOLANA` | `number` |
| `SIGNING.ENCODINGS.TERRA` | `number` |
| `SIGNING.HASHES` | `Object` |
| `SIGNING.HASHES.KECCAK256` | `number` |
| `SIGNING.HASHES.NONE` | `number` |
| `SIGNING.HASHES.SHA256` | `number` |

#### Defined in

[constants.ts:295](https://github.com/GridPlus/gridplus-sdk/blob/f0e0175/src/constants.ts#L295)

___

### Utils

• **Utils**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `generateAppSecret` | (`deviceId`: `Buffer`, `password`: `Buffer`, `appName`: `Buffer`) => `Buffer` |
| `getV` | (`tx`: `any`, `resp`: `any`) => `any` |

#### Defined in

[util.ts:379](https://github.com/GridPlus/gridplus-sdk/blob/f0e0175/src/util.ts#L379)
