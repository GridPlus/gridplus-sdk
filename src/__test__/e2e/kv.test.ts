import { DEFAULT_SIGNER } from '../utils/builders';
/**
 * Test kv (key-value) file functionality. These types of files are simple mappings
 * between a 64 byte key and a 64 byte value of any type. The main use case for these
 * at the time of writing is address tags.
 */
import { question } from 'readline-sync';
import {
  HARDENED_OFFSET,
  responseCodes,
  responseMsgs
} from '../../constants';
import { BTC_PURPOSE_P2PKH, ETH_COIN } from '../utils/helpers';
import { initializeClient } from '../utils/initializeClient';

const client = initializeClient();

// Random address to test the screen with.
// IMPORTANT NOTE: For Ethereum addresses you should always add the lower case variety since
//                  requests come in at lower case
const UNISWAP_ADDR = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const UNISWAP_TAG = 'Uniswap V2 Router';
const RANDOM_ADDR = '0x30da3d7A865C934b389c919c737510054111AB3A';
const RANDOM_TAG = 'Test Address Name';
const REJECT_PROMPT_TEXT = 'Please reject if you do NOT see an address tag.';
let _numStartingRecords = 0;
let _fetchedRecords: any = [];
const ETH_REQ = {
  currency: 'ETH',
  data: {
    signerPath: DEFAULT_SIGNER,
    nonce: '0x02',
    gasPrice: '0x1fe5d61a00',
    gasLimit: '0x034e97',
    to: RANDOM_ADDR,
    value: '0x01cba1761f7ab9870c',
    data: null,
    chainId: 4,
  },
};

describe('key-value', () => {
  it('Should ask if the user wants to reset state', async () => {
    const answer = question(
      'Do you want to clear all kv records and start anew? (Y/N) ',
    );
    if (answer.toUpperCase() === 'Y') {
      let cont = true;
      const numRmv = 0;
      while (cont) {
        const data = await client.getKvRecords({ start: numRmv });
        if (data.total === numRmv) {
          cont = false;
        } else {
          const ids: string[] = [];
          for (let i = 0; i < Math.min(100, data.records.length); i++) {
            ids.push(data?.records[i]?.id ?? '');
          }
          await client.removeKvRecords({ ids });
        }
      }
    }
  });

  it('Should make a request to an unknown address', async () => {
    question(REJECT_PROMPT_TEXT);
    await client.sign(ETH_REQ).catch((err) => {
      expect(err.message).toBe(
        responseMsgs[responseCodes.RESP_ERR_USER_DECLINED],
      );
    });
  });

  it('Should get the initial set of records', async () => {
    const resp = await client.getKvRecords({ n: 2, start: 0 });
    _numStartingRecords = resp.total;
  });

  it('Should add some key value records', async () => {
    const records = {
      [UNISWAP_ADDR]: UNISWAP_TAG,
      [RANDOM_ADDR]: RANDOM_TAG,
    };
    await client.addKvRecords({ records, caseSensitive: false, type: 0 });
  });

  it('Should fail to add records with unicode characters', async () => {
    const badKey = { '0x🔥🦍': 'Muh name' };
    const badVal = { UNISWAP_ADDR: 'val🔥🦍' };
    await expect(client.addKvRecords({ records: badKey })).rejects.toThrow(
      'Unicode characters are not supported.',
    );
    await expect(client.addKvRecords({ records: badVal })).rejects.toThrow(
      'Unicode characters are not supported.',
    );
  });

  it('Should fail to add zero length keys and values', async () => {
    const badKey = { '': 'Muh name' };
    const badVal = { UNISWAP_ADDR: '' };
    await expect(client.addKvRecords({ records: badKey })).rejects.toThrow(
      'Keys and values must be >0 characters.',
    );
    await expect(client.addKvRecords({ records: badVal })).rejects.toThrow(
      'Keys and values must be >0 characters.',
    );
  });

  it('Should fetch the newly created records', async () => {
    const opts = {
      n: 2,
      start: _numStartingRecords,
    };
    const resp = await client.getKvRecords(opts);
    const { records, total, fetched } = resp;
    _fetchedRecords = records;
    expect(total).toEqual(fetched + _numStartingRecords);
    expect(records.length).toEqual(fetched);
    expect(records.length).toEqual(2);
  });

  it('Should make a request to an address which is now known', async () => {
    question(REJECT_PROMPT_TEXT);
    await client.sign(ETH_REQ);
  });

  it('Should make an EIP712 request that uses the record', async () => {
    const msg = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'verifyingContract', type: 'address' },
        ],
        Test: [
          { name: 'owner', type: 'string' },
          { name: 'ownerAddr', type: 'address' },
        ],
      },
      domain: {
        name: 'A Message',
        verifyingContract: RANDOM_ADDR,
      },
      primaryType: 'Test',
      message: {
        owner: RANDOM_ADDR,
        ownerAddr: RANDOM_ADDR,
      },
    };
    const req = {
      currency: 'ETH_MSG',
      data: {
        signerPath: [
          BTC_PURPOSE_P2PKH,
          ETH_COIN,
          HARDENED_OFFSET,
          0,
          0,
        ],
        protocol: 'eip712',
        payload: msg,
      },
    };
    question(REJECT_PROMPT_TEXT);
    await client.sign(req);
  });

  it('Should make a request with calldata', async () => {
    // TODO: Add decoder data
    const req = JSON.parse(JSON.stringify(ETH_REQ));
    req.data.data = `0x23b872dd00000000000000000000000057974eb88e50cc61049b44e43e90d3bc40fa61c0000000000000000000000000${RANDOM_ADDR.slice(
      2,
    )}000000000000000000000000000000000000000000000000000000000000270f`;
    question(REJECT_PROMPT_TEXT);
    await client.sign(req);
  });

  it('Should remove key value records', async () => {
    const idsToRemove: any[] = [];
    _fetchedRecords.forEach((r: any) => {
      idsToRemove.push(r.id);
    });
    await client.removeKvRecords({ ids: idsToRemove });
  });

  it('Should confirm the records we recently added are removed', async () => {
    const opts = {
      n: 1,
      start: _numStartingRecords,
    };
    const resp = await client.getKvRecords(opts);
    const { records, total, fetched } = resp;
    expect(total).toEqual(_numStartingRecords);
    expect(fetched).toEqual(0);
    expect(records.length).toEqual(0);
  });

  it('Should add the same record with case sensitivity', async () => {
    const records = {
      [RANDOM_ADDR]: 'Test Address Name',
    };
    await client.addKvRecords({
      records,
      caseSensitive: true,
      type: 0,
    });
  });

  it('Should make another request to make sure case sensitivity is enforced', async () => {
    question(REJECT_PROMPT_TEXT);
    await client.sign(ETH_REQ).catch((err) => {
      expect(err.message).toBe(
        responseMsgs[responseCodes.RESP_ERR_USER_DECLINED],
      );
    });
  });

  it('Should get the id of the newly added record', async () => {
    const opts = {
      n: 1,
      start: _numStartingRecords,
    };
    const resp: any = await client.getKvRecords(opts);
    const { records, total, fetched } = resp;
    expect(total).toEqual(_numStartingRecords + 1);
    expect(fetched).toEqual(1);
    expect(records.length).toEqual(1);
    _fetchedRecords = records;
  });

  it('Should remove the new record', async () => {
    const idsToRemove: any = [];
    _fetchedRecords.forEach((r: any) => {
      idsToRemove.push(r.id);
    });
    await client.removeKvRecords({ ids: idsToRemove });
  });

  it('Should confirm there are no new records', async () => {
    const opts = {
      n: 1,
      start: _numStartingRecords,
    };
    const resp: any = await client.getKvRecords(opts);
    const { records, total, fetched } = resp;
    expect(total).toEqual(_numStartingRecords);
    expect(fetched).toEqual(0);
    expect(records.length).toEqual(0);
  });
});
