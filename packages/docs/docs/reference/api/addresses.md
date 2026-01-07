# api/addresses

## fetchAddress()

> **fetchAddress**(`path`: `number` \| `WalletPath`): `Promise`\<`string`\>

Fetches a single address from the device.

### Parameters

| Parameter | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `path` | `number` \| `WalletPath` | `0` | either the index of ETH signing path or the derivation path to fetch |

### Returns

`Promise`\<`string`\>

### Note

By default, this function fetches m/44'/60'/0'/0/0

### Source

packages/sdk/src/api/addresses.ts:68

***

## fetchBtcXpub()

> **fetchBtcXpub**(): `Promise`\<`string`\>

Fetches Bitcoin legacy extended public key (xpub) for BIP44 (m/44'/0'/0').

### Returns

`Promise`\<`string`\>

xpub string

### Source

packages/sdk/src/api/addresses.ts:247

***

## fetchBtcYpub()

> **fetchBtcYpub**(): `Promise`\<`string`\>

Fetches Bitcoin wrapped segwit extended public key (ypub) for BIP49 (m/49'/0'/0').

### Returns

`Promise`\<`string`\>

ypub string

### Source

packages/sdk/src/api/addresses.ts:258

***

## fetchBtcZpub()

> **fetchBtcZpub**(): `Promise`\<`string`\>

Fetches Bitcoin native segwit extended public key (zpub) for BIP84 (m/84'/0'/0').

### Returns

`Promise`\<`string`\>

zpub string

### Source

packages/sdk/src/api/addresses.ts:272
