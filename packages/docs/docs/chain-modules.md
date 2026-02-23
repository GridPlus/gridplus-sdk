---
id: 'chain-modules'
sidebar_position: 4
---

# 🧱 Chain Modules

Chain modules provide chain-specific adapters while reusing the same Lattice transport/signing flow.

## Available Modules

- `@gridplus/evm`
- `@gridplus/btc`
- `@gridplus/solana`
- `@gridplus/cosmos`
- `@gridplus/xrp`

## XRP Example

```ts
import { xrp, type Signer } from '@gridplus/xrp';

const signer: Signer = /* provide signer implementation */;
const wallet = xrp.create(signer);

const address = await wallet.getAddress();
```

For signing, pass the XRPL signing preimage bytes (`STX\0` + canonical serialization):

```ts
const result = await wallet.sign({
  kind: 'transaction',
  payload: xrplPreimageBytes,
});
```
