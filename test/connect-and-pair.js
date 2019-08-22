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
      timeout: 120000,
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

  function getAddresses(client, opts) {
    return new Promise((resolve, reject) => {
      client.getAddresses(opts, (res) => {
        return resolve(res);
      })
    })
  }

  it('Should connect to an agent', async () => {
    // const _id = question('Please enter the ID of your test device: ');
    // id = _id;
    id = 'daf68f71bf37a3c5';
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
  });

  it('Should get addresses', async () => {
    expect(caughtErr).to.equal(false);
    if (caughtErr == false) {
      const addrData = { currency: 'BTC', startIndex: 1000, n: 5 }
      // Legacy addresses (default `version`)
      let addrs = await getAddresses(client, addrData);
      expect(addrs.err).to.equal(null);
      expect(addrs.data.length).to.equal(5);
      expect(addrs.data[0][0]).to.equal('1');
      // P2SH addresses
      addrData.version = 'P2SH';
      addrData.n = 4;
      addrs = await getAddresses(client, addrData);
      expect(addrs.err).to.equal(null);
      expect(addrs.data.length).to.equal(4);
      expect(addrs.data[0][0]).to.equal('3');
      // Ethereum addresses
      addrData.currency = 'ETH';
      addrs = await getAddresses(client, addrData);
      expect(addrs.err).to.equal(null);
      expect(addrs.data.length).to.equal(4);
      expect(addrs.data[0].slice(0, 2)).to.equal('0x');
      // Failure cases
      // Unsupported currency
      addrData.currency = 'BCH';
      addrs = await getAddresses(client, addrData);
      expect(addrs.err).to.not.equal(null);
      // Unsupported version byte
      addrData.currency = 'BTC';
      addrData.version = 'P2WKH';
      addrs = await getAddresses(client, addrData);      
      expect(addrs.err).to.not.equal(null);
      // Too many addresses (n>10)
      addrData.version = 'P2SH';
      addrData.n = 11;
      addrs = await getAddresses(client, addrData);
      expect(addrs.err).to.not.equal(null);
    }
  });

});
