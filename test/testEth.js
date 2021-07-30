// Tests for ETH transaction edge cases
// NOTE: You must run the following BEFORE executing these tests:
//
// 1. Pair with the device once. This will ask you for your deviceID, which will
//    act as a salt for your pairing:
//
//    env REUSE_KEY=1 npm run test
//
// 2. Connect with the same deviceID you specfied in 1:
//
//    env DEVICE_ID='<your_device_id>' npm test
//
// After you do the above, you can run this test with `npm run test-eth`
//
// NOTE: It is highly suggested that you set `AUTO_SIGN_DEV_ONLY=1` in the firmware
//        root CMakeLists.txt file (for dev units)
require('it-each')({ testPerIteration: true });
const BN = require('bignumber.js');
const crypto = require('crypto');
const EthTx = require('@ethersproject/transactions')
const constants = require('./../src/constants')
const expect = require('chai').expect;
const helpers = require('./testUtil/helpers');
const seedrandom = require('seedrandom');
const keccak256 = require('js-sha3').keccak256;
const prng = new seedrandom(process.env.SEED || 'myrandomseed');
const HARDENED_OFFSET = constants.HARDENED_OFFSET;
let client = null;
let numRandom = 20; // Number of random tests to conduct
const randomTxData = [];
const randomTxDataLabels = [];
let ETH_GAS_PRICE_MAX;                  // value depends on firmware version
const ETH_GAS_LIMIT_MIN = 22000;        // Ether transfer (smallest op) is 22k gas
const ETH_GAS_LIMIT_MAX = 12500000;     // 10M is bigger than the block size
const MSG_PAYLOAD_METADATA_SZ = 28;     // Metadata that must go in ETH_MSG requests
const defaultTxData = {
  nonce: 0,
  gasPrice: 1200000000,
  gasLimit: 50000,
  to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
  value: 100,
  data: null
};

function randInt(n) {
  return Math.floor(n * prng.quick());
}

function buildIterLabels() {
  for (let i = 0; i < numRandom; i++)
    randomTxDataLabels.push({ label: `${i+1}/${numRandom}`, number: i })
}

// Test boundaries for chainId sizes. We allow chainIds up to MAX_UINT64, but
// the mechanism to test is different for chainIds >254.
// NOTE: All unknown chainIds lead to using EIP155 (which includes all of these)
function getChainId(pow, add) {
  return `0x${new BN(2).pow(pow).plus(add).toString(16)}`
}

function buildRandomTxData(fwConstants) {
  const maxDataSz = fwConstants.ethMaxDataSz + (fwConstants.extraDataMaxFrames * fwConstants.extraDataFrameSz);
  for (let i = 0; i < numRandom; i++) {
    const tx = {
      nonce: `0x${new BN(randInt(16000)).toString(16)}`,
      gasPrice: `0x${new BN(randInt(ETH_GAS_PRICE_MAX)).toString(16)}`,
      gasLimit: `0x${new BN(ETH_GAS_LIMIT_MIN + randInt(ETH_GAS_LIMIT_MAX - ETH_GAS_LIMIT_MIN)).toString(16)}`,
      value: `0x${new BN(randInt(10**randInt(30))).toString(16)}`,
      to: `0x${crypto.randomBytes(20).toString('hex')}`,
      data: `0x${crypto.randomBytes(randInt(maxDataSz)).toString('hex')}`,
      eip155: randInt(2) > 0 ? true : false,
      // 51 is the max bit size that we can validate with our bignum lib (see chainID section)
      _network: getChainId(randInt(52), 0), 
    }
    randomTxData.push(tx);
  }
}

function buildTxReq(txData, network=1, signerPath=[helpers.BTC_LEGACY_PURPOSE, helpers.ETH_COIN, HARDENED_OFFSET, 0, 0]) {
  return {
    currency: 'ETH',
    data: {
      signerPath,
      ...txData,
      chainId: network
    }
  }
}

let foundError = false;

async function testTxPass(req) {
  const tx = await helpers.sign(client, req);
  // Make sure there is transaction data returned
  // (this is ready for broadcast)
  const txIsNull = tx.tx === null;
  if (txIsNull === true)
    foundError = true;
  expect(txIsNull).to.equal(false);
  // Check the transaction data against a reference implementation
  const txData = {
    type: req.data.type || null,
    nonce: req.data.nonce,
    to: req.data.to,
    gasPrice: req.data.gasPrice,
    gasLimit: req.data.gasLimit,
    data: req.data.data,
    value: req.data.value,
    chainId: new BN(req.data.chainId, 16).toNumber(),
  };
  if (req.data.maxFeePerGas)
    txData.maxFeePerGas = req.data.maxFeePerGas;
  if (req.data.maxPriorityFeePerGas)
    txData.maxPriorityFeePerGas = req.data.maxPriorityFeePerGas;
  if (req.data.accessList)
    txData.accessList = req.data.accessList;
  const sigData = {
    v: parseInt(`0x${tx.sig.v.toString('hex')}`),
    r: `0x${tx.sig.r}`,
    s: `0x${tx.sig.s}`,
  }
  // When using `recoveryParam` rather than `v` (e.g. for EIP1559 or EIP2930 txs)
  // we get either 0 or 1, with 0 represented with an empty buffer.
  // We need to convert that here.
  if (isNaN(sigData.v))
    sigData.v = 0;
  // Non-EIP155 legacy transactions need to have `chainId=0` for ethers.js
  // (legacy means `type` is `null` or `0`)
  if ((txData.type === null || txData.type === 0) && sigData.v <= 28)
    txData.chainId = 0;
  // There is one test where we submit an address without the prefix
  if (txData.to.slice(0, 2) !== '0x')
    txData.to = `0x${txData.to}`
  const expectedTx = EthTx.serialize(txData, sigData)
  if (tx.tx !== expectedTx) {
    foundError = true;
  }
  expect(tx.tx).to.equal(expectedTx);
  return tx
}

async function testTxFail(req) {
  let tx;
  try {
    tx = await helpers.sign(client, req);
  } catch (err) {
    expect(err).to.not.equal(null);
    return;
  }
  const txIsNull = tx.tx === null;
  expect(txIsNull).to.equal(true, 'Transaction successful but failure was expected.');
}

// Determine the number of random transactions we should build
if (process.env.N)
  numRandom = parseInt(process.env.N);
// Build the labels
buildIterLabels();

describe('Setup client', () => {
  it('Should setup the test client', () => {
    client = helpers.setupTestClient(process.env);
    expect(client).to.not.equal(null);
  })

  it('Should connect to a Lattice and make sure it is already paired.', async () => {
    // Again, we assume that if an `id` has already been set, we are paired
    // with the hardcoded privkey above.
    expect(process.env.DEVICE_ID).to.not.equal(null);
    const connectErr = await helpers.connect(client, process.env.DEVICE_ID);
    expect(connectErr).to.equal(null);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);
    // Set the correct max gas price based on firmware version
    const fwConstants = constants.getFwVersionConst(client.fwVersion);
    ETH_GAS_PRICE_MAX = fwConstants.ethMaxGasPrice;
    // Build the random transactions
    buildRandomTxData(fwConstants);
  });
})

describe('Test new transaction types',  () => {
  it('Should test eip1559 params', async () => {
    const txData = {
      type: 2,
      maxFeePerGas: 1200000000,
      maxPriorityFeePerGas: 1200000000,
      nonce: 0,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 100,
      data: '0xdeadbeef',
    };
    // maxFeePerGas must be >= maxPriorityFeePerGas
    await testTxPass(buildTxReq(txData))
    txData.maxFeePerGas += 1;
    await testTxPass(buildTxReq(txData))
    txData.maxFeePerGas -= 2;
    await testTxFail(buildTxReq(txData))
  })

  it('Should test eip1559 on a non-EIP155 network', async () => {
    const txData = {
      type: 2,
      maxFeePerGas: 1200000000,
      maxPriorityFeePerGas: 1000,
      nonce: 0,
      gasPrice: 1200000000,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 100,
      data: '0xdeadbeef',
    };
    await testTxPass(buildTxReq(txData), 4)
  })

  it('Should test eip1559 with no access list', async () => {
    const txData = {
      type: 2,
      maxFeePerGas: 1200000000,
      maxPriorityFeePerGas: 1000,
      nonce: 0,
      gasPrice: 1200000000,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 100,
      data: '0xdeadbeef',
    };
    await testTxPass(buildTxReq(txData))
  })

  it('Should test eip1559 with an access list (should pre-hash)', async () => {
    const txData = {
      type: 2,
      maxFeePerGas: 1200000000,
      maxPriorityFeePerGas: 1000,
      nonce: 0,
      gasPrice: 1200000000,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 100,
      data: '0xdeadbeef',
      accessList: [
        { 
          address: '0xe242e54155b1abc71fc118065270cecaaf8b7768', 
          storageKeys: [
            '0x7154f8b310ad6ce97ce3b15e3419d9863865dfe2d8635802f7f4a52a206255a6'
          ]
        },
        { 
          address: '0xe0f8ff08ef0242c461da688b8b85e438db724860', 
          storageKeys: []
        }
      ]
    };
    await testTxPass(buildTxReq(txData))
  })

  it('Should test eip2930 with no access list', async () => {
    const txData = {
      type: 1,
      nonce: 0,
      gasPrice: 1200000000,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 100,
      data: '0xdeadbeef',
    };
    await testTxPass(buildTxReq(txData))
  })

  it('Should test eip2930 with an access list (should pre-hash)', async () => {
    const txData = {
      type: 1,
      nonce: 0,
      gasPrice: 1200000000,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 100,
      data: '0xdeadbeef',
      accessList: [
        { 
          address: '0xe242e54155b1abc71fc118065270cecaaf8b7768', 
          storageKeys: [
            '0x7154f8b310ad6ce97ce3b15e3419d9863865dfe2d8635802f7f4a52a206255a6'
          ]
        },
        { 
          address: '0xe0f8ff08ef0242c461da688b8b85e438db724860', 
          storageKeys: []
        }
      ]
    };
    await testTxPass(buildTxReq(txData))
  })

})

if (!process.env.skip) {
  describe('Test ETH Tx Params', () => {
    beforeEach(() => {
      expect(foundError).to.equal(false, 'Error found in prior test. Aborting.');
      setTimeout(() => {}, 5000);
    })

    it('Should test and validate signatures from shorter derivation paths', async () => {
      if (constants.getFwVersionConst(client.fwVersion).varAddrPathSzAllowed) {
        // m/44'/60'/0'/x
        const path = [helpers.BTC_LEGACY_PURPOSE, helpers.ETH_COIN, HARDENED_OFFSET, 0];
        const txData = JSON.parse(JSON.stringify(defaultTxData));
        await testTxPass(buildTxReq(txData, 1, path));
        await testTxPass(buildTxReq(txData, 1, path.slice(0, 3)));      
        await testTxPass(buildTxReq(txData, 1, path.slice(0, 2)));
        await testTxFail(buildTxReq(txData, 1, path.slice(0, 1)));            
      }
    })
    it('Should test that chainId=137 shows "MATIC" and chainId=56 shows "BNB" units', async () => {
      const txData = JSON.parse(JSON.stringify(defaultTxData));
      await testTxPass(buildTxReq(txData, `0x${(137).toString(16)}`));
      await testTxPass(buildTxReq(txData, `0x${(56).toString(16)}`));
    })

    it('Should test range of chainId sizes and EIP155 tag', async () => {
      const txData = JSON.parse(JSON.stringify(defaultTxData));
      // Add some random data for good measure, since this will interact with the data buffer
      txData.data = `0x${crypto.randomBytes(randInt(100)).toString('hex')}`;

      let chainId = 1;
      // This one can fit in the normal chainID u8

      chainId = getChainId(8, -2); // 254
      await testTxPass(buildTxReq(txData, chainId))
      // These will need to go in the `data` buffer field
      chainId = getChainId(8, -1); // 255
      await testTxPass(buildTxReq(txData, chainId));
      chainId = getChainId(8, 0); // 256
      await testTxPass(buildTxReq(txData, chainId));
      chainId = getChainId(16, -2);
      await testTxPass(buildTxReq(txData, chainId));
      chainId = getChainId(16, -1);
      await testTxPass(buildTxReq(txData, chainId));
      chainId = getChainId(16, 0);
      await testTxPass(buildTxReq(txData, chainId));
      chainId = getChainId(32, -2);
      await testTxPass(buildTxReq(txData, chainId));

      chainId = getChainId(32, -1);
      await testTxPass(buildTxReq(txData, chainId));
      chainId = getChainId(32, 0);
      await testTxPass(buildTxReq(txData, chainId));

      // Annoyingly, our reference implementation that is used to validate the full
      // response payload can only build bignums of max size 2**51, so that is as
      // far as we can validate the full payload here. This of course uses the full
      // 8 byte chainID buffer, so we can test that size here.
      chainId = getChainId(51, 0);
      await testTxPass(buildTxReq(txData, chainId));
      // Although we can't check the payload itself, we can still validate that chainIDs
      // >UINT64_MAX will fail internal checks.
      let res;
      chainId = getChainId(64, -1); // UINT64_MAX should pass
      res = await helpers.sign(client, buildTxReq(txData, chainId));
      expect(res.tx).to.not.equal(null);
      chainId = getChainId(64, 0); // UINT64_MAX+1 should fail
      try {
        res = await helpers.sign(client, buildTxReq(txData, chainId));
      } catch (err) {
        expect(typeof err).to.equal('string');
      }
      // Test out a numerical chainId as well
      const numChainId = 10000
      chainId = `0x${numChainId.toString(16)}`; // 0x2710
      await testTxPass(buildTxReq(txData, chainId));
    })

    it('Should test dataSz + chainId length boundaries', async () => {
      // Instruct the user to reject pre-hashed payloads
      const t = '\n\nPlease REJECT pre-hashed transactions in this test. Press Y to continue.';
      const continueTests = require('cli-interact').getYesNo(t);
      expect(continueTests).to.equal(true);

      const txData = JSON.parse(JSON.stringify(defaultTxData));
      let chainId = 1;

      // Test boundary of new dataSz
      chainId = getChainId(51, 0); // 8 byte id
      // 8 bytes for the id itself and 1 byte for chainIdSz. This data is serialized into the request payload.
      let chainIdSz = 9;
      const fwConstants = constants.getFwVersionConst(client.fwVersion);
      const metadataSz = fwConstants.totalExtraEthTxDataSz || 0;
      const maxDataSz = (fwConstants.ethMaxDataSz - metadataSz) + 
                        (fwConstants.extraDataMaxFrames * fwConstants.extraDataFrameSz);
      txData.data = `0x${crypto.randomBytes(maxDataSz - chainIdSz).toString('hex')}`;
      await testTxPass(buildTxReq(txData, chainId));
      txData.data = `0x${crypto.randomBytes(maxDataSz - chainIdSz + 1).toString('hex')}`;
      await testTxFail(buildTxReq(txData, chainId));
      // Also test smaller sizes
      chainId = getChainId(16, -1);
      chainIdSz = 3;
      txData.data = `0x${crypto.randomBytes(maxDataSz - chainIdSz).toString('hex')}`;
      await testTxPass(buildTxReq(txData, chainId));
      txData.data = `0x${crypto.randomBytes(maxDataSz - chainIdSz + 1).toString('hex')}`;
      await testTxFail(buildTxReq(txData, chainId));
    })

    it('Should test range of `value`', async () => {
      const txData = JSON.parse(JSON.stringify(defaultTxData))
      txData.value = 1;
      await testTxPass(buildTxReq(txData))
      txData.value = 1234;
      await testTxPass(buildTxReq(txData))
      txData.value = `0x${new BN('10e14').toString(16)}`;
      await testTxPass(buildTxReq(txData))
      txData.value = `0x${new BN('10e64').toString(16)}`;
      await testTxPass(buildTxReq(txData))      
      txData.value = `0x${new BN('1e77').minus(1).toString(16)}`;
      await testTxPass(buildTxReq(txData))
      txData.value = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      await testTxPass(buildTxReq(txData))
    });

    it('Should test the range of `data`', async () => {
      const txData = JSON.parse(JSON.stringify(defaultTxData))

      // Expected passes
      txData.data = null;
      await testTxPass(buildTxReq(txData))
      txData.data = '0x';
      await testTxPass(buildTxReq(txData))
      txData.data = '0x12345678';
      await testTxPass(buildTxReq(txData))

      // Check upper limit
      function buildDataStr(x, n) {
        x = x < 256 ? x : 0;
        const xs = x.toString(16).length === 1 ? `0${x.toString(16)}` : x.toString(16);
        let s = '0x';
        for (let i = 0; i < n; i++)
          s += xs
        return s;
      }
      const fwConstants = constants.getFwVersionConst(client.fwVersion);
      const maxDataSz = fwConstants.ethMaxDataSz + (fwConstants.extraDataMaxFrames * fwConstants.extraDataFrameSz);

      txData.data = buildDataStr(1, maxDataSz - 1)
      await testTxPass(buildTxReq(txData))
      txData.data = buildDataStr(2, maxDataSz)  
      await testTxPass(buildTxReq(txData))

      const t = '\n\nPlease REJECT the following tx if it is pre-hashed. Press Y to continue.';
      const continueTests = require('cli-interact').getYesNo(t);
      expect(continueTests).to.equal(true);

      // Expected failures
      txData.data = buildDataStr(3, maxDataSz + 1)
      await testTxFail(buildTxReq(txData))
    });

    it('Should test the range of `gasPrice`', async () => {
      const txData = JSON.parse(JSON.stringify(defaultTxData));
      
      // Expected passes
      txData.gasPrice = 0;
      await testTxPass(buildTxReq(txData))
      txData.gasPrice = ETH_GAS_PRICE_MAX;
      await testTxPass(buildTxReq(txData))

      // Expected failures
      txData.gasPrice = ETH_GAS_PRICE_MAX + 1;
      await testTxFail(buildTxReq(txData))
    });

    it('Should test the range of `to`', async () => {
      const txData = JSON.parse(JSON.stringify(defaultTxData));
      
      // Expected passes
      txData.to = '0xe242e54155b1abc71fc118065270cecaaf8b7768';
      await testTxPass(buildTxReq(txData))
      txData.to = 'e242e54155b1abc71fc118065270cecaaf8b7768';
      await testTxPass(buildTxReq(txData))
      txData.to = '01e242e54155b1abc71fc118065270cecaaf8b7768';
      await testTxFail(buildTxReq(txData))
    });

    it('Should test the range of `nonce`', async () => {
      const txData = JSON.parse(JSON.stringify(defaultTxData));
      
      // Expected passes
      txData.nonce = 0;
      await testTxPass(buildTxReq(txData))
      txData.nonce = 4294967295;
      await testTxPass(buildTxReq(txData))
      
      // Expected failures
      txData.nonce = 4294967296;
      await testTxFail(buildTxReq(txData))
    });

    it('Should test EIP155', async () => {
      const txData = JSON.parse(JSON.stringify(defaultTxData));
      await testTxPass(buildTxReq(txData, 4)) // Does NOT use EIP155
      await testTxPass(buildTxReq(txData, 1)) // Uses EIP155

      // Finally, make sure the `eip155` tag works. We will set it to false and
      // expect a result that does not include EIP155 in the payload.
      txData.eip155 = false;
      const numChainId = 10000;
      const chainId = `0x${numChainId.toString(16)}`; // 0x2710
      await testTxPass(buildTxReq(txData, chainId));
      const res = await testTxPass(buildTxReq(txData, chainId));
      // For non-EIP155 transactions, we expect `v` to be 27 or 28
      expect(res.sig.v.toString('hex')).to.oneOf([(27).toString(16), (28).toString(16)])
    });

  });
}

describe('Test random transaction data', function() {
  beforeEach(() => {
    expect(foundError).to.equal(false, 'Error found in prior test. Aborting.');
  })

  it.each(randomTxDataLabels, 'Random transactions %s', ['label'], async function(n, next) {
    const txData = randomTxData[n.number];
    try {
      await testTxPass(buildTxReq(txData, txData._network))
      setTimeout(() => { next() }, 2500);
    } catch (err) {
      setTimeout(() => { next(err) }, 2500);
    }
  })
})