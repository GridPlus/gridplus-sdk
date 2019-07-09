// Basic tests for atomic SDK functionality
const assert = require('assert');
const Sdk = require('../index.js');
const crypto = require('crypto');
const readline = require('readline');

let client, rl, id;
let timeout = false;
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
        timeout = err !== null;
        assert(client.isPaired === false, 'Could not enter pairing mode');
        done();
      });
    })
  });

  it('Should attempt to pair with pairing secret', (done) => {
    if (timeout) assert(false == true, 'Initial connect timed out');
    rl.question('Please enter the pairing secret: ', (secret) => {
      rl.close();
      client.pair(secret, (err) => {
        assert(err === null, err);
        done();
      });
    });
  });

/*
  it('Should try to connect again but recognize the pairing already exists', (done) => {
    if (timeout) assert(false == true, 'Initial connect timed out');    
    client.connect(id, (err) => {
      assert(err === null, err);
      assert(client.pairingSalt === null, 'Pairing salt was updated, but should not have been');
      done();
    })
  })
*/
});
