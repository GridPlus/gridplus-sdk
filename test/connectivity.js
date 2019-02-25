// Basic tests for atomic SDK functionality
import assert from 'assert';
import { Client, providers } from 'index';
import NodeCrypto from 'gridplus-node-crypto';
const crypto = require('crypto');
const TIMEOUT_SEC = 59;
const { baseUrl, agent_serial } = require('../secrets.json');
let client

describe('Ethereum via Etherscan: ether transfers', () => {

  before(() => {
    client = new Client({
      baseUrl,
      name: 'basic-test',
      crypto,
      privKey: crypto.randomBytes(32).toString('hex'),
    });
    console.log(client)
  });

  it('Should connect to an agent', (done) => {
    // const serial = process.env.AGENT_SERIAL;
    // client.connect(agent_serial, (err, res) => {
    //   assert(err === null, err);
    //   assert(client.client.ecdhPub === res.key, 'Mismatched key on response')
      done()
    // });
  });
/*
  it('Should pair with the agent', (done) => {
    const appSecret = process.env.APP_SECRET;
    console.log('Pairing with app secret: ', appSecret)
    client.pair(appSecret, (err) => {
      assert(err === null, err)
      done();
    });
  });
  */

});