import { Client } from '../client';
import { MAX_ADDR } from '../constants';
import { queue } from './utilities';

/**
 * Sends request to the Lattice to add Address Tags.
 */
export const addAddressTags = async (
  tags: [{ [key: string]: string }],
): Promise<Buffer> => {
  // convert an array of objects to an object
  const records = tags.reduce((acc, tag) => {
    const key = Object.keys(tag)[0];
    acc[key] = tag[key];
    return acc;
  }, {});

  return queue((client) => client.addKvRecords({ records }));
};

/**
 * Fetches Address Tags from the Lattice.
 */
export const fetchAddressTags = async (
  { n, start } = { n: MAX_ADDR, start: 0 },
) => {
  const addressTags: AddressTag[] = [];
  let remainingToFetch = n;
  let fetched = start;

  while (remainingToFetch > 0) {
    await queue((client) =>
      client
        .getKvRecords({
          start: fetched,
          n: remainingToFetch > MAX_ADDR ? MAX_ADDR : remainingToFetch,
        })
        .then(async (res) => {
          addressTags.push(...res.records);
          fetched = res.fetched + fetched;
          remainingToFetch = res.total - fetched;
        }),
    );
  }
  return addressTags;
};

/**
 * Removes Address Tags from the Lattice.
 */
export const removeAddressTags = async (
  tags: AddressTag[],
): Promise<Buffer> => {
  const ids = tags.map((tag) => `${tag.id}`);
  return queue((client: Client) => client.removeKvRecords({ ids }));
};
