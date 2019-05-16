// Basic tests for atomic SDK functionality
const assert = require('assert');
const Sdk = require('../index.js');
const crypto = require('crypto');
const readline = require('readline');

let client, rl, id;
// const DEVICE_ID = '40a36bc23f0a';

describe('Connect and Pair', () => {

  before(() => {
    client = new Sdk.Client({
      name: 'ConnectAndPairClient',
      crypto,
    });
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  });

  it('Should connect to an agent', (done) => {
    rl.question('Please enter the ID of your test device: ', (_id) => {
      id = _id;
      client.connect(id, (err) => { 
        assert(err === null, err);
        assert(client.isConnected() === true);
        done();
      });
    })
  });

  it('Should attempt to pair with pairing secret', (done) => {
    if (!client.isConnected()) assert(false == true, 'Could not connect')
    rl.question('Please enter the pairing secret: ', (secret) => {
      rl.close();
      client.pair(secret, (err) => {
        assert(err === null, err);
        done();
      });
    });
  });

  it('Should try to connect again but recognize the pairing already exists', (done) => {
    client.connect(id, (err) => {
      assert(err === null, err);
      assert(client.pairingSalt === null, 'Pairing salt was updated, but should not have been');
      assert(client.isConnected() === true);
      done();
    })
  })

});
