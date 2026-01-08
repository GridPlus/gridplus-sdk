# api/signing

## signAuthorization()

> **signAuthorization**(`authorization`: `AuthorizationRequest`, `overrides`?: `Omit`\<`SignRequestParams`\<\{`address`: `never`;`bool`: `never`;`bytes`: `never`;`bytes1`: `never`;`bytes10`: `never`;`bytes11`: `never`;`bytes12`: `never`;`bytes13`: `never`;`bytes14`: `never`;`bytes15`: `never`;`bytes16`: `never`;`bytes17`: `never`;`bytes18`: `never`;`bytes19`: `never`;`bytes2`: `never`;`bytes20`: `never`;`bytes21`: `never`;`bytes22`: `never`;`bytes23`: `never`;`bytes24`: `never`;`bytes25`: `never`;`bytes26`: `never`;`bytes27`: `never`;`bytes28`: `never`;`bytes29`: `never`;`bytes3`: `never`;`bytes30`: `never`;`bytes31`: `never`;`bytes32`: `never`;`bytes4`: `never`;`bytes5`: `never`;`bytes6`: `never`;`bytes7`: `never`;`bytes8`: `never`;`bytes9`: `never`;`int104`: `never`;`int112`: `never`;`int120`: `never`;`int128`: `never`;`int136`: `never`;`int144`: `never`;`int152`: `never`;`int16`: `never`;`int160`: `never`;`int168`: `never`;`int176`: `never`;`int184`: `never`;`int192`: `never`;`int200`: `never`;`int208`: `never`;`int216`: `never`;`int224`: `never`;`int232`: `never`;`int24`: `never`;`int240`: `never`;`int248`: `never`;`int256`: `never`;`int32`: `never`;`int40`: `never`;`int48`: `never`;`int56`: `never`;`int64`: `never`;`int72`: `never`;`int8`: `never`;`int80`: `never`;`int88`: `never`;`int96`: `never`;`string`: `never`;`uint104`: `never`;`uint112`: `never`;`uint120`: `never`;`uint128`: `never`;`uint136`: `never`;`uint144`: `never`;`uint152`: `never`;`uint16`: `never`;`uint160`: `never`;`uint168`: `never`;`uint176`: `never`;`uint184`: `never`;`uint192`: `never`;`uint200`: `never`;`uint208`: `never`;`uint216`: `never`;`uint224`: `never`;`uint232`: `never`;`uint24`: `never`;`uint240`: `never`;`uint248`: `never`;`uint256`: `never`;`uint32`: `never`;`uint40`: `never`;`uint48`: `never`;`uint56`: `never`;`uint64`: `never`;`uint72`: `never`;`uint8`: `never`;`uint80`: `never`;`uint88`: `never`;`uint96`: `never`; \}\>, `"data"`\>): `Promise`\<`Authorization`\>

Signs an EIP-7702 authorization to set code for an externally owned account (EOA).
Returns a Viem-compatible authorization object.

### Parameters

| Parameter | Type |
| :------ | :------ |
| `authorization` | `AuthorizationRequest` |
| `overrides`? | `Omit`\<`SignRequestParams`\<\{`address`: `never`;`bool`: `never`;`bytes`: `never`;`bytes1`: `never`;`bytes10`: `never`;`bytes11`: `never`;`bytes12`: `never`;`bytes13`: `never`;`bytes14`: `never`;`bytes15`: `never`;`bytes16`: `never`;`bytes17`: `never`;`bytes18`: `never`;`bytes19`: `never`;`bytes2`: `never`;`bytes20`: `never`;`bytes21`: `never`;`bytes22`: `never`;`bytes23`: `never`;`bytes24`: `never`;`bytes25`: `never`;`bytes26`: `never`;`bytes27`: `never`;`bytes28`: `never`;`bytes29`: `never`;`bytes3`: `never`;`bytes30`: `never`;`bytes31`: `never`;`bytes32`: `never`;`bytes4`: `never`;`bytes5`: `never`;`bytes6`: `never`;`bytes7`: `never`;`bytes8`: `never`;`bytes9`: `never`;`int104`: `never`;`int112`: `never`;`int120`: `never`;`int128`: `never`;`int136`: `never`;`int144`: `never`;`int152`: `never`;`int16`: `never`;`int160`: `never`;`int168`: `never`;`int176`: `never`;`int184`: `never`;`int192`: `never`;`int200`: `never`;`int208`: `never`;`int216`: `never`;`int224`: `never`;`int232`: `never`;`int24`: `never`;`int240`: `never`;`int248`: `never`;`int256`: `never`;`int32`: `never`;`int40`: `never`;`int48`: `never`;`int56`: `never`;`int64`: `never`;`int72`: `never`;`int8`: `never`;`int80`: `never`;`int88`: `never`;`int96`: `never`;`string`: `never`;`uint104`: `never`;`uint112`: `never`;`uint120`: `never`;`uint128`: `never`;`uint136`: `never`;`uint144`: `never`;`uint152`: `never`;`uint16`: `never`;`uint160`: `never`;`uint168`: `never`;`uint176`: `never`;`uint184`: `never`;`uint192`: `never`;`uint200`: `never`;`uint208`: `never`;`uint216`: `never`;`uint224`: `never`;`uint232`: `never`;`uint24`: `never`;`uint240`: `never`;`uint248`: `never`;`uint256`: `never`;`uint32`: `never`;`uint40`: `never`;`uint48`: `never`;`uint56`: `never`;`uint64`: `never`;`uint72`: `never`;`uint8`: `never`;`uint80`: `never`;`uint88`: `never`;`uint96`: `never`; \}\>, `"data"`\> |

### Returns

`Promise`\<`Authorization`\>

### Source

packages/sdk/src/api/signing.ts:144

***

## signAuthorizationList()

> **signAuthorizationList**(`tx`: `TransactionSerializableEIP7702`): `Promise`\<`SignData`\>

Sign an EIP-7702 transaction using Viem-compatible types

### Parameters

| Parameter | Type |
| :------ | :------ |
| `tx` | `TransactionSerializableEIP7702` |

### Returns

`Promise`\<`SignData`\>

### Source

packages/sdk/src/api/signing.ts:211

***

## signMessage()

> **signMessage**(`payload`: `string` \| `Buffer`\<`ArrayBufferLike`\> \| `Uint8Array`\<`ArrayBufferLike`\> \| `Buffer`\<`ArrayBufferLike`\>[] \| `EIP712MessagePayload`\<`Record`\<`string`, `unknown`\>, `string`\>, `overrides`?: `Omit`\<`SignRequestParams`\<\{`address`: `never`;`bool`: `never`;`bytes`: `never`;`bytes1`: `never`;`bytes10`: `never`;`bytes11`: `never`;`bytes12`: `never`;`bytes13`: `never`;`bytes14`: `never`;`bytes15`: `never`;`bytes16`: `never`;`bytes17`: `never`;`bytes18`: `never`;`bytes19`: `never`;`bytes2`: `never`;`bytes20`: `never`;`bytes21`: `never`;`bytes22`: `never`;`bytes23`: `never`;`bytes24`: `never`;`bytes25`: `never`;`bytes26`: `never`;`bytes27`: `never`;`bytes28`: `never`;`bytes29`: `never`;`bytes3`: `never`;`bytes30`: `never`;`bytes31`: `never`;`bytes32`: `never`;`bytes4`: `never`;`bytes5`: `never`;`bytes6`: `never`;`bytes7`: `never`;`bytes8`: `never`;`bytes9`: `never`;`int104`: `never`;`int112`: `never`;`int120`: `never`;`int128`: `never`;`int136`: `never`;`int144`: `never`;`int152`: `never`;`int16`: `never`;`int160`: `never`;`int168`: `never`;`int176`: `never`;`int184`: `never`;`int192`: `never`;`int200`: `never`;`int208`: `never`;`int216`: `never`;`int224`: `never`;`int232`: `never`;`int24`: `never`;`int240`: `never`;`int248`: `never`;`int256`: `never`;`int32`: `never`;`int40`: `never`;`int48`: `never`;`int56`: `never`;`int64`: `never`;`int72`: `never`;`int8`: `never`;`int80`: `never`;`int88`: `never`;`int96`: `never`;`string`: `never`;`uint104`: `never`;`uint112`: `never`;`uint120`: `never`;`uint128`: `never`;`uint136`: `never`;`uint144`: `never`;`uint152`: `never`;`uint16`: `never`;`uint160`: `never`;`uint168`: `never`;`uint176`: `never`;`uint184`: `never`;`uint192`: `never`;`uint200`: `never`;`uint208`: `never`;`uint216`: `never`;`uint224`: `never`;`uint232`: `never`;`uint24`: `never`;`uint240`: `never`;`uint248`: `never`;`uint256`: `never`;`uint32`: `never`;`uint40`: `never`;`uint48`: `never`;`uint56`: `never`;`uint64`: `never`;`uint72`: `never`;`uint8`: `never`;`uint80`: `never`;`uint88`: `never`;`uint96`: `never`; \}\>, `"data"`\>): `Promise`\<`SignData`\>

Sign a message with support for EIP-712 typed data and const assertions

### Parameters

| Parameter | Type |
| :------ | :------ |
| `payload` | `string` \| `Buffer`\<`ArrayBufferLike`\> \| `Uint8Array`\<`ArrayBufferLike`\> \| `Buffer`\<`ArrayBufferLike`\>[] \| `EIP712MessagePayload`\<`Record`\<`string`, `unknown`\>, `string`\> |
| `overrides`? | `Omit`\<`SignRequestParams`\<\{`address`: `never`;`bool`: `never`;`bytes`: `never`;`bytes1`: `never`;`bytes10`: `never`;`bytes11`: `never`;`bytes12`: `never`;`bytes13`: `never`;`bytes14`: `never`;`bytes15`: `never`;`bytes16`: `never`;`bytes17`: `never`;`bytes18`: `never`;`bytes19`: `never`;`bytes2`: `never`;`bytes20`: `never`;`bytes21`: `never`;`bytes22`: `never`;`bytes23`: `never`;`bytes24`: `never`;`bytes25`: `never`;`bytes26`: `never`;`bytes27`: `never`;`bytes28`: `never`;`bytes29`: `never`;`bytes3`: `never`;`bytes30`: `never`;`bytes31`: `never`;`bytes32`: `never`;`bytes4`: `never`;`bytes5`: `never`;`bytes6`: `never`;`bytes7`: `never`;`bytes8`: `never`;`bytes9`: `never`;`int104`: `never`;`int112`: `never`;`int120`: `never`;`int128`: `never`;`int136`: `never`;`int144`: `never`;`int152`: `never`;`int16`: `never`;`int160`: `never`;`int168`: `never`;`int176`: `never`;`int184`: `never`;`int192`: `never`;`int200`: `never`;`int208`: `never`;`int216`: `never`;`int224`: `never`;`int232`: `never`;`int24`: `never`;`int240`: `never`;`int248`: `never`;`int256`: `never`;`int32`: `never`;`int40`: `never`;`int48`: `never`;`int56`: `never`;`int64`: `never`;`int72`: `never`;`int8`: `never`;`int80`: `never`;`int88`: `never`;`int96`: `never`;`string`: `never`;`uint104`: `never`;`uint112`: `never`;`uint120`: `never`;`uint128`: `never`;`uint136`: `never`;`uint144`: `never`;`uint152`: `never`;`uint16`: `never`;`uint160`: `never`;`uint168`: `never`;`uint176`: `never`;`uint184`: `never`;`uint192`: `never`;`uint200`: `never`;`uint208`: `never`;`uint216`: `never`;`uint224`: `never`;`uint232`: `never`;`uint24`: `never`;`uint240`: `never`;`uint248`: `never`;`uint256`: `never`;`uint32`: `never`;`uint40`: `never`;`uint48`: `never`;`uint56`: `never`;`uint64`: `never`;`uint72`: `never`;`uint8`: `never`;`uint80`: `never`;`uint88`: `never`;`uint96`: `never`; \}\>, `"data"`\> |

### Returns

`Promise`\<`SignData`\>

### Source

packages/sdk/src/api/signing.ts:97
