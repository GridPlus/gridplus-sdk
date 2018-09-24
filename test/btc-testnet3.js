import { Client, providers } from 'index';
import NodeCrypto from '@gridplus/node-crypto';
import { assert } from 'elliptic/lib/elliptic/utils';
let client;

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
      assert(provider.height > 0);
      done();
    });
  });

  


})