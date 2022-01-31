// Basic tests for atomic SDK functionality
const constants = require('./../src/constants')
const expect = require('chai').expect;
const question = require('readline-sync').question;
const helpers = require('./testUtil/helpers');
const HARDENED_OFFSET = constants.HARDENED_OFFSET;
let client, id;
let caughtErr = false;

describe('Connect and Pair', () => {

  before(() => {
    client = helpers.setupTestClient(process.env);
    if (process.env.DEVICE_ID)
      id = process.env.DEVICE_ID;
  });

 
  //-------------------------------------------
  // TESTS
  //-------------------------------------------
  it('Should connect to a Lattice', async () => {
    // Again, we assume that if an `id` has already been set, we are paired
    // with the hardcoded privkey above.
    if (!process.env.DEVICE_ID) {
      const _id = question('Please enter the ID of your test device: ');
      id = _id;
      const connectErr = await helpers.connect(client, id);
      caughtErr = connectErr !== null;
      expect(connectErr).to.equal(null);
      expect(client.isPaired).to.equal(false);
      expect(client.hasActiveWallet()).to.equal(false);
    }
  });

  it('Should attempt to pair with pairing secret', async () => {
    if (!process.env.DEVICE_ID) {
      expect(caughtErr).to.equal(false);
      if (caughtErr === false) {
        const secret = question('Please enter the pairing secret: ');
        const pairErr = await helpers.pair(client, secret);
        caughtErr = pairErr !== null;
        expect(pairErr).to.equal(null);
        expect(client.hasActiveWallet()).to.equal(true);
      }
    }
  });

  it('Should try to connect again but recognize the pairing already exists', async () => {
    expect(caughtErr).to.equal(false);
    if (caughtErr === false) {
      const connectErr = await helpers.connect(client, id);
      caughtErr = connectErr !== null;
      expect(connectErr).to.equal(null);
      expect(client.isPaired).to.equal(true);
      expect(client.hasActiveWallet()).to.equal(true);
    }
  });

  it('Should get addresses', async () => {
    expect(caughtErr).to.equal(false);
    if (caughtErr === false) {
      const fwConstants = constants.getFwVersionConst(client.fwVersion);
      const addrData = { 
        currency: 'BTC', 
        startPath: [helpers.BTC_PURPOSE_P2SH_P2WPKH, helpers.BTC_COIN, HARDENED_OFFSET, 0, 0], 
        n: 5,
      }
      // Bitcoin addresses
      // NOTE: The format of address will be based on the user's Lattice settings
      //       By default, this will be P2SH(P2WPKH), i.e. addresses that start with `3`
      let addrs;
      addrs = await helpers.execute(client, 'getAddresses', addrData);
      expect(addrs.length).to.equal(5);
      expect(addrs[0][0]).to.equal('3');

      // Ethereum addresses
      addrData.startPath[0] = helpers.BTC_PURPOSE_P2PKH;
      addrData.startPath[1] = helpers.ETH_COIN;
      addrData.n = 1;
      addrs = await helpers.execute(client, 'getAddresses', addrData, 2000);
      expect(addrs.length).to.equal(1);
      expect(addrs[0].slice(0, 2)).to.equal('0x');
      // If firmware supports it, try shorter paths
      if (fwConstants.flexibleAddrPaths) {
        const flexData = { 
          currency: 'ETH', 
          startPath: [helpers.BTC_PURPOSE_P2PKH, helpers.ETH_COIN, HARDENED_OFFSET, 0], 
          n: 1,
        }
        addrs = await helpers.execute(client, 'getAddresses', flexData, 2000);
        expect(addrs.length).to.equal(1);
        expect(addrs[0].slice(0, 2)).to.equal('0x')
      }

      // Bitcoin testnet
      addrData.startPath[0] = helpers.BTC_PURPOSE_P2SH_P2WPKH;
      addrData.startPath[1] = helpers.BTC_TESTNET_COIN;
      addrData.n = 1;
      addrs = await helpers.execute(client, 'getAddresses', addrData, 2000);
      expect(addrs.length).to.equal(1);
      expect(addrs[0][0]).to.be.oneOf(['n', 'm', '2']);
      addrData.startPath[1] = helpers.BTC_COIN;

      // Bech32
      addrData.startPath[0] = helpers.BTC_PURPOSE_P2WPKH;
      addrData.n = 1;
      addrs = await helpers.execute(client, 'getAddresses', addrData, 2000);
      expect(addrs.length).to.equal(1);
      expect(addrs[0].slice(0, 3)).to.be.oneOf(['bc1']);
      addrData.startPath[0] = helpers.BTC_PURPOSE_P2SH_P2WPKH;
      addrData.n = 5;

      addrData.startPath[4] = 1000000;
      addrData.n = 3;
      addrs = await helpers.execute(client, 'getAddresses', addrData, 2000);
      expect(addrs.length).to.equal(addrData.n);
      addrData.startPath[4] = 0;
      addrData.n = 1;

      // Unsupported purpose (m/<purpose>/)
      addrData.startPath[0] = 0; // Purpose 0 -- undefined
      try {
        addrs = await helpers.execute(client, 'getAddresses', addrData, 2000);
        expect(addrs).to.equal(null);
      } catch (err) {
        expect(err).to.not.equal(null);
      }
      addrData.startPath[0] = helpers.BTC_PURPOSE_P2SH_P2WPKH;

      // Unsupported currency
      addrData.startPath[1] = HARDENED_OFFSET+5; // 5' currency - aka unknown
      try {
        addrs = await helpers.execute(client, 'getAddresses', addrData, 2000);
        expect(addrs).to.equal(null);
      } catch (err) {
        expect(err).to.not.equal(null);
      }
      addrData.startPath[1] = helpers.BTC_COIN;
      // Too many addresses (n>10)
      addrData.n = 11;
      try {
        addrs = await helpers.execute(client, 'getAddresses', addrData, 2000);
        expect(addrs).to.equal(null);
      } catch (err) {
        expect(err).to.not.equal(null);
      }

    }
  });

  it('Should sign Ethereum transactions', async () => {
    // Constants from firmware
    const fwConstants = constants.getFwVersionConst(client.fwVersion)
    const GAS_PRICE_MAX = fwConstants.ethMaxGasPrice;
    const GAS_LIMIT_MIN = 22000;
    const GAS_LIMIT_MAX = 12500000;
    
    const txData = {
      nonce: '0x02',
      gasPrice: '0x1fe5d61a00',
      gasLimit: '0x034e97',
      to: '0x1af768c0a217804cfe1a0fb739230b546a566cd6',
      value: '0x01cba1761f7ab9870c',
      data: '0x17e914679b7e160613be4f8c2d3203d236286d74eb9192f6d6f71b9118a42bb033ccd8e8'
    };
    const req = {
      currency: 'ETH',
      data: {
        signerPath: [helpers.BTC_PURPOSE_P2PKH, helpers.ETH_COIN, HARDENED_OFFSET, 0, 0],
        ...txData,
        chainId: 'rinkeby', // Can also be an integer
      }
    }
    // Sign a tx that does not use EIP155 (no EIP155 on rinkeby for some reason)
    let tx;
    tx = await helpers.execute(client, 'sign', req);
    expect(tx.tx).to.not.equal(null);

    // Sign a tx with EIP155
    req.data.chainId = 'mainnet';
    tx = await helpers.execute(client, 'sign', req);
    expect(tx.tx).to.not.equal(null);
    req.data.chainId = 'rinkeby';

    req.data.data = client.crypto.randomBytes(fwConstants.ethMaxDataSz).toString('hex');
    tx = await(helpers.execute(client, 'sign', req));
    expect(tx.tx).to.not.equal(null);
    req.data.data = null;

    // Invalid chainId
    req.data.chainId = 'notachain';
    try {
      tx = await(helpers.execute(client, 'sign', req));
      expect(tx.tx).to.equal(null);
    } catch (err) {
      expect(err).to.not.equal(null);
    }
    req.data.chainId = 'rinkeby';

    // Nonce too large (>u16)
    req.data.nonce = 0xffff + 1;
        try {
      tx = await(helpers.execute(client, 'sign', req));
      expect(tx.tx).to.equal(null);
    } catch (err) {
      expect(err).to.not.equal(null);
    }
    // Reset to valid param
    req.data.nonce = 5;

    // GasLimit too low
    req.data.gasLimit = GAS_LIMIT_MIN - 1;
        try {
      tx = await(helpers.execute(client, 'sign', req));
      expect(tx.tx).to.equal(null);
    } catch (err) {
      expect(err).to.not.equal(null);
    }

    // GasLimit too high (>u32)
    req.data.gasLimit = GAS_LIMIT_MAX + 1;
    try {
      tx = await(helpers.execute(client, 'sign', req));
      expect(tx.tx).to.equal(null);
    } catch (err) {
      expect(err).to.not.equal(null);
    }
    // Reset to valid param
    req.data.gasLimit = 122000;

    // GasPrice too high
    req.data.gasPrice = GAS_PRICE_MAX + 1;
        try {
      tx = await(helpers.execute(client, 'sign', req));
      expect(tx.tx).to.equal(null);
    } catch (err) {
      expect(err).to.not.equal(null);
    }
    // Reset to valid param
    req.data.gasPrice = 1200000000;

    // `to` wrong size
    req.data.to = '0xe242e54155b1abc71fc118065270cecaaf8b77'
        try {
      tx = await(helpers.execute(client, 'sign', req));
      expect(tx.tx).to.equal(null);
    } catch (err) {
      expect(err).to.not.equal(null);
    }
    // Reset to valid param 
    req.data.to = '0xe242e54155b1abc71fc118065270cecaaf8b7768'
    
    // Value too high
    req.data.value = 2 ** 256;
        try {
      tx = await(helpers.execute(client, 'sign', req));
      expect(tx.tx).to.equal(null);
    } catch (err) {
      expect(err).to.not.equal(null);
    }
    // Reset to valid param
    req.data.value = 0.3 * 10 ** 18;

    // Test data range
    const maxDataSz = fwConstants.ethMaxDataSz + (fwConstants.extraDataMaxFrames * fwConstants.extraDataFrameSz);
    req.data.data = client.crypto.randomBytes(maxDataSz).toString('hex');
    tx = await(helpers.execute(client, 'sign', req));
    expect(tx.tx).to.not.equal(null);
    question('Please ACCEPT the following transaction only if the warning screen displays. Press enter to continue.')
    req.data.data = client.crypto.randomBytes(maxDataSz+1).toString('hex');
    tx = await(helpers.execute(client, 'sign', req));
    expect(tx.tx).to.not.equal(null);
    req.data.data = client.crypto.randomBytes(fwConstants.ethMaxDataSz).toString('hex');
    tx = await(helpers.execute(client, 'sign', req));
    expect(tx.tx).to.not.equal(null);
    req.data.data = client.crypto.randomBytes(maxDataSz).toString('hex');
    tx = await(helpers.execute(client, 'sign', req));
    expect(tx.tx).to.not.equal(null);

    // Test non-ETH EVM coin_type
    req.data.signerPath[1] = helpers.HARDENED_OFFSET + 1007;
    req.data.data = null;
    tx = await(helpers.execute(client, 'sign', req));
    expect(tx.tx).to.not.equal(null);
  });

  it('Should sign legacy Bitcoin inputs', async () => {  
    const txData = {
      prevOuts: [
        { 
          txHash: '6e78493091f80d89a92ae3152df7fbfbdc44df09cf01a9b76c5113c02eaf2e0f',
          value: 10000,
          index: 1,
          signerPath: [helpers.BTC_PURPOSE_P2SH_P2WPKH, helpers.BTC_TESTNET_COIN, HARDENED_OFFSET, 0, 0],
        },
      ],
      recipient: 'mhifA1DwiMPHTjSJM8FFSL8ibrzWaBCkVT',
      value: 1000,
      fee: 1000,
      // isSegwit: false, // old encoding
      changePath: [helpers.BTC_PURPOSE_P2SH_P2WPKH, helpers.BTC_TESTNET_COIN, HARDENED_OFFSET, 1, 0],
    };
    const req = {
      currency: 'BTC',
      data: txData,
    };
    
    // Sign a legit tx
    const sigResp = await helpers.execute(client, 'sign', req);
    expect(sigResp.tx).to.not.equal(null);
    expect(sigResp.txHash).to.not.equal(null);
  });

  it('Should sign wrapped segwit Bitcoin inputs', async () => {  
    const txData = {
      prevOuts: [
        { 
          txHash: 'ab8288ef207f11186af98db115aa7120aa36ceb783e8792fb7b2f39c88109a99',
          value: 10000,
          index: 1,
          signerPath: [helpers.BTC_PURPOSE_P2SH_P2WPKH, helpers.BTC_TESTNET_COIN, HARDENED_OFFSET, 0, 0],
        },
      ],
      recipient: '2NGZrVvZG92qGYqzTLjCAewvPZ7JE8S8VxE',
      value: 1000,
      fee: 1000,
      changePath: [helpers.BTC_PURPOSE_P2SH_P2WPKH, helpers.BTC_TESTNET_COIN, HARDENED_OFFSET, 1, 0],
    };
    const req = {
      currency: 'BTC',
      data: txData,
    };
    // Sign a legit tx
    const sigResp = await helpers.execute(client, 'sign', req);
    expect(sigResp.tx).to.not.equal(null);
    expect(sigResp.txHash).to.not.equal(null);
  });

  it('Should sign wrapped segwit Bitcoin inputs to a bech32 address', async () => {
    const txData = {
      prevOuts: [
        { 
          txHash: 'f93d0a77f58b4274d84f427d647f1f27e38b4db79fd975691e15109fde7ea06e',
          value: 1802440,
          index: 1,
          signerPath: [helpers.BTC_PURPOSE_P2SH_P2WPKH, helpers.BTC_TESTNET_COIN, HARDENED_OFFSET, 1, 0],
        },
      ],
      recipient: 'tb1qym0z2a939lefrgw67ep5flhf43dvpg3h4s96tn',
      value: 1000,
      fee: 1000,
      changePath: [helpers.BTC_PURPOSE_P2SH_P2WPKH, helpers.BTC_TESTNET_COIN, HARDENED_OFFSET, 1, 0],
    };
    const req = {
      currency: 'BTC',
      data: txData,
    };
    // Sign a legit tx
    const sigResp = await helpers.execute(client, 'sign', req);
    expect(sigResp.tx).to.not.equal(null);
    expect(sigResp.txHash).to.not.equal(null);
  });

  it('Should sign an input from a native segwit account',  async () => {
    const txData = {
      prevOuts: [
        {
          txHash: 'b2efdbdd3340d2bc547671ce3993a6f05d70343c07578f9d7f5626fdfc06fa35',
          value: 76800,
          index: 0,
          signerPath: [helpers.BTC_PURPOSE_P2WPKH, helpers.BTC_TESTNET_COIN, HARDENED_OFFSET, 0, 0]
        }
      ],
      recipient: '2N4gqWT4oqWL2gz9ps92z9fm2Bg3FUkqG7Q',
      value: 70000,
      fee: 4380,
      isSegwit: true,
      changePath: [helpers.BTC_PURPOSE_P2WPKH, helpers.BTC_TESTNET_COIN, HARDENED_OFFSET, 1, 0],
    };
    const req = {
      currency: 'BTC',
      data: txData,
    };
    // Sign a legit tx
    const sigResp = await helpers.execute(client, 'sign', req);
    expect(sigResp.tx).to.not.equal(null);
    expect(sigResp.txHash).to.not.equal(null);
    expect(sigResp.changeRecipient.slice(0, 2)).to.equal('tb');
  })

  it('Should test permission limits', async () => {
    // Fail to add permissions where limit or window is 0
    const opts = {
      currency: 'ETH',
      timeWindow: 0,
      limit: 5,
      decimals: 18,
      asset: null,
    };
    try {
      await helpers.execute(client, 'addPermissionV0', opts);
    } catch (err) {
      expect(err).to.equal('Time window and spending limit must be positive.');
    }
    try {
      opts.timeWindow = 300;
      opts.limit = 0;
      await helpers.execute(client, 'addPermissionV0', opts);
    } catch (err) {
      expect(err).to.equal('Time window and spending limit must be positive.');
    }
    // Add a 5-minute permission allowing 5 wei to be spent
    opts.timeWindow = 300;
    opts.limit = 5;
    await helpers.execute(client, 'addPermissionV0', opts);
    // Fail to add the same permission again
    try {
      await helpers.execute(client, 'addPermissionV0', opts);
    } catch (err) {
      const expectedCode = constants.responseCodes.RESP_ERR_ALREADY;
      expect(err.indexOf(constants.responseMsgs[expectedCode])).to.be.greaterThan(-1);
    }
    // Spend 2 wei
    const txData = {
      nonce: 0,
      gasPrice: 1200000000,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 2,
      data: null
    };
    const req = {
      currency: 'ETH',
      data: {
        signerPath: [helpers.BTC_PURPOSE_P2PKH, helpers.ETH_COIN, HARDENED_OFFSET, 0, 0],
        ...txData,
        chainId: 'rinkeby', // Can also be an integer
      }
    };
    // Test the spending limit. The first two requests should auto-sign.
    // Spend once -> 3 wei left
    let signResp = await helpers.execute(client, 'sign', req);
    expect(signResp.tx).to.not.equal(null);
    // Spend again -> 1 wei left
    signResp = await helpers.execute(client, 'sign', req);
    expect(signResp.tx).to.not.equal(null);
    // Spend again. This time it should fail to load the permission
    question('Please REJECT the following transaction request. Press enter to continue.')
    try {
      signResp = await helpers.execute(client, 'sign', req);
      expect(signResp.tx).to.equal(null);
    } catch (err) {
      const expectedCode = constants.responseCodes.RESP_ERR_USER_DECLINED;
      expect(err.indexOf(constants.responseMsgs[expectedCode])).to.be.greaterThan(-1);
    }
    // Spend 1 wei this time. This should be allowed by the permission.
    req.data.value = 1;
    signResp = await helpers.execute(client, 'sign', req);
    expect(signResp.tx).to.not.equal(null);
  })

});