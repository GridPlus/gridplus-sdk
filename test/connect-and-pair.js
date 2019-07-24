// Basic tests for atomic SDK functionality
const assert = require('assert');
const expect = require('chai').expect;
const Sdk = require('../index.js');
const crypto = require('crypto');
const readline = require('readline');
const question = require('readline-sync').question;

let client, rl, id;
let caughtErr = false;
// const DEVICE_ID = '40a36bc23f0a';

describe('Connect and Pair', () => {

  before(() => {
    client = new Sdk.Client({
      name: 'ConnectAndPairClient',
      crypto,
    });
  });

  function connect(client, id) {
    return new Promise((resolve, reject) => {
      client.connect(id, (err) => {
        return resolve(err);
      })
    })
  }

  function pair(client, secret) {
    return new Promise((resolve, reject) => {
      client.pair(secret, (err) => {
        return resolve(err);
      })
    })
  }

  it('Should connect to an agent', async () => {
    const _id = question('Please enter the ID of your test device: ');
    id = _id;
    const connectErr = await connect(client, id);
    caughtErr = connectErr !== null;
    expect(connectErr).to.equal(null);
    expect(client.isPaired).to.equal(false);
  });

  it('Should attempt to pair with pairing secret', async () => {
    expect(caughtErr).to.equal(false);
    if (caughtErr == false) {
      const secret = question('Please enter the pairing secret: ');
      const pairErr = await pair(client, secret);
      caughtErr = pairErr !== null;
      expect(pairErr).to.equal(null);
    }
  });

  it('Should try to connect again but recognize the pairing already exists', async () => {
    expect(caughtErr).to.equal(false);
    if (caughtErr == false) {
      const connectErr = await connect(client, id);
      caughtErr = connectErr !== null;
      expect(connectErr).to.equal(null);
      expect(client.isPaired).to.equal(true);
    }
  })

});
