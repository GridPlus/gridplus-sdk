/**
 * Test kv (key-value) file functionality. These types of files are simple mappings
 * between a 64 byte key and a 64 byte value of any type. The main use case for these
 * at the time of writing is address tags.
 */
import { expect } from 'chai';
import { question } from 'readline-sync';
import { HARDENED_OFFSET } from '../src/constants';
import helpers from './testUtil/helpers';
let client, id;
let continueTests = true;
// Random address to test the screen with.
// IMPORTANT NOTE: For Ethereum addresses you should always add the lower case variety since
//                  requests come in at lower case
const RANDOM_ADDR = '0x30da3d7A865C934b389c919c737510054111AB3A';
let _numStartingRecords = 0;
let _fetchedRecords = [];
const ETH_REQ = {
  currency: 'ETH',
  data: {
    signerPath: [
      helpers.BTC_PURPOSE_P2PKH,
      helpers.ETH_COIN,
      HARDENED_OFFSET,
      0,
      0,
    ],
    nonce: '0x02',
    gasPrice: '0x1fe5d61a00',
    gasLimit: '0x034e97',
    to: RANDOM_ADDR,
    value: '0x01cba1761f7ab9870c',
    data: null,
    chainId: 'rinkeby', // Can also be an integer
  },
};

describe('Test key-value files API', () => {
  before(() => {
    client = helpers.setupTestClient(process.env);
    if (process.env.DEVICE_ID) id = process.env.DEVICE_ID;
  });

  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Error in previous test. Aborting.');
  })

  //-------------------------------------------
  // TESTS
  //-------------------------------------------
  it('Should connect to a Lattice', async () => {
    // Again, we assume that if an `id` has already been set, we are paired
    // with the hardcoded privkey above.
    continueTests = false;
    if (!process.env.DEVICE_ID) {
      const _id = question('Please enter the ID of your test device: ');
      id = _id;
      const isPaired = await client.connect(id);
      expect(isPaired).to.equal(false);
      expect(client.isPaired).to.equal(false);
      expect(client.hasActiveWallet()).to.equal(false);
    }
    continueTests = true;
  });

  it('Should attempt to pair with pairing secret', async () => {
    if (!process.env.DEVICE_ID) {
      continueTests = false;
      const secret = question('Please enter the pairing secret: ');
       await client.pair(secret);
      expect(client.hasActiveWallet()).to.equal(true);
      continueTests = true;
    }
  });

  it('Should try to connect again but recognize the pairing already exists', async () => {
    continueTests = false;
    const isPaired = await client.connect(id);
    expect(isPaired).to.equal(true);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);
    continueTests = true;
  });

  it('Should make a request to an unknown address', async () => {
    continueTests = false;
    try {
      question('Please reject if you see a hex address');
      await client.sign(ETH_REQ);
    } catch (err) {
      expect(err).to.not.equal(null, 'Expected rejection but got approval');
    }
    continueTests = true;
  });

  it('Should get the initial set of records', async () => {
    continueTests = false;
    try {
      const resp: any = await client.getKvRecords({ n: 2, start: 0 });
      _numStartingRecords = resp.total;
    } catch (err) {
      expect(err).to.equal(null, err);
    }
    continueTests = true;
  });

  it('Should add some key value records', async () => {
    const records = {
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D': 'Uniswap V2 Router',
      [RANDOM_ADDR]: 'Test Address Name',
    };
    continueTests = false;
    try {
      await client.addKvRecords({ records, caseSensitive: false, type: 0 });
    } catch (err) {
      expect(err).to.equal(null, err);
    }
    continueTests = true;
  });

  it('Should fail to add records with unicode characters', async () => {
    const badKey = { '0x🔥🦍': 'Muh name' };
    const badVal = { '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D': 'val🔥🦍' };
    continueTests = false;
    try {
      await client.addKvRecords({ records: badKey });
    } catch (err) {
      expect(err).to.not.equal(
        null,
        'Should have failed to add Unicode key but did not'
      );
    }
    try {
      await client.addKvRecords({ records: badVal });
    } catch (err) {
      expect(err).to.not.equal(
        null,
        'Should have failed to add Unicode key but did not'
      );
    }
    continueTests = true;
  });

  it('Should fail to add zero length keys and values', async () => {
    const badKey = { '': 'Muh name' };
    const badVal = { '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D': '' };
    continueTests = false;
    try {
      await client.addKvRecords({ records: badKey });
    } catch (err) {
      expect(err).to.not.equal(
        null,
        'Should have failed to add Unicode key but did not'
      );
    }
    try {
      await client.addKvRecords({ records: badVal });
    } catch (err) {
      expect(err).to.not.equal(
        null,
        'Should have failed to add Unicode key but did not'
      );
    }
    continueTests = true;
  });

  it('Should fetch the newly created records', async () => {
    continueTests = false;
    try {
      const opts = {
        n: 2,
        start: _numStartingRecords,
      };
      const resp = await client.getKvRecords(opts);
      const { records, total, fetched } = resp;
      _fetchedRecords = records;
      expect(total).to.equal(fetched + _numStartingRecords);
      expect(records.length).to.equal(fetched);
      expect(records.length).to.equal(2);
    } catch (err) {
      expect(err).to.equal(null, err);
    }
    continueTests = true;
  });

  it('Should make a request to an address which is now known', async () => {
    continueTests = false;
    try {
      question('Please reject if you see a hex address');
      await client.sign(ETH_REQ);
    } catch (err) {
      expect(err).to.equal(null, err);
    }
    continueTests = true;
  });

  it('Should make an EIP712 request that uses the record', async () => {
    continueTests = false;
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
          helpers.BTC_PURPOSE_P2PKH,
          helpers.ETH_COIN,
          HARDENED_OFFSET,
          0,
          0,
        ],
        protocol: 'eip712',
        payload: msg,
      },
    };
    try {
      question('Please reject if you see a hex address');
      await client.sign(req);
    } catch (err) {
      expect(err).to.equal(null);
    }
    continueTests = true;
  });

  it('Should make a request that will get ABI-decoded (ERC20 transfer)', async () => {
    continueTests = false;
    const req = JSON.parse(JSON.stringify(ETH_REQ));
    req.data.data = `0x23b872dd00000000000000000000000057974eb88e50cc61049b44e43e90d3bc40fa61c0000000000000000000000000${RANDOM_ADDR.slice(
      2
    )}000000000000000000000000000000000000000000000000000000000000270f`;
    try {
      question('Please reject if you see a hex address');
      await client.sign(req);
    } catch (err) {
      expect(err).to.equal(null, err);
    }
    continueTests = true;
  });

  it('Should remove key value records', async () => {
    continueTests = false;
    try {
      const idsToRemove = [];
      _fetchedRecords.forEach((r) => {
        idsToRemove.push(r.id);
      });
      await client.removeKvRecords({ ids: idsToRemove });
    } catch (err) {
      expect(err).to.equal(null, err);
    }
    continueTests = true;
  });

  it('Should confirm the records we recently added are removed', async () => {
    continueTests = false;
    try {
      const opts = {
        n: 1,
        start: _numStartingRecords,
      };
      const resp = await client.getKvRecords(opts);
      const { records, total, fetched } = resp;
      expect(total).to.equal(_numStartingRecords);
      expect(fetched).to.equal(0);
      expect(records.length).to.equal(0);
    } catch (err) {
      expect(err).to.equal(null, err);
    }
    continueTests = true;
  });

  it('Should add the same record with case sensitivity', async () => {
    continueTests = false;
    const records = {
      [RANDOM_ADDR]: 'Test Address Name',
    };
    try {
      await client.addKvRecords({
        records,
        caseSensitive: true,
        type: 0,
      });
    } catch (err) {
      expect(err).to.equal(null, err);
    }
    continueTests = true;
  });

  it('Should make another request to make sure case sensitivity is enforced', async () => {
    continueTests = false;
    try {
      question('Please reject if you see a hex address');
      await client.sign(ETH_REQ);
    } catch (err) {
      expect(err).to.not.equal(null);
    }
    continueTests = true;
  });

  it('Should get the id of the newly added record', async () => {
    continueTests = false;
    try {
      const opts = {
        n: 1,
        start: _numStartingRecords,
      };
      const resp: any = await client.getKvRecords(opts);
      const { records, total, fetched } = resp;
      expect(total).to.equal(_numStartingRecords + 1);
      expect(fetched).to.equal(1);
      expect(records.length).to.equal(1);
      _fetchedRecords = records;
    } catch (err) {
      expect(err).to.equal(null, err);
    }
    continueTests = true;
  });

  it('Should remove the new record', async () => {
    continueTests = false;
    try {
      const idsToRemove = [];
      _fetchedRecords.forEach((r) => {
        idsToRemove.push(r.id);
      });
      await client.removeKvRecords({ ids: idsToRemove });
    } catch (err) {
      expect(err).to.equal(null, err);
    }
    continueTests = true;
  });

  it('Should confirm there are no new records', async () => {
    continueTests = false;
    try {
      const opts = {
        n: 1,
        start: _numStartingRecords,
      };
      const resp: any = await client.getKvRecords(opts);
      const { records, total, fetched } = resp;
      expect(total).to.equal(_numStartingRecords);
      expect(fetched).to.equal(0);
      expect(records.length).to.equal(0);
    } catch (err) {
      expect(err).to.equal(null, err);
    }
    continueTests = true;
  });
});
