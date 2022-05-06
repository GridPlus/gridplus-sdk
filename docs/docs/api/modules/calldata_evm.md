---
id: "calldata_evm"
title: "Module: calldata/evm"
sidebar_label: "calldata/evm"
sidebar_position: 0
custom_edit_url: null
---

## Functions

### parseCanonicalName

▸ `Const` **parseCanonicalName**(`sig`, `name`): `Buffer`

Convert a canonical name into an ABI definition that can be included with calldata to a general
signing request. Parameter names will be encoded in order that they are discovered (e.g. "1",
"2", "2.1", "3")

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `sig` | `string` | a 0x-prefixed hex string containing 4 bytes of info |
| `name` | `string` | canonical name of the function |

#### Returns

`Buffer`

Buffer containing RLP-serialized array of calldata info to pass to signing request

#### Defined in

[calldata/evm.ts:39](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/calldata/evm.ts#L39)

___

### parseSolidityJSONABI

▸ `Const` **parseSolidityJSONABI**(`sig`, `abi`): `Buffer`

Look through an ABI definition to see if there is a function that matches the signature provided.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `sig` | `string` | a 0x-prefixed hex string containing 4 bytes of info |
| `abi` | `any`[] | a Solidity JSON ABI structure ([external link](https://docs.ethers.io/v5/api/utils/abi/formats/#abi-formats--solidity)) |

#### Returns

`Buffer`

Buffer containing RLP-serialized array of calldata info to pass to signing request

#### Defined in

[calldata/evm.ts:11](https://github.com/GridPlus/gridplus-sdk/blob/4ac365f/src/calldata/evm.ts#L11)
