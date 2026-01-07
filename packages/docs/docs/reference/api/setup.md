# api/setup

## setup()

> **setup**(`params`: `SetupParameters`): `Promise`\<`boolean`\>

`setup` initializes the Client and executes `connect()` if necessary. It returns a promise that
resolves to a boolean that indicates whether the Client is paired to the application to which it's
attempting to connect.

### Parameters

| Parameter | Type |
| :------ | :------ |
| `params` | `SetupParameters` |

### Returns

`Promise`\<`boolean`\>

- a promise that resolves to a boolean that indicates whether the Client is paired to the application to which it's attempting to connect

### Source

packages/sdk/src/api/setup.ts:45
