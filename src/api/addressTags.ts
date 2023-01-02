import { Client } from '../client';
import { queue } from './utilities';

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

export const fetchAddressTags = async () => {
  const addresses: AddressTag[] = [];
  let remainingToFetch = 10;
  let fetched = 0;

  while (remainingToFetch > 0) {
    await queue((client) =>
      client
        .getKvRecords({
          start: fetched,
          n: remainingToFetch > 10 ? 10 : remainingToFetch,
        })
        .then(async (res) => {
          addresses.push(...res.records);
          fetched = res.fetched + fetched;
          remainingToFetch = res.total - fetched;
        }),
    );
  }
  return addresses;
};

export const removeAddressTags = async (
  tags: AddressTag[],
): Promise<Buffer> => {
  const ids = tags.map((tag) => `${tag.id}`);
  return queue((client: Client) => client.removeKvRecords({ ids }));
};
