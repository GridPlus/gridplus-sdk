---
id: "encData"
sidebar_position: 4
---

# 🔒 Exporting Encrypted Data

:::note
Firmware v0.17.0 is required to export encrypted data.
:::

You can use this SDK to export certain pieces of secure data from your Lattice in encrypted format.

:::note
Before you can export any encrypted data, you need to set an encryption password on your Lattice. You will be asked to do this automatically if you request encrypted data without a password set, but you can always go to `System Preferences -> Security & Privacy -> Encryption Password` to set, delete, or change your device's encryption password.
:::

All encrypted data export requests follow the general format:

```ts
import { Constants } from `gridplus-sdk`

// Set of supported schemas
const schemas = Constants.ENC_DATA.SCHEMAS;

// Build request data
const req = {
  schema: // Specify which schema to use
  params: {
    // Params specific to the type of data being exported
  }
}

const encryptedData = await client.exportEncryptedData(req);
```

# Supported Types of Exported Data

The following types of data may be requested. You should specify params.

## Exporting BLS Private Keys (EIP2335)

You may request an encrypted BLS private key of your Lattice's current wallet by providing the BIP39 derivation path. The data format follows [EIP2335](https://eips.ethereum.org/EIPS/eip-2335).

:::note
Currently, the only available schema is `BLS_KEYSTORE_EIP2335_PBKDF_V4`. As implied by the name, keys may only be exported with kdf `pbkdf2` and returned data is of format V4. See [this module](https://github.com/ChainSafe/bls-keystore) for more info on EIP2335 data format.
:::

**Request data:**

```ts
const req = {
  schema: schemas.BLS_KEYSTORE_EIP2335_PBKDF_V4,
  params: {
    path: <number[]>, // Up to 5 u32 indices representing BIP39 path
    c: <number>,      // Optional, number of AES iterations (default=262144)
  }
}
```

