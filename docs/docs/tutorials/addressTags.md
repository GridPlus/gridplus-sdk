# 🏷️ Addresses Tags

To make signing requests even more readable, you can "tag" addresses ahead of time. After that, any transaction requests referencing the tagged address will display your human-readable name instead of the raw address string. Tagging is done using what we call the "KV" API, which stands for key-value associations. You may add any mapping where the **key** and **value** are each **up to 64 bytes**.

:::info
Address tags are rendered on the Lattice screen anywhere an address might be rendered, including inside EIP712 requests and decoded transaction calldata!
:::

There are three methods used to manage tags:

- [`addAddressTags`](../reference/api/addressTags#addAddressTags): Add a set of address tags
- [`fetchAddressTags`](../reference/api/addressTags#fetchAddressTags): Fetch `n` tags, starting at index `start`
- [`removeAddressTags`](../reference/api/addressTags#removeAddressTags): Remove a set of tags based on the passed `id`s

## Example

The following code snippet and accompanying comments should show you how to manage address tags. We will be replacing an address tag if it exists on the Lattice already, or adding a new tag if an existing one does not exist:

```ts
import { Constants, Utils, setup, pair } from 'gridplus-sdk';
import { question } from 'readline-sync';
const deviceID = 'XXXXXX';

// Set up your client and connect to the Lattice
const isPaired = await setup({
  name: 'My Wallet',
  deviceId: 'XXXXXX',
  password: 'password',
  getStoredClient: () => localStorage.getItem('client'),
  setStoredClient: (client) => localStorage.setItem('client', client),
});
if (!isPaired) {
  const secret = await question('Enter pairing secret: ');
  await pair(secret);
}

// Fetch 10 tags per request (max=10)
const nPerReq = 10;

// Reference to the address that will be used in this example
const uniswapRouter = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

// The new tag we want to add
// NOTE: Emoji-based tags are not currently supported, sry 😔
const newTag = 'New Uniswap Router Tag';

// Find out how many tags are stored on the target Lattice by passing
// an empty struct as the options.
const existingTags = await fetchAddressTags({});

// Loop through all saved tags and search for a possible match to the address
// we want to re-tag here.
for (
  let reqIdx = 0;
  reqIdx < Math.floor(existingTags.total / nPerReq);
  reqIdx++
) {
  // Fetch all the tags in sets of `nPerReq`
  const tags = fetchAddressTags({ n: nPerReq, start: reqIdx * nPerReq });
  // Determine if we have found our tag
  for (let i = 0; i < tags.length; i++) {
    if (tags[i][uniswapRouter] !== undefined) {
      // We have a tag saved - delete it by id
      await removeAddressTags({ ids: [tags[0].id] });
      // This probs wouldn't work in a JS/TS script like this but you get the idea
      break;
    }
  }
}

// We can now be sure there is no tag for our address in question.
// Add the new tag!
const newTags = [
  {
    [uniswapRouter]: newTag,
  },
];
await addKvRecords({ records: newTags });
```
