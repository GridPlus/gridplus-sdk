# api/addressTags

## addAddressTags()

> **addAddressTags**(`tags`: [\{\}]): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Sends request to the Lattice to add Address Tags.

### Parameters

| Parameter | Type |
| :------ | :------ |
| `tags` | [\{\}] |

### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

### Source

packages/sdk/src/api/addressTags.ts:9

***

## fetchAddressTags()

> **fetchAddressTags**(`__namedParameters`: \{`n`: `MAX_ADDR`;`start`: `0`; \}): `Promise`\<`AddressTag`[]\>

Fetches Address Tags from the Lattice.

### Parameters

| Parameter | Type |
| :------ | :------ |
| `__namedParameters` | `object` |
| `__namedParameters.n`? | `number` |
| `__namedParameters.start`? | `number` |

### Returns

`Promise`\<`AddressTag`[]\>

### Source

packages/sdk/src/api/addressTags.ts:25

***

## removeAddressTags()

> **removeAddressTags**(`tags`: `AddressTag`[]): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Removes Address Tags from the Lattice.

### Parameters

| Parameter | Type |
| :------ | :------ |
| `tags` | `AddressTag`[] |

### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

### Source

packages/sdk/src/api/addressTags.ts:53
