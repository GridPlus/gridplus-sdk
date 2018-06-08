// Basic tests for atomic SDK functionality
const assert = require('assert');
const crypto = require('crypto');
const Tx = require('ethereumjs-tx');
const config = require(`${__dirname}/../src/config.js`);
const GridPlusSDK = require('../src/index.js').default;
let sdk, privKey, addr, web3, erc20Addr, sender, senderPriv;

// Handle all promise rejections
process.on('unhandledRejection', e => { throw e; });

describe('Basic tests', () => {
  it('Should instantiate an SDK object', (done) => {
    try {
      privKey = crypto.randomBytes(32).toString('hex');
      sdk = new GridPlusSDK({ key: privKey });
      done();
    } catch (err) {
      assert(err === null, err);
      done();
    }
  });

  it('Should connect to an ETH node', (done) => {
    const e = sdk.connectToEth();
    assert(e === null);
    done();
  });

  it('Should get a zero ETH balance for a random address', (done) => {
    addr = '0x' + crypto.randomBytes(20).toString('hex');
    console.log('Address to receive ETH and Tokens: ', addr);
    sdk.getEthBalance(addr)
    .then((balance) => {
      assert(typeof balance === 'number');
      assert(balance === 0);
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });

  const toSend = 10 ** 18;
  it('Should transfer ETH to the random address', (done) => {
    web3 = sdk.getWeb3();
    sender = config.testing.ethHolder;
    senderPriv = new Buffer(sender.privKey, 'hex');
    web3.eth.getTransactionCount(sender.address)
    .then((nonce) => {
      // Setup a transaction to send 1 ETH (10**18 wei) to our random address
      const rawTx = {
        nonce,
        to: addr,
        gasLimit: '0x186a0',
        value: toSend
      };
      const tx = new Tx(rawTx);
      tx.sign(senderPriv);
      const serTx = tx.serialize();
      return web3.eth.sendSignedTransaction(`0x${serTx.toString('hex')}`)
    })
    .then(() => { done(); })
    .catch((err) => { assert(err === null, err); done(); });
  });

  it('Should find a non-zero ETH balance for the random address', (done) => {
    sdk.getEthBalance(addr)
    .then((balance) => {
      assert(typeof balance === 'number');
      // Note that balances are returned in whole units
      assert(balance * 10**18 === toSend, `Expected balance of ${toSend}, but got ${balance}`);
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });

  it('Should deploy an ERC20 token', (done) => {
    web3.eth.getTransactionCount(sender.address)
    .then((nonce) => {
      const rawTx = {
        nonce,
        gasLimit: '0x1e8480',
        value: 0,
        data: config.testing.erc20Src,
      };
      const tx = new Tx(rawTx);
      tx.sign(senderPriv);      
      const serTx = tx.serialize();
      return web3.eth.sendSignedTransaction(`0x${serTx.toString('hex')}`)
    })
    .then((receipt) => {
      assert(receipt.contractAddress !== undefined, 'Contract did not deploy properly');
      erc20Addr = receipt.contractAddress;
      done(); 
    })
    .catch((err) => { assert(err === null, `Got Error: ${err}`); done(); });
  });

  it('Should find a zero token balance for the address', (done) => {
    sdk.getEthBalance(addr, erc20Addr)
    .then((balance) => {
      assert(typeof balance === 'number');
      assert(balance === 0);
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });

  it('Should find a non-zero balance for the sender', (done) => {
    sdk.getEthBalance(sender.address, erc20Addr)
    .then((balance) => {
      assert(typeof balance === 'number');
      assert(balance > 0, `Sender balance should be >0, but is ${balance}`);
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });

  it('Should transfer some ERC20 tokens to the address', (done) => {
    web3.eth.getTransactionCount(sender.address)
    .then((nonce) => {
      const rawTx = {
        nonce,
        to: erc20Addr,
        gasLimit: '0x186a0',
        data: config.erc20.transfer(addr, 1)
      };
      const tx = new Tx(rawTx);
      tx.sign(senderPriv);      
      const serTx = tx.serialize();
      return web3.eth.sendSignedTransaction(`0x${serTx.toString('hex')}`)
    })
    .then((receipt) => {
      assert(receipt.contractAddress !== undefined, 'Contract did not deploy properly');
      erc20Addr = receipt.contractAddress;
      done(); 
    })
    .catch((err) => { assert(err === null, `Got Error: ${err}`); done(); });
  });

  it('Should find a zero token balance for the address', (done) => {
    sdk.getEthBalance(addr, erc20Addr)
    .then((balance) => {
      assert(typeof balance === 'number');
      assert(balance > 0);
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });

})
