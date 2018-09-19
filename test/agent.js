// Tests on communications with simulated agent devices
import assert from 'assert';
import { sha3, pubToAddress } from 'ethereumjs-util';
import { api } from './../src/config.js';
import { recoverPubKey } from '../src/util.js';
import { Client } from 'index';
import ReactNativeCrypto from '@gridplus/react-native-crypto';
import crypto from 'crypto';
const { SPLIT_BUF } = api;

let client, reactNative;
/*
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

  it('Should get the Bitcoin addresses of the manual permission', (done) => {
    const req = {
      permissionIndex: 0,
      isManual: true,
      total: 3,
    }
    client.addresses(req, (err, res) => {
      assert(err === null, err);
      assert(res.result.data.addresses.length === 3);
      assert(res.result.data.addresses[0].slice(0, 1) === '3', 'Not a segwit address');
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
    client.addresses(req, (err, res) => {
      assert(err === null, err);
      assert(res.result.data.addresses.length === 3);
      assert(res.result.data.addresses[0].slice(0, 1) === '2', 'Not a testnet address');
      done();
    });
  });

  it('Should create an automated permission', (done) => {
    const req = {
      schemaIndex: 0,
      typeIndex: 0,
      rules: [
        null, null, null,
        null, null, null,
        null, null, null,
        'equals', '0x39765400baa16dbcd1d7b473bac4d55dd5a7cffb', null,
        'equals', 1000, null,
        'equals', '', null,
      ],
      timeLimit: 10000
    };

    client.addPermission(req, (err, res) => {
      assert(err === null, err);
      assert(res.result.status === 200);
      done();
    })
  });

  it('Should get the Ethereum address and request a signature from it', (done) => {
    const req1 = {
      permissionIndex: 0,
      isManual: false,
      coin_type: '60\''
    };
    const req2 = {
      schemaIndex: 0,
      typeIndex: 0,
      params: [ 1, 100000000, 100000, '0x39765400baa16dbcd1d7b473bac4d55dd5a7cffb', 1000, '' ]
    }

    client.addresses(req1, (err, res) => {
      assert(err === null, err);
      const addr = res.result.data.addresses;
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
        assert(recoveredAddress === addr, 'Incorrect signature');
        done();
      });
    });
  });

  it('Should create an automated permission to send Bitcoins', (done) => {
    const req = {
      schemaIndex: 1,
      typeIndex: 2,
      rules: [ // version, locktime, recipient, value, outScriptType (e.g. p2pkh)
        'equals', 1, null,
        'equals', 0, null,
        null, null, null,
        'lte', 12000, null,
        null, null, null,
        null, null, null,
      ],
      timeLimit: 0,
    };

    client.addPermission(req, (err, res) => {
      assert(err === null, err);
      assert(res.result.status === 200);
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
      schemaIndex: 1,
      typeIndex: 2,
      params: params,
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
*/