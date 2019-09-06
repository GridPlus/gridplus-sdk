// Basic tests for atomic SDK functionality
const expect = require('chai').expect;
const Sdk = require('../index.js');
const crypto = require('crypto');
const question = require('readline-sync').question;
const constants = require('../src/constants.js');

const ETH_TX_DATA_MAX = 100;

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
/*
  it('Should get addresses', async () => {
    expect(caughtErr).to.equal(false);
    if (caughtErr == false) {
      const addrData = { currency: 'BTC', startIndex: 0, n: 5 }
      // Legacy addresses (default `version`)
/*
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
*/
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
*/
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

  function calcVal(txData) {
    let val = 0;
    txData.prevOuts.forEach((o) => {
      val += o.value;
    })
    val -= txData.fee;
    return val;
  }

  it('Should sign Bitcoin transactions', async () => {  
    let txData = {
      prevOuts: [
        { 
          txHash: 'edca754e9b90dbc4cb9fda6899b2e0581fb7c5bde01bd2157c13d15e9aa3a198',
          value: 143784,
          index: 0,
          recipientIndex: 0,
        },
        // {
        //   txHash: 'a88387ca68a67f7f74e91723de0069154b532bf024c0e4054e36ea2234251181',
        //   value: 4912341139,
        //   index: 3,
        //   recipientIndex: 3,
        // }
      ],
      recipient: 'mhifA1DwiMPHTjSJM8FFSL8ibrzWaBCkVT',
      value: 1000,
      fee: 1000,
      isSegwit: false,
      changeIndex: 1,
    };
    txData.value = calcVal(txData);
    let req = {
      currency: 'BTC',
      data: txData,
    };
  
    // const bitcoin = require('bitcoinjs-lib');
    // const txb = new bitcoin.TransactionBuilder();
    // // const alice = new bitcoin.ECPair.fromPrivateKey(Buffer.from('a88387ca68a67f7f74e91723de0069154b532bf024c0e4054e36ea2234251181', 'hex'));
    // txb.addInput(txData.prevOuts[0].txHash, txData.prevOuts[0].index);
    // txb.addInput(txData.prevOuts[1].txHash, txData.prevOuts[1].index);
    // txb.addOutput(txData.recipient, txData.value);
    // const tx = txb.__tx;
    // const hashType = 0x01; // SIGHASH_ALL
    // const prevOutScript0 = Buffer.from('76a91499b680a8a1b37fa8d44fa7c0f950c002d1d9542a88ac', 'hex');
    // const hash0 = tx.hashForSignature(0, prevOutScript0, hashType)
    // console.log('hash0', hash0.toString('hex'));
    
    // Sign a legit tx
    let sigResp = await sign(client, req);
    expect(sigResp.err).to.equal(null);
    expect(sigResp.sigs.length).to.equal(2);




    // [TODO] Validate that signer matches up with the address
    // we get from `getAddresses`



  });

});