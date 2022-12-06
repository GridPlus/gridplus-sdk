---
id: "ethDeposits"
sidebar_position: 5
---

#  🖥️ ETH Staking Keys

:::danger
ETH staking key management on the Lattice is alpha software and may contain bugs. Please exercise caution when using it.
:::

:::info
Firmware v0.17.0 or above is required for all validator key management functionality.
:::

:::caution
Your Lattice **cannot** function as a validator - it can only serve as a **key management system**. In order to participate in the daily activities of Ethereum staking, you must set up a [staking node](https://ethereum.org/en/staking/).
:::

If you are interested in staking on Ethereum, you can manage your staking keys using your Lattice as a secure key storage device. There are two components to this:

1. [Generate Keystores](#generating-keystores): These are your **encrypted** validator private keys, which can be decrypted and used to sign attestations and block proposals using your preferred [consensus layer client](https://ethereum.org/en/developers/docs/nodes-and-clients/#consensus-clients).

2. [Generate Geposit Data](#generating-deposit-data): You must pass a JSON file containing validator(s) information to the [Ethereum Launchpad](https://launchpad.ethereum.org/en/) if you wish to create validators using that mechanism, which is the most common and well tested method of starting validators.

## Generating Keystores

The first step to setting up your validator(s) is to export the private key(s) so that your consensus client software can fulfill your validator duties, such as signing attestations and signing block proposals. Of course, we do not want to export private keys in plain text, as key leakage can result in attacks on your validator. Therefore, we export **encrypted** validator private keys from your Lattice.

### Setting up an Encryption Password

Before you can export keystores, you need to setup an encryption password on your Lattice. You may remove or change this at any time. All exported data will be encrypted using the Lattice's current encryption password, if one exists. If one does not exist, encrypted data export requests will fail and you will be prompted to setup a password.

If you would like to manage your device encryption password at any time, go to `System Preferences -> Security & Privacy -> Encryption Password` on your Lattice's screen.

### Exporting Encrypted Keystores

Encrypted keystores are exported using the format defined by [EIP2335](https://eips.ethereum.org/EIPS/eip-2335). These encrypted files can be loaded directly into any consensus layer client of your choosing. Exporting encrypted keystores is done with [`fetchEncryptedData`](../api/classes/client.Client#fetchencrypteddata). You may request **one** encrypted private key at a time, corresponding to the specified `path`.

:::note
1. Only `pbkdf2` format is supported, meaning `scrypt` is **not** supported. Both formats are valid for staking purposes.
2. By default, this will encrypt using `262144` iterations because that was used in the [canonincal EIP2335 example](https://eips.ethereum.org/EIPS/eip-2335). Note that because Lattice firmware runs on a power-constrained microcontroller, this will take roughly 30 seconds *per encrypted key exported*. Setting a smaller value for [optional param `c`](../api/interfaces/types_fetchEncData.EIP2335KeyExportReq#c) will speed up the encryptions, but will be less secure.
:::

```ts
const keystores = [];
for (let i = 0; i < numValidators; i++) {
  // Set the path for this specific validator, where path[2] is the
  // iterable index, per EIP2334.
  const path = JSON.parse(JSON.stringify(baseDepositPath));
  path[2] = i;

  // Export the keystore and save it
  const exportedKeystore = await client.fetchEncryptedData({
    schema: Constants.schemas.BLS_KEYSTORE_EIP2335_PBKDF_V4,
    params: { path, }
  })
  keystores.push(exportedKeystore);
}
```

## Generating Deposit Data

:::note
Generating deposit data requires use of a secondary mode: [`lattice-eth2-utils`](https://github.com/GridPlus/lattice-eth2-utils)
:::

With our keystores in hand, we need one more piece of data before we can stake: the deposit data. Whereas your keystores are needed by your consensus client, your deposit data is needed by the network to process activation for your validator(s). Deposit data is generated in a JSON format that can be consumed by the popular, official [Ethereum Launchpad](https://launchpad.ethereum.org/en/). This is the same file you would get from the official [Ethereum Staking CLI](https://github.com/ethereum/staking-deposit-cli).

As with the encrypted data export, you may only generate data for a single validator at a time, though you can do so in a loop as will be demonstrated. Each deposit data export requires a signature by the corresponding validator. 

Here is an example requesting deposit data from the first `numValidators` on a `baseDepositPath` and then writing that deposit data to a JSON file:

```ts
import { DepositData, Constants as ETH2Constants } from 'lattice-eth2-utils';
import { writeFilesync } from 'fs'; 

const depositData = [];
for (let i = 0; i < numValidators; i++) {
  // Set the path for this specific validator, where path[2] is the
  // iterable index, per EIP2334.
  const path = JSON.parse(JSON.stringify(baseDepositPath));
  path[2] = i;
  
  // Export the deposit data for this path. This involves a signature.
  // Note that `opts` (the third param) is optional and its default value
  // is currently `MAINNET_GENESIS`. These params will change with each
  // future Ethereum fork, so you may need to specify them if the latest
  // options are not yet specifyed in `lattice-eth2-utils`.
  const opts = ETH2Constants.NETWORKS.MAINNET_GENESIS;
  const data = await DepositData.generate(client, path, opts);
  
  // Parse the JSON string result and add it to the array
  depositData.push(JSON.parse(data));
}

// Re-JSONify all deposit records
writeFileSync('deposit-data.json', JSON.stringify(depositData));
```

### BLS vs ETH1 Withdrawals

When creating deposit data, one must define a key that can **withdraw** from the validator (a.k.a. deposit key). This is called the "withdrawal key". Currently, there are two options: BLS and ETH1 withdrawal keys.

* By default, a BLS withdrawal key corresponding to the deposit key will be generated. Per [EIP2334](https://eips.ethereum.org/EIPS/eip-2334), the generic paths are `m/12381/3600/i/0/0` for deposit keys and `m/12381/3600/i/0` for withdrawal keys. This means that for a given `i`, the withdrawal key is one index up the BIP39 derivation path.
* If you would prefer to give an ETH1 address (i.e. a key derived on the `secp256k1` curve) the power to withdraw for your depositor at `m/12381/3600/i/0/0`, you may pass that address as an optional param, as shown below.

```ts
const eth1Addr = '0xf2f5c73fa04406b1995e397b55c24ab1f3ea726c';

// Get deposit data with default BLS withdrawal:
const depositDataBLS = await Utils.getEthDepositData(client, path);
// Get deposit data with ETH1 withdrawal key:
const opts = {
  ...ETH2Constants.NETWORKS.MAINNET_GENESIS,
  withdrawalKey: eth1Addr,
};
const depositDataETH1 = await Utils.getEthDepositData(client, path, opts);
// You can also just do it this way, i.e. without the MAINNET_GENESIS opts (which are the default)
const depositDataETH1 = await Utils.getEthDepositData(client, path, { withdrawalKey: eth1Addr });
```


## Example

With your keystores and deposit data in hand, we are ready to start validating! Let's just export the data into JSON files. Here is the full script with a few modifications, including JSON file export:

```ts
import { Client, Constants, Utils } from 'gridplus-sdk';
import { question } from 'readline-sync';
import { writeFileSync } from 'fs';
const deviceID = 'XXXXXX';
const numValidators = 5;
const baseDepositPath = [ 12381, 3600, 0, 0, 0 ];

// Connect to your Lattice
const client = new Client({ name: 'ETH Depositooor' });
const isPaired = await client.connect(deviceID);
if (!isPaired) {
  const secret = await question('Enter pairing secret: ');
  await client.pair(secret);
}

// Get the validator data
const depositData = [];
const keystores = [];
for (let i = 0; i < numValidators; i++) {
  // Set the path for this specific validator, where path[2] is the
  // iterable index, per EIP2334.
  const path = JSON.parse(JSON.stringify(baseDepositPath));
  path[2] = i;

  // Export the keystore and save it
  const exportedKeystore = await client.fetchEncryptedData({
    schema: Constants.schemas.BLS_KEYSTORE_EIP2335_PBKDF_V4,
    params: { path, }
  })
  writeFileSync(`validator_keystore_${i}.json`, exportedKeystore);

  // Export the deposit data for this path. This involves a signature.
  const data = await Utils.getEthDepositData(client, path);
  depositData.push(data.depositData);
}

// Save the depositData
writeFileSync(`deposit_data.json`, JSON.stringify(depositData));
```

