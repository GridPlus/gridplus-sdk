# constants

## BTC\_LEGACY\_XPUB\_PATH

> `const` **BTC\_LEGACY\_XPUB\_PATH**: `"44'/0'/0'"` = `"44'/0'/0'"`

Derivation path for Bitcoin legacy xpub (BIP44).
Use with fetchAddressesByDerivationPath() and LatticeGetAddressesFlag.secp256k1Xpub

### Example

```ts
const xpub = await fetchAddressesByDerivationPath(BTC_LEGACY_XPUB_PATH, {
  flag: LatticeGetAddressesFlag.secp256k1Xpub
});
```

### Source

packages/sdk/src/constants.ts:597

***

## BTC\_SEGWIT\_ZPUB\_PATH

> `const` **BTC\_SEGWIT\_ZPUB\_PATH**: `"84'/0'/0'"` = `"84'/0'/0'"`

Derivation path for Bitcoin native segwit zpub (BIP84).
Use with fetchAddressesByDerivationPath() and LatticeGetAddressesFlag.secp256k1Xpub

### Example

```ts
const zpub = await fetchAddressesByDerivationPath(BTC_SEGWIT_ZPUB_PATH, {
  flag: LatticeGetAddressesFlag.secp256k1Xpub
});
```

### Source

packages/sdk/src/constants.ts:617

***

## BTC\_WRAPPED\_SEGWIT\_YPUB\_PATH

> `const` **BTC\_WRAPPED\_SEGWIT\_YPUB\_PATH**: `"49'/0'/0'"` = `"49'/0'/0'"`

Derivation path for Bitcoin wrapped segwit ypub (BIP49).
Use with fetchAddressesByDerivationPath() and LatticeGetAddressesFlag.secp256k1Xpub

### Example

```ts
const ypub = await fetchAddressesByDerivationPath(BTC_WRAPPED_SEGWIT_YPUB_PATH, {
  flag: LatticeGetAddressesFlag.secp256k1Xpub
});
```

### Source

packages/sdk/src/constants.ts:607

***

## EXTERNAL

> `const` **EXTERNAL**: \{`ENC_DATA`: \{`SCHEMAS`: \{`BLS_KEYSTORE_EIP2335_PBKDF_V4`: `LatticeEncDataSchema.eip2335`; \}; \};`ETH_CONSENSUS_SPEC`: \{`DOMAINS`: \{`DEPOSIT`: `Buffer`\<`ArrayBuffer`\>;`VOLUNTARY_EXIT`: `Buffer`\<`ArrayBuffer`\>; \};`NETWORKS`: \{`MAINNET_GENESIS`: \{`forkVersion`: `Buffer`\<`ArrayBuffer`\>;`networkName`: `'mainnet'`;`validatorsRoot`: `Buffer`\<`ArrayBuffer`\>; \}; \}; \};`GET_ADDR_FLAGS`: \{`BLS12_381_G1_PUB`: `LatticeGetAddressesFlag.bls12_381Pubkey`;`ED25519_PUB`: `LatticeGetAddressesFlag.ed25519Pubkey`;`SECP256K1_PUB`: `LatticeGetAddressesFlag.secp256k1Pubkey`;`SECP256K1_XPUB`: `LatticeGetAddressesFlag.secp256k1Xpub`; \};`SIGNING`: \{`BLS_DST`: \{`BLS_DST_NUL`: `LatticeSignBlsDst.NUL`;`BLS_DST_POP`: `LatticeSignBlsDst.POP`; \};`CURVES`: \{`BLS12_381_G2`: `LatticeSignCurve.bls12_381`;`ED25519`: `LatticeSignCurve.ed25519`;`SECP256K1`: `LatticeSignCurve.secp256k1`; \};`ENCODINGS`: \{`EIP7702_AUTH`: `LatticeSignEncoding.eip7702_auth`;`EIP7702_AUTH_LIST`: `LatticeSignEncoding.eip7702_auth_list`;`ETH_DEPOSIT`: `LatticeSignEncoding.eth_deposit`;`EVM`: `LatticeSignEncoding.evm`;`NONE`: `LatticeSignEncoding.none`;`SOLANA`: `LatticeSignEncoding.solana`; \};`HASHES`: \{`KECCAK256`: `LatticeSignHash.keccak256`;`NONE`: `LatticeSignHash.none`;`SHA256`: `LatticeSignHash.sha256`; \}; \}; \}

Externally exported constants used for building requests

### Type declaration

| Member | Type | Value |
| :------ | :------ | :------ |
| `ENC_DATA` | \{`SCHEMAS`: \{`BLS_KEYSTORE_EIP2335_PBKDF_V4`: `LatticeEncDataSchema.eip2335`; \}; \} | ... |
| `ENC_DATA.SCHEMAS` | \{`BLS_KEYSTORE_EIP2335_PBKDF_V4`: `LatticeEncDataSchema.eip2335`; \} | ... |
| `ENC_DATA.SCHEMAS.BLS_KEYSTORE_EIP2335_PBKDF_V4` | `eip2335` | LatticeEncDataSchema.eip2335 |
| `ETH_CONSENSUS_SPEC` | \{`DOMAINS`: \{`DEPOSIT`: `Buffer`\<`ArrayBuffer`\>;`VOLUNTARY_EXIT`: `Buffer`\<`ArrayBuffer`\>; \};`NETWORKS`: \{`MAINNET_GENESIS`: \{`forkVersion`: `Buffer`\<`ArrayBuffer`\>;`networkName`: `'mainnet'`;`validatorsRoot`: `Buffer`\<`ArrayBuffer`\>; \}; \}; \} | ... |
| `ETH_CONSENSUS_SPEC.DOMAINS` | \{`DEPOSIT`: `Buffer`\<`ArrayBuffer`\>;`VOLUNTARY_EXIT`: `Buffer`\<`ArrayBuffer`\>; \} | ... |
| `ETH_CONSENSUS_SPEC.DOMAINS.DEPOSIT` | `Buffer`\<`ArrayBuffer`\> | ... |
| `ETH_CONSENSUS_SPEC.DOMAINS.VOLUNTARY_EXIT` | `Buffer`\<`ArrayBuffer`\> | ... |
| `ETH_CONSENSUS_SPEC.NETWORKS` | \{`MAINNET_GENESIS`: \{`forkVersion`: `Buffer`\<`ArrayBuffer`\>;`networkName`: `'mainnet'`;`validatorsRoot`: `Buffer`\<`ArrayBuffer`\>; \}; \} | ... |
| `ETH_CONSENSUS_SPEC.NETWORKS.MAINNET_GENESIS` | \{`forkVersion`: `Buffer`\<`ArrayBuffer`\>;`networkName`: `'mainnet'`;`validatorsRoot`: `Buffer`\<`ArrayBuffer`\>; \} | ... |
| `ETH_CONSENSUS_SPEC.NETWORKS.MAINNET_GENESIS.forkVersion` | `Buffer`\<`ArrayBuffer`\> | ... |
| `ETH_CONSENSUS_SPEC.NETWORKS.MAINNET_GENESIS.networkName` | `"mainnet"` | 'mainnet' |
| `ETH_CONSENSUS_SPEC.NETWORKS.MAINNET_GENESIS.validatorsRoot` | `Buffer`\<`ArrayBuffer`\> | ... |
| `GET_ADDR_FLAGS` | \{`BLS12_381_G1_PUB`: `LatticeGetAddressesFlag.bls12_381Pubkey`;`ED25519_PUB`: `LatticeGetAddressesFlag.ed25519Pubkey`;`SECP256K1_PUB`: `LatticeGetAddressesFlag.secp256k1Pubkey`;`SECP256K1_XPUB`: `LatticeGetAddressesFlag.secp256k1Xpub`; \} | ... |
| `GET_ADDR_FLAGS.BLS12_381_G1_PUB` | `bls12_381Pubkey` | LatticeGetAddressesFlag.bls12\_381Pubkey |
| `GET_ADDR_FLAGS.ED25519_PUB` | `ed25519Pubkey` | LatticeGetAddressesFlag.ed25519Pubkey |
| `GET_ADDR_FLAGS.SECP256K1_PUB` | `secp256k1Pubkey` | LatticeGetAddressesFlag.secp256k1Pubkey |
| `GET_ADDR_FLAGS.SECP256K1_XPUB` | `secp256k1Xpub` | LatticeGetAddressesFlag.secp256k1Xpub |
| `SIGNING` | \{`BLS_DST`: \{`BLS_DST_NUL`: `LatticeSignBlsDst.NUL`;`BLS_DST_POP`: `LatticeSignBlsDst.POP`; \};`CURVES`: \{`BLS12_381_G2`: `LatticeSignCurve.bls12_381`;`ED25519`: `LatticeSignCurve.ed25519`;`SECP256K1`: `LatticeSignCurve.secp256k1`; \};`ENCODINGS`: \{`EIP7702_AUTH`: `LatticeSignEncoding.eip7702_auth`;`EIP7702_AUTH_LIST`: `LatticeSignEncoding.eip7702_auth_list`;`ETH_DEPOSIT`: `LatticeSignEncoding.eth_deposit`;`EVM`: `LatticeSignEncoding.evm`;`NONE`: `LatticeSignEncoding.none`;`SOLANA`: `LatticeSignEncoding.solana`; \};`HASHES`: \{`KECCAK256`: `LatticeSignHash.keccak256`;`NONE`: `LatticeSignHash.none`;`SHA256`: `LatticeSignHash.sha256`; \}; \} | ... |
| `SIGNING.BLS_DST` | \{`BLS_DST_NUL`: `LatticeSignBlsDst.NUL`;`BLS_DST_POP`: `LatticeSignBlsDst.POP`; \} | ... |
| `SIGNING.BLS_DST.BLS_DST_NUL` | `NUL` | LatticeSignBlsDst.NUL |
| `SIGNING.BLS_DST.BLS_DST_POP` | `POP` | LatticeSignBlsDst.POP |
| `SIGNING.CURVES` | \{`BLS12_381_G2`: `LatticeSignCurve.bls12_381`;`ED25519`: `LatticeSignCurve.ed25519`;`SECP256K1`: `LatticeSignCurve.secp256k1`; \} | ... |
| `SIGNING.CURVES.BLS12_381_G2` | `bls12_381` | LatticeSignCurve.bls12\_381 |
| `SIGNING.CURVES.ED25519` | `ed25519` | LatticeSignCurve.ed25519 |
| `SIGNING.CURVES.SECP256K1` | `secp256k1` | LatticeSignCurve.secp256k1 |
| `SIGNING.ENCODINGS` | \{`EIP7702_AUTH`: `LatticeSignEncoding.eip7702_auth`;`EIP7702_AUTH_LIST`: `LatticeSignEncoding.eip7702_auth_list`;`ETH_DEPOSIT`: `LatticeSignEncoding.eth_deposit`;`EVM`: `LatticeSignEncoding.evm`;`NONE`: `LatticeSignEncoding.none`;`SOLANA`: `LatticeSignEncoding.solana`; \} | ... |
| `SIGNING.ENCODINGS.EIP7702_AUTH` | `eip7702_auth` | LatticeSignEncoding.eip7702\_auth |
| `SIGNING.ENCODINGS.EIP7702_AUTH_LIST` | `eip7702_auth_list` | LatticeSignEncoding.eip7702\_auth\_list |
| `SIGNING.ENCODINGS.ETH_DEPOSIT` | `eth_deposit` | LatticeSignEncoding.eth\_deposit |
| `SIGNING.ENCODINGS.EVM` | `evm` | LatticeSignEncoding.evm |
| `SIGNING.ENCODINGS.NONE` | `none` | LatticeSignEncoding.none |
| `SIGNING.ENCODINGS.SOLANA` | `solana` | LatticeSignEncoding.solana |
| `SIGNING.HASHES` | \{`KECCAK256`: `LatticeSignHash.keccak256`;`NONE`: `LatticeSignHash.none`;`SHA256`: `LatticeSignHash.sha256`; \} | ... |
| `SIGNING.HASHES.KECCAK256` | `keccak256` | LatticeSignHash.keccak256 |
| `SIGNING.HASHES.NONE` | `none` | LatticeSignHash.none |
| `SIGNING.HASHES.SHA256` | `sha256` | LatticeSignHash.sha256 |

### Source

packages/sdk/src/constants.ts:20
