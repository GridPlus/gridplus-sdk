// Basic tests for atomic SDK functionality
const constants = require('./../src/constants')
const expect = require('chai').expect;
const Sdk = require('../index.js');
const crypto = require('crypto');
const question = require('readline-sync').question;
const HARDENED_OFFSET = 0x80000000;
const Buffer = require('buffer/').Buffer;
let client, rl, id;
let caughtErr = false;
const EMPTY_WALLET_UID = Buffer.alloc(32);

id = 'drRUHm'

describe('Connect and Pair', () => {

  before(() => {
    client = new Sdk.Client({
      name: 'SDK Test',
      baseUrl: 'https://signing.staging-gridpl.us',
      privKey: Buffer.from('3fb53b677f73e4d2b8c89c303f6f6b349f0075ad88ea126cb9f6632085815dca', 'hex'),
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
      client.getAddresses(opts, (err, res) => {
        if (err) return reject(err);
        return resolve(res);
      })
    })
  }

  function sign(client, opts) {
    return new Promise((resolve, reject) => {
      client.sign(opts, (err, res) => {
        if (err) return reject(err);
        return resolve(res);
      })
    })
  }
/*
  it('Should connect to a Lattice', async () => {
    const _id = question('Please enter the ID of your test device: ');
    id = _id;
    const connectErr = await connect(client, id);
    caughtErr = connectErr !== null;
    expect(connectErr).to.equal(null);
    expect(client.isPaired).to.equal(false);
    expect(client.activeWallet.uid.equals(EMPTY_WALLET_UID)).to.equal(true);
  });


  it('Should attempt to pair with pairing secret', async () => {
    expect(caughtErr).to.equal(false);
    if (caughtErr == false) {
      const secret = question('Please enter the pairing secret: ');
      const pairErr = await pair(client, secret);
      caughtErr = pairErr !== null;
      expect(pairErr).to.equal(null);
      expect(client.activeWallet.uid.equals(EMPTY_WALLET_UID)).to.equal(false);
    }
  });
*/
  it('Should try to connect again but recognize the pairing already exists', async () => {
    expect(caughtErr).to.equal(false);
    if (caughtErr == false) {
      const connectErr = await connect(client, id);
      caughtErr = connectErr !== null;
      expect(connectErr).to.equal(null);
      expect(client.isPaired).to.equal(true);
      expect(client.activeWallet.uid.equals(EMPTY_WALLET_UID)).to.equal(false);
    }
  });


  it('Should get addresses', async () => {
    expect(caughtErr).to.equal(false);
    if (caughtErr == false) {
      const addrData = { 
        currency: 'BTC', 
        startPath: [HARDENED_OFFSET+44, HARDENED_OFFSET, HARDENED_OFFSET, 0, 0], 
        n: 5
      }
      // Bitcoin addresses
      // NOTE: The format of address will be based on the user's Lattice settings
      //       By default, this will be P2SH(P2WPKH), i.e. addresses that start with `3`
      let isError;
      let addrs = await getAddresses(client, addrData);
      expect(addrs.length).to.equal(5);
      expect(addrs[0][0]).to.be.oneOf(["1", "3"]);

      // Ethereum addresses
      addrData.startPath[1] = HARDENED_OFFSET + 60; // ETH currency code
      addrs = await getAddresses(client, addrData);
      // expect(addrs.length).to.equal(4);
      // expect(addrs[0].slice(0, 2)).to.equal('0x');
      addrData.startPath[1] = HARDENED_OFFSET; // Back to BTC

      // Failure cases
      // Unsupported purpose (m/<purpose>/)
      addrData.startPath[0] = 0; // Purpose 0 -- undefined
      try {
        addrs = await getAddresses(client, addrData);
        expect(addrs).to.equal(null);
      } catch (err) {
        expect(err).to.not.equal(null);
      }
      addrData.startPath[0] = HARDENED_OFFSET+44; // Back to 44'

      // Unsupported currency
      addrData.startPath[1] = HARDENED_OFFSET+5; // 5' currency - aka unknown
      try {
        addrs = await getAddresses(client, addrData);
        expect(addrs).to.equal(null);
      } catch (err) {
        expect(err).to.not.equal(null);
      }
      addrData.startPath[1] = HARDENED_OFFSET; // Back to BTC

      // Too many addresses (n>10)
      addrData.n = 11;
      try {
        addrs = await getAddresses(client, addrData);
        expect(addrs).to.equal(null);
      } catch (err) {
        expect(err).to.not.equal(null);
      }

    }
  });
/*
  it('Should sign Ethereum transactions', async () => {
    // Constants from firmware
    const GAS_PRICE_MAX = 100000000000;
    const GAS_LIMIT_MIN = 22000;
    const GAS_LIMIT_MAX = 10000000;
    
    let txData = {
      nonce: 9,
      gasPrice: 1200000000,
      gasLimit: 122000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 6,
      data: null
    };
    let req = {
      currency: 'ETH',
      data: {
        signerPath: [HARDENED_OFFSET+44, HARDENED_OFFSET+60, HARDENED_OFFSET, 0, 0],
        ...txData,
        chainId: 'rinkeby', // Can also be an integer
      }
    }

    // Sign a legit tx 
    let tx = await sign(client, req);
    expect(tx.tx).to.not.equal(null);
    // console.log(tx)

    // Invalid chainId
    req.data.chainId = 'notachain';
    try {
      tx = await(sign(client, req));
      expect(tx.tx).to.equal(null);
    } catch (err) {
      expect(err).to.not.equal(null);
    }
    req.data.chainId = 'rinkeby';

    // Nonce too large (>u16)
    req.data.nonce = 0xffff + 1;
        try {
      tx = await(sign(client, req));
      expect(tx.tx).to.equal(null);
    } catch (err) {
      expect(err).to.not.equal(null);
    }
    // Reset to valid param
    req.data.nonce = 5;

    // GasLimit too low
    req.data.gasLimit = GAS_LIMIT_MIN - 1;
        try {
      tx = await(sign(client, req));
      expect(tx.tx).to.equal(null);
    } catch (err) {
      expect(err).to.not.equal(null);
    }

    // GasLimit too high (>u32)
    req.data.gasLimit = GAS_LIMIT_MAX + 1;
        try {
      tx = await(sign(client, req));
      expect(tx.tx).to.equal(null);
    } catch (err) {
      expect(err).to.not.equal(null);
    }
    // Reset to valid param
    req.data.gasLimit = 122000;

    // GasPrice too high
    req.data.gasPrice = GAS_PRICE_MAX + 1;
        try {
      tx = await(sign(client, req));
      expect(tx.tx).to.equal(null);
    } catch (err) {
      expect(err).to.not.equal(null);
    }
    // Reset to valid param
    req.data.gasLimit = 1200000000;
    
    // `to` wrong size
    req.data.to = '0xe242e54155b1abc71fc118065270cecaaf8b77'
        try {
      tx = await(sign(client, req));
      expect(tx.tx).to.equal(null);
    } catch (err) {
      expect(err).to.not.equal(null);
    }
    // Reset to valid param 
    req.data.to = '0xe242e54155b1abc71fc118065270cecaaf8b7768'
    
    // Value too high
    req.data.value = 2 ** 256;
        try {
      tx = await(sign(client, req));
      expect(tx.tx).to.equal(null);
    } catch (err) {
      expect(err).to.not.equal(null);
    }
    // Reset to valid param
    req.data.value = 0.3 * 10 ** 18;
    
    // Data too large
    req.data.data = crypto.randomBytes(constants.ETH_DATA_MAX_SIZE + 1).toString('hex');
        try {
      tx = await(sign(client, req));
      expect(tx.tx).to.equal(null);
    } catch (err) {
      expect(err).to.not.equal(null);
    }

    // Reset all values at max
    req.data.nonce = 0xfffe;
    req.data.gasLimit = GAS_LIMIT_MAX;
    req.data.gasPrice = GAS_PRICE_MAX;
    req.data.value = 123456000000000000000000;
    req.data.data = crypto.randomBytes(constants.ETH_DATA_MAX_SIZE).toString('hex');
    tx = await sign(client, req);
    expect(tx.tx).to.not.equal(null);

  });

  it('Should sign legacy Bitcoin inputs', async () => {  
    let txData = {
      prevOuts: [
        { 
          txHash: 'c0fb89034692788f4bccbec433a197d68a5eb61417b367ee1994b42be5d68ba7',
          value: 139784,
          index: 1,
          signerPath: [HARDENED_OFFSET+44, HARDENED_OFFSET, HARDENED_OFFSET, 0, 0],
        },
      ],
      recipient: 'mhifA1DwiMPHTjSJM8FFSL8ibrzWaBCkVT',
      value: 1000,
      fee: 1000,
      isSegwit: false,
      changePath: [HARDENED_OFFSET+44, HARDENED_OFFSET, HARDENED_OFFSET, 1, 0],
      changeVersion: 'TESTNET',  // Default 'LEGACY'
      network: 'TESTNET',        // Default 'MAINNET'
    };
    let req = {
      currency: 'BTC',
      data: txData,
    };
    
    // Sign a legit tx
    let sigResp = await sign(client, req);
    expect(sigResp.tx).to.not.equal(null);
    expect(sigResp.txHash).to.not.equal(null);
  });

  it('Should sign segwit Bitcoin inputs', async () => {  
    let txData = {
      prevOuts: [
        { 
          txHash: '08911991c5659349fa507419a20fd398d66d59e823bca1b1b94f8f19e21be44c',
          value: 3469416,
          index: 1,
          signerPath: [HARDENED_OFFSET+44, HARDENED_OFFSET, HARDENED_OFFSET, 0, 0],
        },
        {
          txHash: '19e7aa056a82b790c478e619153c35195211b58923a8e74d3540f8ff1f25ecef',
          value: 3461572,
          index: 0,
          signerPath: [HARDENED_OFFSET+44, HARDENED_OFFSET, HARDENED_OFFSET, 0, 1],
        }
      ],
      recipient: 'mhifA1DwiMPHTjSJM8FFSL8ibrzWaBCkVT',
      value: 1000,
      fee: 1000,
      isSegwit: true,
      changePath: [HARDENED_OFFSET+44, HARDENED_OFFSET, HARDENED_OFFSET, 1, 1],
      changeVersion: 'SEGWIT_TESTNET',  // Default 'LEGACY'
      network: 'TESTNET',        // Default 'MAINNET'
    };
    let req = {
      currency: 'BTC',
      data: txData,
    };
    
    // Sign a legit tx
    let sigResp = await sign(client, req);
    expect(sigResp.tx).to.not.equal(null);
    expect(sigResp.txHash).to.not.equal(null);
  });
*/
});