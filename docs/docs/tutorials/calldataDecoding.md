# 📜 Calldata Decoding

:::note
Calldata decoding is only available with [General Signing](../signing#general-signing) patterns.
:::

Because the Lattice has a large 5" touchscreen display, it is capable of rendering a fair bit of information on any given screen. You can use this screen to display **decoded transaction calldata** using some common encoding/decoding protocol, such as Ethereum's [Contract ABI spec](https://docs.soliditylang.org/en/v0.8.17/abi-spec.html). This means that instead of rendering blobs of unreadable hex data, you can instruct the Lattice to render individual parameter values; all you need to do is include **decoding data** with your transaction request, as will be demonstrated below. Calldata decoding should be integrated with whatever wallet application or service is making transaction requests using this SDK, such as [MetaMask](https://metamask.io).

## EVM Calldata Decoding

EVM chains (e.g. Ethereum, Polygon, Arbitrum) all use the same [Contract ABI spec](https://docs.soliditylang.org/en/v0.8.17/abi-spec.html) for encoding transaction calldata.

:::note
See [this article](https://mirror.xyz/alexmiller.eth/kiwpU01XZh-rCgDDRA-jB2-pjosjogGIqCZkxryZ9Oo) for more details on the ABI spec and how calldata decoder data is generated under the hood.
:::

We first need to look up the ABI definition for the function we are calling. This is done using the util [`fetchCalldataDecoder`](../reference/util#fetchcalldatadecoder). Although the logic happens under the hood, it is important to understand that depending on the contract/function being called, the data may be slightly different:

- By default, `fetchCalldataDecoder` will attempt to fetch the full contract ABI from [Etherscan](https://etherscan.io) or one of its sister sites such as [Arbiscan](https://arbiscan.io). Etherscan et al only return ABI data if the contract **source code** has been **verified** (i.e. the contract is "open source"). If the code has not been verified, we unfortunately cannot use Etherscan to help us decode calldata.

- If Etherscan fails to return data, `fetchCalldataDecoder` will look up the **canonical ABI definition** using [4byte](https://4byte.directory). As the name implies, this lookup is done using the first four bytes of the transaction calldata. As long as there is a record on 4byte, you should get decoder data back (anyone can add a record to 4byte, so if your function is missing... just add it). This method is worse than Etherscan because the canonical ABI definition does not contain **parameter names**, so the decoded display will show param names like `#1`, `#2`, etc.

:::caution
You might be worried about information attacks here. While these are possible, you realistically don't need to worry much. In the case of Etherscan, you can only get decoder data from verified contracts. In the case of 4byte, it is possible to force a collision with a different definition using the same first four bytes, but this is an impractical attack as it would require, at a minimum, changing the function name.

Furthermore, the Ethereum ABI spec is self-referential; the first 4 bytes of calldata must map to the correct ABI definition and since these 4 bytes are part of the calldata, they are immutable in the context of the transaction. This means it is easy to detect if a given ABI definition is mismatched with the transaction calldata it is supposed to decode. In all such cases, Lattice firmware will fail to decode the calldata and will instead render it as hex, which may tip off the user that something is wrong.

So in summary, information attacks are limited in scope and their theoretical benefit to an attacker is unclear.
:::

### Example

Once you get the decoder data from `fetchCalldataDecoder`, you can include it with your transaction request and... that's it! Here is a code snippet outlining this functionality:

:::note
In the snippet below, we assume `tx` has already been created and is an instance of some [`@ethereumjs/tx`](https://github.com/ethereumjs/ethereumjs-monorepo/tree/master/packages/tx#readme) transaction type (e.g. `FeeMarketEIP1559Transaction`, `Transaction`, etc).

The behavior of `@ethereumjs/tx` is outside the scope of this article, but one thing to mention is that different transaction types serialize differently:

- `Transaction`: `rlp.encode(tx.getMessageToSign(false))`
- `FeeMarketEIP1559Transaction` and other newer types: `tx.getMessageToSign(false)`
  :::

```ts
import { Client, Constants, Utils } from 'gridplus-sdk';
import { question } from 'readline-sync';
const deviceID = 'XXXXXX';

// Set up your client and connect to the Lattice
const client = new Client({ name: 'Calldata Decodooor' });
const isPaired = await client.connect(deviceID);
if (!isPaired) {
  const secret = await question('Enter pairing secret: ');
  await client.pair(secret);
}

// Get the calldata decoder using the `@ethereumjs/tx` `tx` object
const { def } = await Utils.fetchCalldataDecoder(
  tx.input, // Calldata to be decoded
  tx.to, // Address of the contract we are calling
  tx.chainId, // Integer containing chain ID, used to determine Etherscan site
);

// Build the transaction request as you normally would
const req = {
  signerPath,
  curveType: Constants.SIGNING.CURVES.SECP256K1,
  hashType: Constants.SIGNING.HASHES.KECCAK256,
  encodingType: Constants.SIGNING.ENCODINGS.EVM,
  // As mentioned in the note above, this assumes an `@ethereumjs/tx` object that
  // is *not* a legacy `Transaction` type, e.g. `FeeMarketEIP1559Transaction`.
  payload: tx.getMessageToSign(false),
  // Adding the returned def is all you need to do. If no def was found, this
  // option will be ignored and the calldata will render as a hex string.
  decoder: def,
};
const sig = await client.sign(req);
```
