// Tests on communications with simulated agent devices
import assert from 'assert';
import { sha3, pubToAddress } from 'ethereumjs-util';
import { api } from '../src/config.js';
import { recoverPubKey } from '../src/util.js';
import { Client } from 'index';
import ReactNativeCrypto from '@gridplus/react-native-crypto';
import crypto from 'crypto';
const { SPLIT_BUF } = api;

let client, reactNative;

describe('basic tests', () => {

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
    console.log('appSecret: ', appSecret)
    client.pair(appSecret, (err) => {
      assert(err === null, err)
      done();
    });
  });

  it('Should create a manual permission', (done) => {
    client.addManualPermission((err) => {
      assert(err === null, err);
      done();
    })
  });

  it('Should get the Bitcoin addresses of the manual permission', (done) => {
    const req = {
      permissionIndex: 0,
      isManual: true,
      total: 3,
    }
    client.addresses(req, (err, addresses) => {
      assert(err === null, err);
      assert(addresses.length === 3);
      assert(addresses[0].slice(0, 1) === '3', 'Not a segwit address');
      done();
    })
  });

  it('Should get testnet addresses', (done) => {
    const req = {
      permissionIndex: 0,
      isManual: true,
      total: 3,
      network: 'testnet'
    }
    client.addresses(req, (err, addresses) => {

      assert(err === null, err);
      assert(addresses.length === 3);
      assert(addresses[0].slice(0, 1) === '2', 'Not a testnet address');
      done();
    });
  });

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

  it('Should get the Ethereum address and request a signature from it', (done) => {
    // TODO: remove permissionIndex and isManual from request
    const req1 = {
      permissionIndex: 0,
      isManual: false,
      coin_type: '60\''
    };
    const req2 = {
      schemaCode: 'ETH',
      params: {
        nonce: 1,
        gasPrice: 100000000,
        gas: 100000,
        to: '0x39765400baa16dbcd1d7b473bac4d55dd5a7cffb',
        value: 1000,
        data: ''
      }
    }

    client.addresses(req1, (err, address) => {
      assert(err === null, err);
      client.signAutomated(req2, (err, res) => {
        assert(err === null, err);
        assert(res.result.status === 200);
        // The message includes the preImage payload concatenated to a signature,
        // separated by a standard string/buffer
        const sigData = res.result.data.sigData.split(SPLIT_BUF);
        const preImage = Buffer.from(sigData[0], 'hex');
        const msg = sha3(preImage);
        const sig = sigData[1];
        assert(sig.length === 129, 'Incorrect signature length');
        const parsedSig = {
          r: sig.substr(0, 64),
          s: sig.substr(64, 128),
          v: parseInt(sig.slice(-1)),
        } 
        const recoveredPubKey = Buffer.from(recoverPubKey(msg, parsedSig), 'hex');
        const recoveredAddress = `0x${pubToAddress(recoveredPubKey.slice(1)).toString('hex')}`;
        assert(recoveredAddress === address, 'Incorrect signature');
        done();
      });
    });
  });

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
    const req1 = {
      permissionIndex: 0,
      isManual: false,
      coin_type: '0\''
    };
    // Build inputs: [ txHash, outIndex, scriptType, spendAccountIndex ]
    let params = [ 1, 0, '3EdCNnLV17fcR13aSjPCR4YWjX2wJYbjYu', 12000, 0 ];
    const inputs = [
      'b5bb9d8014a0f9b1d61e21e796d78dccdf1352f23cd32812f4850b878ae4944c', // txHash
      0,                                                                  // outIndex
      'p2sh(p2wpkh)',                                                     // scriptType
      0,                                                                  // spend account sub-index
      0,                                                                  // spend account index
      12000,                                                              // input value
    ];
    params = params.concat(inputs);
    // Build the request
    const req2 = {
      schemaCode: 'BTC',
      params: {
        version: 1,
        lockTime: 0,
        recipient: '3EdCNnLV17fcR13aSjPCR4YWjX2wJYbjYu',
        value: 12000,
        change: 0,
        changeAccountIndex: 0,
      },
      inputs: [{
        hash: 'b5bb9d8014a0f9b1d61e21e796d78dccdf1352f23cd32812f4850b878ae4944c',
        outIndex: 0,
        scriptType: 'p2sh(p2wpkh)',
        spendAccountIndex: 0,
        inputValue: 12000,
      }]
    };
    client.addresses(req1, (err, res) => {
      assert(err === null, err);
      assert(res !== undefined);
      // const addr = res.result.data.addresses;
      client.signAutomated(req2, (err, res) => {
        assert(err === null, err);
        assert(res !== undefined);

        // Make sure the signature came out of the right pubkey
        // const sigData = res.result.data.sigData.split(api.SPLIT_BUF);
        // TODO: test sigData
        done()
      });
    });
  });

});