// Tests on communications with simulated agent devices
import assert from 'assert';
import { sha3, pubToAddress } from 'ethereumjs-util';
import { recoverPubKey } from '../src/util.js';
import { Client } from 'index';
import ReactNativeCrypto from 'gridplus-react-native-crypto';
import crypto from 'crypto';

let client, reactNative, btcAddrs, ethAddrs;
process.on('unhandledRejection', e => { throw e; });

describe('Basic stateless tests (no providers)', () => {

  before(() => {
    // Use React Native crypto for this series of tests.
    // The node.js version is faster, but we want to test both
    const privKey = crypto.randomBytes(32).toString('hex');
    reactNative = new ReactNativeCrypto(privKey);
    client = new Client({ clientConfig: {
      name: 'basic-test',
      crypto: reactNative,
      privKey
    }});
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

  it('Should get the Bitcoin addresses', (done) => {
    const req = {
      total: 2,
    }
    client.addresses(req, (err, addresses) => {
      assert(err === null, err);
      assert(addresses.length === 2);
      assert(addresses[0].slice(0, 1) === '3', 'Not a segwit address');
      btcAddrs = addresses;
      done();
    })
  });

  it('Should get testnet addresses', (done) => {
    const req = {
      total: 2,
      network: 'testnet'
    }
    client.addresses(req, (err, addresses) => {

      assert(err === null, err);
      assert(addresses.length === 2);
      assert(addresses[0].slice(0, 1) === '2', 'Not a testnet address');
      done();
    });
  });

  it('Should get the Ethereum addresses', (done) => {
    const req = {
      total: 2,
      coin_type: '60\'',
    }
    client.addresses(req, (err, addresses) => {
      assert(err === null, err);
      assert(addresses.length === 2);
      assert(addresses[0].slice(0, 2) === '0x', 'Not an Ethereum address');
      ethAddrs = addresses;
      done();
    })
  });

  it('Should find zero permissions saved', (done) => {
    client.permissions((err, permissions) => {
      assert(err === null, err);
      assert(permissions.length === 0, 'Did not find zero permissions');
      done();
    })
  })

  it('Should create an automated permission', (done) => {
    const req = {
      schemaCode: 'ETH',
      timeLimit: 10000,
      params: {
        to: {
          eq: '0x39765400baa16dbcd1d7b473bac4d55dd5a7cffb'
        },
        value: {
          eq: 1000
        },
        data: {
          eq: ''
        }
      }
    }

    client.addPermission(req, (err) => {
      assert(err === null, err);
      done();
    })
  });

  it('Should find one permission saved', (done) => {
    client.permissions((err, permissions) => {
      assert(err === null, err);
      assert(permissions.length === 1, 'Did not find one permission');
      assert(permissions[0].timeLimit === 10000, 'Incorrect timeLimit on permission');
      assert(permissions[0].params.value.eq === 1000, 'Incorrect permission found');
      done();
    })
  })

  it('Should get the Ethereum address and request a signature from it', (done) => {
    const req2 = {
      schemaCode: 'ETH',
      params: {
        nonce: 1,   // Need to specify nonce in this test file because we have not instantied any providers
        gasPrice: 100000000,
        gas: 100000,
        to: '0x39765400baa16dbcd1d7b473bac4d55dd5a7cffb',
        value: 1000,
        data: ''
      },
      accountIndex: 0
    }
    client.sign(req2, (err, sigData) => {
      assert(err === null, err);
      // The message includes the preImage payload concatenated to a signature,
      // separated by a standard string/buffer
      const preImage = Buffer.from(sigData.unsignedTx, 'hex');
      const msg = sha3(preImage);
      const sig = sigData.sig;
      assert(sig.length === 129, 'Incorrect signature length');
      const parsedSig = {
        r: sig.substr(0, 64),
        s: sig.substr(64, 128),
        v: parseInt(sig.slice(-1)),
      } 
      const recoveredPubKey = Buffer.from(recoverPubKey(msg, parsedSig), 'hex');
      const recoveredAddress = `0x${pubToAddress(recoveredPubKey.slice(1)).toString('hex')}`;
      assert(recoveredAddress === ethAddrs[0], 'Incorrect signature');
      done();
    });
  });

  it('Should delete the permission', (done) => {
    client.deletePermission(0, (err) => {
      assert(err === null, err);
      done();
    })
  })

  it('Should now find 0 permissions', (done) => {
    client.permissions((err, permissions) => {
      assert(err === null, err);
      assert(permissions.length === 0, 'Permission was not deleted');
      done();
    })
  })

  it('Should create an automated permission to send Bitcoins', (done) => {
    const req = {
      schemaCode: 'BTC',
      timeLimit: 0,
      params: {
        version: { eq: 1 },
        lockTime: { eq: 0 },
        value: { lte: 12000 },
      }
    };
    client.addPermission(req, (err) => {
      assert(err === null, err);
      done();
    });
  });

  it('Should create an automated Bitcoin transaction', (done) => {
    // Build the request
    const req = {
      schemaCode: 'BTC',
      params: {
        version: 1,
        lockTime: 0,
        recipient: '3EdCNnLV17fcR13aSjPCR4YWjX2wJYbjYu',
        value: 12000,
        change: 0,
        changeAccountIndex: 0,
      },
      inputs: [{ // Need to specify inputs in this test file because we have not instantied any providers
        hash: 'b5bb9d8014a0f9b1d61e21e796d78dccdf1352f23cd32812f4850b878ae4944c',
        outIndex: 0,
        scriptType: 'p2sh(p2wpkh)',
        spendAccountIndex: 0,
        inputValue: 12000,
      }],
      accountIndex: 0,
    };
    client.sign(req, (err, sigData) => {
      assert(err === null, err);
      assert(sigData !== undefined);
      done();
    });
  });

  it('Should delete the pairing', (done) => {
    client.deletePairing((err) => {
      assert(err === null, err);
      done();
    })
  })

  it('Should not be able to request permissions now', (done) => {
    client.permissions((err, permissions) => {
      assert(err !== null, 'Error was null but should not have been.');
      assert(permissions === undefined);
      done();
    })
  })
  
});