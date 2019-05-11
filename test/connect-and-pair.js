// Basic tests for atomic SDK functionality
const assert = require('assert');
const Sdk = require('../index.js');
const crypto = require('crypto');
const readline = require('readline');

let client, rl;
let connected = false;

const DEVICE_ID = '40a36bc23f0a';

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
    client.connect('40a36bc23f0a', (err) => { 
      assert(err === null, err);
      connected = true;
      done();
    });
  });

  it('Should attempt to pair with pairing secret', (done) => {
    if (!connected) assert(false == true, 'Could not connect')
    rl.question('Please enter the pairing secret: ', (secret) => {
      rl.close();
      client.pair(secret, (err) => { 
        assert(err === null, err);
        done();
      });
    });
  });

});
