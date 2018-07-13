// Basic tests for atomic SDK functionality
const assert = require('assert');
const Tx = require('ethereumjs-tx');
const EthUtil = require('ethereumjs-util');
const config = require('../config.js');
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
      sdk.getBalance('ETH', addr, (err, data) => {
        assert.equal(err, null, err);
        balance = data.balance;
        done();
      });
    });
  });

  const toSend = 10 ** 18;
  it('Should transfer ETH to the address', (done) => {
    provider = sdk.getProvider();
    sender = config.testing.ethHolder;
    senderPriv = Buffer.from(sender.privKey, 'hex');
    // Build a tx for the sender
    sdk.buildTx('ETH', sender.address, addr, toSend, (err, _tx) => {
      assert(err === null, err);
      const tx = new Tx({ nonce: _tx[0], gasPrice: _tx[1], gasLimit: _tx[2], to: _tx[3], value: _tx[4], data: _tx[5] });
      tx.sign(senderPriv);
      const serTx = tx.serialize();
      return provider.sendTransaction(`0x${serTx.toString('hex')}`)
      .then(() => { done(); })
      .catch((err) => { assert(err === null, err); })
    })
  });

  it('Should find a non-zero ETH balance for the address', (done) => {
    sdk.getBalance('ETH', addr, (err, data) => {
      assert(err === null, err);
      const _balance = data.balance;
      assert(typeof _balance === 'number');
      // Note that _balances are returned in whole units (ether)
      assert(_balance * 10**18 === (balance * 10**18) + toSend, `Expected balance of ${toSend}, but got ${_balance}`);
      balance = _balance;
      done();
    });
  });

  it('Should deploy an ERC20 token', (done) => {
    sdk.buildTx('ETH', sender.address, addr, 0, (err, _tx) => {
      assert(err === null, err);
      const rawTx = {
        nonce: _tx[0],
        gasPrice: _tx[1],
        gasLimit: '0x1e8480',
        value: 0,
        data: config.testing.erc20Src,
      }
      const tx = new Tx(rawTx);
      tx.sign(senderPriv);
      const serTx = tx.serialize();
      return provider.sendTransaction(`0x${serTx.toString('hex')}`)
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
  });

  // A freshly deployed ERC20 token should have a new address, so the balance will be 0
  // (unlike ETH, which may have been sent in previous tests)
  it('Should find a zero token balance for the address', (done) => {
    sdk.getBalance('ERC20', addr, erc20Addr, (err, data) => {
      assert(err === null, err);
      assert(typeof data.balance === 'number');
      assert(data.balance === 0);
      done();
    });
  });

  it('Should find a non-zero balance for the sender', (done) => {
    sdk.getBalance('ETH', sender.address, erc20Addr, (err, data) => {
      assert(err === null, err);
      assert(typeof data.balance === 'number');
      assert(data.balance > 0, `Sender balance should be >0, but is ${data.balance}`);
      done();
    });
  });

  it('Should transfer some ERC20 tokens to the address', (done) => {
    sdk.buildTx('ETH', sender.address, addr, 1, { ERC20Token: erc20Addr}, (err, _tx) => {
      assert(err === null, err);
      const tx = new Tx(_tx);
      tx.sign(senderPriv);
      const serTx = tx.serialize();
      return provider.sendTransaction(`0x${serTx.toString('hex')}`)
      .then((txHash) => {
        return provider.getTransactionReceipt(txHash);
      })
      .then((receipt) => {
        assert(receipt.logs.length > 0, 'Transaction did not emit any logs.');
        done();
      })
      .catch((err) => { assert(err === null, `Got Error: ${err}`); done(); });
    });
  });

  it('Should find a zero token balance for the address', (done) => {
    sdk.getBalance('ERC20', addr, erc20Addr, (err, data) => {
      assert(err === null, err);
      assert(typeof data.balance === 'number');
      assert(data.balance > 0);
      done();
    });
  });

  it('Should get the token transfer history for the user', (done) => {
    sdk.getBalance('ERC20', addr, erc20Addr, (err, data) => {
      assert(err === null, err);
      assert(data.transfers.in.length === 1, `Number of inbound transfers should be 1, but got ${data.transfers.in.length}`);
      assert(data.transfers.out.length === 0, `Number of outbound transfers should be 0, but got ${data.transfers.out.length}`);
      done();
    });
  });

  it('Should transfer ETH out of the agent account', (done) => {
    const randAddr = '0xdde20a2810ff23775585cf2d87991c7f5ddb8c22'
    sdk.buildTx('ETH', addr, randAddr, 10000, (err, tx) => {
      assert(err === null, err);
      const params = {
        schemaIndex: 0,
        typeIndex: 0,
        params: tx
      };
      sdk.signManual(params, (err, res) => {
        assert(err === null, err);
        assert(res.result.status === 200);
        const sigData = res.result.data.sigData.split(config.SPLIT_BUF);
        const msg = EthUtil.sha3(Buffer.from(sigData[0], 'hex'));
        const test = new Tx(tx.concat([null, null, null]));
        test.raw = test.raw.slice(0, test.raw.length - 3);

        const sig = sigData[1];
        const v = parseInt(sig.slice(-1)) + 27;
        const vrs = [ v, Buffer.from(sig.slice(0, 64), 'hex'), Buffer.from(sig.slice(64, 128), 'hex'),  ];
        // Check that the signer is correct
        const signer = '0x' + EthUtil.pubToAddress(EthUtil.ecrecover(Buffer.from(msg, 'hex'), v, vrs[1], vrs[2])).toString('hex');
        assert(signer === addr, `Expected signer to be ${addr}, got ${signer}`);

        // Create a new transaction with the returned signature
        const newTx = new Tx(tx.concat(vrs));
        provider.sendTransaction(`0x${newTx.serialize().toString('hex')}`)
        .then((txHash) => {
          return provider.getTransaction(txHash);
        })
        .then((receipt) => {
          assert(receipt.blockNumber > 0, 'Transaction not included in block');
          sdk.getBalance('ETH', addr, (err, data) => {
            assert(err === null, err);
            assert(data.balance < balance, 'Balance did not reduce');
            done();
          });
        });
      });
    });
  });

  it('Should transfer the ERC20 token out of the agent account', (done) => {
    const randAddr = '0xdde20a2810ff23775585cf2d87991c7f5ddb8c22';
    sdk.buildTx('ETH', addr, randAddr, 1, { ERC20Token: erc20Addr}, (err, tx) => {
      assert(err === null, err);
      const params = {
        schemaIndex: 0,
        typeIndex: 1,
        params: tx
      };
      sdk.signManual(params, (err, res) => {
        assert(err === null, err);
        const sigData = res.result.data.sigData.split(config.SPLIT_BUF);
        const sig = sigData[1];
        const v = parseInt(sig.slice(-1)) + 27;
        const vrs = [ v, Buffer.from(sig.slice(0, 64), 'hex'), Buffer.from(sig.slice(64, 128), 'hex'),  ];
        const newTx = new Tx(tx.concat(vrs));
        provider.sendTransaction(`0x${newTx.serialize().toString('hex')}`)
        .then((txHash) => {
          return provider.getTransaction(txHash);
        })
        .then((receipt) => {
          assert(receipt.blockNumber > 0, 'Transaction not included in block');
          sdk.getBalance('ERC20', addr, erc20Addr, (err, data) => {
            assert(err === null, err);
            assert(data.transfers.out.length > 0);
            done();
          });
        });
      });
    });
  });

})
