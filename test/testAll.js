// Basic tests for atomic SDK functionality
const constants = require('./../src/constants')
const expect = require('chai').expect;
const Sdk = require('../index.js');
const crypto = require('crypto');
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
      privKey: Buffer.from('0fb6b6f2504680ffab98b87d95e9f733c53a90044854ad77503498ddca09578c', 'hex'),
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

  function sign(client, opts) {
    return new Promise((resolve, reject) => {
      client.sign(opts, (res) => {
        return resolve(res);
      })
    })
  }

  it('Should connect to a Lattice', async () => {
    // const _id = question('Please enter the ID of your test device: ');
    // id = _id;
    id = 'daf68f71bf37a3c5';
    // id = '56237bc33a5f1fee';
    const connectErr = await connect(client, id);
    caughtErr = connectErr !== null;
    expect(connectErr).to.equal(null);
    // expect(client.isPaired).to.equal(false);
  });
/*
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
*/

  it('Should get addresses', async () => {
    expect(caughtErr).to.equal(false);
    if (caughtErr == false) {
      const addrData = { currency: 'BTC', startIndex: 0, n: 5 }
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

      // Testnet
      addrData.version = 'TESTNET';
      addrData.n = 2;
      addrData.startIndex = 0;
      addrs = await getAddresses(client, addrData);
      expect(addrs.err).to.equal(null);
      expect(addrs.data.length).to.equal(2);
      const isTestnet = ['2', 'm', 'n'].indexOf(addrs.data[0][0]);
      expect(isTestnet).to.be.above(-1);
      console.log('addrs.data', addrs.data)
    }
  });


  it('Should sign Ethereum transactions', async () => {
    // Constants from firmware
    const GAS_PRICE_MAX = 100000000000;
    const GAS_LIMIT_MIN = 22000;
    const GAS_LIMIT_MAX = 10000000;
    
    let txData = {
      nonce: 5,
      gasPrice: 1200000000,
      gasLimit: 122000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      // value: 0.05 * 10 **18,
      value: 6,
      data: null
    };
    let req = {
      currency: 'ETH',
      data: {
        signerIndex: 0,
        txData,
        chainId: 'rinkeby', // Can also be an integer
        preventReplays: true
      }
    }

    // Sign a legit tx 
    let tx = await sign(client, req);
    expect(tx.err).to.equal(null);
    expect(tx.data).to.not.equal(null);

    // Invalid chainId
    req.data.chainId = 'notachain';
    tx = await(sign(client, req));
    expect(tx.err).to.not.equal(null);
    req.data.chainId = 'rinkeby';

    // Nonce too large (>u16)
    req.data.txData.nonce = 0xffff + 1;
    tx = await sign(client, req);
    expect(tx.err).to.not.equal(null);
    // Reset to valid param
    req.data.txData.nonce = 5;

    // GasLimit too low
    req.data.txData.gasLimit = GAS_LIMIT_MIN - 1;
    tx = await sign(client, req);
    expect(tx.err).to.not.equal(null);

    // GasLimit too high (>u32)
    req.data.txData.gasLimit = GAS_LIMIT_MAX + 1;
    tx = await sign(client, req);
    expect(tx.err).to.not.equal(null);
    // Reset to valid param
    req.data.txData.gasLimit = 122000;

    // GasPrice too high
    req.data.txData.gasPrice = GAS_PRICE_MAX + 1;
    tx = await sign(client, req);
    expect(tx.err).to.not.equal(null);
    // Reset to valid param
    req.data.txData.gasLimit = 1200000000;
    
    // `to` wrong size
    req.data.txData.to = '0xe242e54155b1abc71fc118065270cecaaf8b77'
    tx = await sign(client, req);
    expect(tx.err).to.not.equal(null);
    // Reset to valid param 
    req.data.txData.to = '0xe242e54155b1abc71fc118065270cecaaf8b7768'
    
    // Value too high
    req.data.txData.value = 2 ** 256;
    tx = await sign(client, req);
    expect(tx.err).to.not.equal(null);
    // Reset to valid param
    req.data.txData.value = 0.3 * 10 ** 18;
    
    // Data too large
    req.data.txData.data = crypto.randomBytes(constants.ETH_DATA_MAX_SIZE + 1).toString('hex');
    tx = await sign(client, req);
    expect(tx.err).to.not.equal(null);

    // Reset all values at max
    req.data.txData.nonce = 0xfffe;
    req.data.txData.gasLimit = GAS_LIMIT_MAX;
    req.data.txData.gasPrice = GAS_PRICE_MAX;
    req.data.txData.value = 123456000000000000000000;
    req.data.txData.data = crypto.randomBytes(constants.ETH_DATA_MAX_SIZE).toString('hex');
    tx = await sign(client, req);
    expect(tx.err).to.equal(null);
    expect(tx.data).to.not.equal(null);



    // [TODO] Validate that signer matches up with the address
    // we get from `getAddresses`

  });


  it('Should sign Bitcoin transactions', async () => {  
    let txData = {
      prevOuts: [
        { 
          txHash: 'c0fb89034692788f4bccbec433a197d68a5eb61417b367ee1994b42be5d68ba7',
          value: 139784,
          index: 1,
          recipientIndex: 0,
        },
      ],
      recipient: 'mhifA1DwiMPHTjSJM8FFSL8ibrzWaBCkVT',
      value: 1000,
      fee: 1000,
      isSegwit: false,
      changeIndex: 0,            // Default 0
      changeVersion: 'TESTNET',  // Default 'LEGACY'
      network: 'TESTNET',        // Default 'MAINNET'
    };
    let req = {
      currency: 'BTC',
      data: txData,
    };
    
    // Sign a legit tx
    let sigResp = await sign(client, req);
    expect(sigResp.err).to.equal(null);
    expect(sigResp.data).to.not.equal(null);
    expect(sigResp.extraData.txHash).to.not.equal(null);

    // [TODO] Validate that signer matches up with the address
    // we get from `getAddresses`



  });

});