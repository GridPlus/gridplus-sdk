// Basic tests for atomic SDK functionality
const assert = require('assert');
const Tx = require('ethereumjs-tx');
const config = require('./../config.js');
const GridPlusSDK = require('./../index.js').default;
let sdk, privKey, addr, provider, erc20Addr, sender, senderPriv, balance;

// Handle all promise rejections
process.on('unhandledRejection', e => { throw e; });

describe('Basic tests', () => {
  it('Should instantiate an SDK object', (done) => {
    try {
      sdk = new GridPlusSDK();
      done();
    } catch (err) {
      assert(err === null, err);
      done();
    }
  });

  it('Should connect to an ETH node', (done) => {
    sdk.connectToEth()
    .then((success) => {
      assert(success === true);
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    })
  });

  it('Should connect to an agent', (done) => {
    sdk.connect((err, res) => {
      assert(err === null, err);
      assert(sdk.ecdhPub === res.key, 'Mismatched key on response')
      done()
    });
  });

  it('Should start the pairing process on the agent', (done) => {
    sdk.setupPairing((err, res) => {
      assert(err === null, err);
      assert(res.status === 200);
      done();
    });
  });

  it('Should pair with the agent', (done) => {
    sdk.pair(sdk.name, (err, res) => {
      assert(err === null, err)
      done();
    });
  });

  it('Should create a manual permission', (done) => {
    sdk.addManualPermission((err, res) => {
      assert(err === null, err);
      assert(res.result.status === 200);
      done();
    })
  });

  it('Should get the ETH address', (done) => {
    const req = {
      permissionIndex: 0,
      isManual: true,
      total: 1,
      coin_type: "60'"
    }
    sdk.addresses(req, (err, res) => {
      assert(err === null, err);
      addr = res.result.data.addresses;
      sdk.getBalance('ETH', addr)
      .then((_balance) => {
        balance = _balance;
        done();
      });
    });
  });


  const toSend = 10 ** 18;
  it('Should transfer ETH to the address', (done) => {
    provider = sdk.getProvider();
    sender = config.testing.ethHolder;
    senderPriv = Buffer.from(sender.privKey, 'hex');
    sdk.getTransactionCount('ETH', sender.address)
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
      return provider.sendTransaction(`0x${serTx.toString('hex')}`)
    })
    .then(() => { done(); })
    .catch((err) => { assert(err === null, err); done(); });
  });

  it('Should find a non-zero ETH balance for the address', (done) => {
    sdk.getBalance('ETH', addr)
    .then((_balance) => {
      assert(typeof _balance === 'number');
      // Note that _balances are returned in whole units (ether)
      assert(_balance * 10**18 === (balance * 10**18) + toSend, `Expected balance of ${toSend}, but got ${_balance}`);
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });

  it('Should deploy an ERC20 token', (done) => {
    sdk.getTransactionCount('ETH', sender.address)
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
      return provider.sendTransaction(`0x${serTx.toString('hex')}`)
    })
    .then((txHash) => {
      return provider.getTransactionReceipt(txHash);
    })
    .then((receipt) => {
      assert(receipt.contractAddress !== undefined, 'Contract did not deploy properly');
      erc20Addr = receipt.contractAddress;
      done(); 
    })
    .catch((err) => { assert(err === null, `Got Error: ${err}`); done(); });
  });

  // A freshly deployed ERC20 token should have a new address, so the balance will be 0
  // (unlike ETH, which may have been sent in previous tests)
  it('Should find a zero token balance for the address', (done) => {
    sdk.getBalance('ERC20', addr, erc20Addr)
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
    sdk.getBalance('ETH', sender.address, erc20Addr)
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
    sdk.getTransactionCount('ETH', sender.address)
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
      return provider.sendTransaction(`0x${serTx.toString('hex')}`)
    })
    .then((txHash) => {
      return provider.getTransactionReceipt(txHash);
    })
    .then((receipt) => {
      assert(receipt.logs.length > 0, 'Transaction did not emit any logs.');
      done();
    })
    .catch((err) => { assert(err === null, `Got Error: ${err}`); done(); });
  });

  it('Should find a zero token balance for the address', (done) => {
    sdk.getBalance('ERC20', addr, erc20Addr)
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

  it('Should get the token transfer history for the user', (done) => {
    sdk.getTransactionHistory('ERC20', addr, erc20Addr)
    .then((events) => {
      assert(events.in.length === 1, `Number of inbound transfers should be 1, but got ${events.in.length}`);
      assert(events.out.length === 0, `Number of outbound transfers should be 0, but got ${events.out.length}`);      
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    })
  });

  it('Should get the nonce of the recipient account', (done) => {
    sdk.getTransactionCount('ETH', addr)
    .then((nonce) => {
      assert(nonce === 0, `User should not have sent any transactions, but got nonce of ${nonce}`);
      done();
    })
    .catch((err) => {
      assert(err === null, err);
      done();
    });
  });

  it('Should transfer ETH out of the agent account');

  it('Should transfer the ERC20 token out of the agent account');

})
