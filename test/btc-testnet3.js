import { Client, providers } from 'index';
import NodeCrypto from '@gridplus/node-crypto';
import { assert } from 'elliptic/lib/elliptic/utils';
import { testing } from '../src/config.js';
const { btcHolder } = testing;
let client, deviceAddresses;

describe('Bitcoin via BlockCypher: transfers', () => {
  before(() => {
    const btc = new providers.Bitcoin({ network: 'test3', blockcypher: true });
    client = new Client({
      clientConfig: {
        name: 'blockcypher-test',
        crypto: NodeCrypto,
        privKey: NodeCrypto.randomBytes(32).toString('hex'),
      },
      providers: [ btc ],
    }) 
  })

  it('Should connect to a BTC node provider', (done) => {
    client.initialize((err, provider) => {
      assert(err === null, err);
      assert(typeof provider === 'object');
      assert(provider[0].height > 0);
      done();
    });
  });

  it('Should connect to an agent', (done) => {
    const serial = process.env.AGENT_SERIAL;
    client.connect(serial, (err, res) => {
      assert(err === null, err);
      assert(client.client.ecdhPub === res.key, 'Mismatched key on response')
      done()
    });
  });

  it('Should pair with the agent', (done) => {
    const appSecret = process.env.APP_SECRET;
    client.pair(appSecret, (err) => {
      assert(err === null, err)
      done();
    });
  });

  it('Should create a manual permission', (done) => {
    client.addManualPermission((err, res) => {
      assert(err === null, err);
      assert(res.result.status === 200);
      done();
    })
  });

  it('Should get the testnet3 balance of the holder account', (done) => {
    client.getBalance('BTC', { address: btcHolder.address }, (err, data) => {
      assert.equal(err, null, err);
      assert(data.txs.length > 0, `address (${btcHolder.address}) has not sent or received any bitcoins. Please request funds from the faucet (https://coinfaucet.eu/en/btc-testnet/) and try again.`);
      done();
    });
  });

  it('Should get the first Bitcoin addresses of the manual permission and log address 0', (done) => {
    const req = {
      permissionIndex: 0,
      isManual: true,
      total: 2,
      network: 'testnet'
    }
    client.addresses(req, (err, res) => {
      assert(err === null, err);
      assert(res.result.data.addresses.length === 2);
      deviceAddresses = res.result.data.addresses;
      // Get the baseline balance for the addresses
      client.getBalance('BTC', { address: deviceAddresses[0] }, (err, d) => {
        assert(err === null, err);
        assert((d.txs.length === 0 && d.total_received === 0) || (d.txs.length > 0 && d.total_received > 0));
        done();
      });
    });
  });



})