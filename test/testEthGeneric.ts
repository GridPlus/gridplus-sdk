/**
Test generic signing, which allows a signature on the secp256k1 or ed25519 curve.
We seek to validate:
1. Signature on data can be reproduced locally with the derived key
2. Signature on data representing ETH tx matches the ETH route itself
3. Many random signatures can be validated

You must have `FEATURE_TEST_RUNNER=0` enabled in firmware to run these tests.
 */
import Common, { Chain, Hardfork } from '@ethereumjs/common';
import { 
  TransactionFactory as EthTxFactory,
  Capability as EthTxCapability,
} from '@ethereumjs/tx';
import { BN } from 'bn.js';
import { expect } from 'chai';
import { encode as rlpEncode } from 'rlp';
import secp256k1 from 'secp256k1';
import helpers from './testUtil/helpers';
import { getFwVersionConst, HARDENED_OFFSET } from '../src/constants'
import { Constants } from '../src/index'
import { randomBytes } from '../src/util'
import { getEncodedPayload } from '../src/genericSigning'

let client, seed, fwConstants, continueTests = true;
const DEFAULT_SIGNER = [
  helpers.BTC_PURPOSE_P2PKH,
  helpers.ETH_COIN,
  HARDENED_OFFSET,
  0,
  0,
];
const req = {
  data: {
    signerPath: DEFAULT_SIGNER,
    curveType: Constants.SIGNING.CURVES.SECP256K1,
    hashType: Constants.SIGNING.HASHES.KECCAK256,
    encodingType: Constants.SIGNING.ENCODINGS.EVM,
    payload: null,
  }
};

// Various methods for fetching a chainID from different @ethereumjs/tx objects
function getTxChainId (tx) {
  if (tx.common && typeof tx.common.chainIdBN === 'function') {
    return tx.common.chainIdBN();
  } else if (tx.chainId) {
    return new BN(tx.chainId);
  }
  // No chain id
  return null;
}

// Get the `v` component of the signature as well as an `initV`
// parameter, which is what you need to use to re-create an @ethereumjs/tx
// object. There is a lot of tech debt in @ethereumjs/tx which also
// inherits the tech debt of ethereumjs-util.
// *  The legacy `Transaction` type can call `_processSignature` with the regular
//    `v` value.
// *  Newer transaction types such as `FeeMarketEIP1559Transaction` will subtract
//    27 from the `v` that gets passed in, so we need to add `27` to create `initV`
function getV(tx, resp) {
  const hash = tx.getMessageToSign(true);
  const rs = new Uint8Array(Buffer.concat([ resp.sig.r, resp.sig.s ]))
  const pubkey = new Uint8Array(resp.pubkey);
  const recovery0 = secp256k1.ecdsaRecover(rs, 0, hash, false);
  const recovery1 = secp256k1.ecdsaRecover(rs, 1, hash, false);
  const pubkeyStr = Buffer.from(pubkey).toString('hex');
  const recovery0Str = Buffer.from(recovery0).toString('hex');
  const recovery1Str = Buffer.from(recovery1).toString('hex');
  let recovery;
  if (pubkeyStr === recovery0Str) {
    recovery = 0
  } else if (pubkeyStr === recovery1Str) {
    recovery = 1;
  } else {
    return null;
  }
  // Newer transaction types just use the [0, 1] value
  if (tx._type) {
    return new BN(recovery);
  }
  // Legacy transactions should check for EIP155 support.
  // In practice, virtually every transaction should have EIP155
  // support since that hardfork happened in 2016...
  const chainId = getTxChainId(tx);
  if (!chainId || !tx.supports(EthTxCapability.EIP155ReplayProtection)) {
    return new BN(recovery).addn(27);
  }
  // EIP155 replay protection is included in the `v` param
  // and uses the chainId value.
  return chainId.muln(2).addn(35).addn(recovery);
}

async function run(req, shouldFail=false, bypassSetPayload=false, useLegacySigning=false) {
  continueTests = false;
  try {
    // Construct an @ethereumjs/tx object with data
    const txData = JSON.parse(JSON.stringify(req.txData));
    const tx = EthTxFactory.fromTxData(txData, { common: req.common });
    if (useLegacySigning) {
      // [TODO: Deprecate]
      req.data = {
        ...req.data,
        ...req.txData,
      }
    }
    if (tx._type === 0 && !bypassSetPayload) {
      // The @ethereumjs/tx Transaction APIs differ here
      // Legacy transaction
      req.data.payload = rlpEncode(tx.getMessageToSign(false))
    } else if (!bypassSetPayload) {
      // Newer transaction type
      req.data.payload = tx.getMessageToSign(false);
    }
    // Request signature and validate it
    const resp = await client.sign(req);
    if (shouldFail) {
      // Exit here without continuing tests. If this block is reached it indicates
      // the Lattice did not throw an error when we expected it to do so.
      return;
    }
    const encodingType = req.data.encodingType || null; 
    const allowedEncodings = fwConstants.genericSigning.encodingTypes;
    const { payloadBuf } = getEncodedPayload(req.data.payload, encodingType, allowedEncodings);
    if (useLegacySigning) {
      // [TODO: Deprecate]
      req.data.curveType = Constants.SIGNING.CURVES.SECP256K1;
      req.data.hashType = Constants.SIGNING.HASHES.KECCAK256;
      req.data.encodingType = Constants.SIGNING.ENCODINGS.EVM;
    }
    helpers.validateGenericSig(seed, resp.sig, payloadBuf, req.data);
    // Sign the original tx and compare
    const { priv } = helpers.deriveSECP256K1Key(req.data.signerPath, seed);
    const signedTx = tx.sign(priv);
    expect(signedTx.verifySignature()).to.equal(true, 'Signature failed to verify');
    const refR = Buffer.from(signedTx.r.toBuffer());
    const refS = Buffer.from(signedTx.s.toBuffer());
    const refV = signedTx.v;
    // Get params from Lattice sig
    const latticeR = Buffer.from(resp.sig.r);
    const latticeS = Buffer.from(resp.sig.s);
    const latticeV = getV(tx, resp);
    // Validate the signature
    expect(latticeR.equals(refR)).to.equal(
      true, 
      'Signature R component does not match reference'
    );
    expect(latticeS.equals(refS)).to.equal(
      true, 
      'Signature S component does not match reference'
    );
    expect(new BN(latticeV).eq(refV)).to.equal(
      true,
      'Signature V component does not match reference'
    );
    // One more check -- create a new tx with the signatre params and verify it
    const signedTxData = JSON.parse(JSON.stringify(txData));
    signedTxData.v = latticeV;
    signedTxData.r = latticeR;
    signedTxData.s = latticeS;
    const verifTx = EthTxFactory.fromTxData(signedTxData, { common: req.common });
    expect(verifTx.verifySignature()).to.equal(
      true,
      'Signature did not validate in recreated @ethereumjs/tx object'
    );
  } catch (err) {
    if (shouldFail) {
      continueTests = true;
      return;
    }
    expect(err).to.equal(null, err);
  }
  continueTests = !shouldFail;
}

describe('Setup client', () => {
  it('Should setup the test client', () => {
    client = helpers.setupTestClient(process.env);
    expect(client).to.not.equal(null);
  })

  it('Should connect to a Lattice and make sure it is already paired.', async () => {
    // Again, we assume that if an `id` has already been set, we are paired
    // with the hardcoded privkey above.
    continueTests = false;
    expect(process.env.DEVICE_ID).to.not.equal(null);
    const isPaired = await client.connect(process.env.DEVICE_ID);
    expect(isPaired).to.equal(true);
    expect(client.isPaired).to.equal(true);
    expect(client.hasActiveWallet()).to.equal(true);
    // Set the correct max gas price based on firmware version
    fwConstants = getFwVersionConst(client.fwVersion);
    if (!fwConstants.genericSigning) {
      continueTests = false;
      expect(true).to.equal(false, 'Firmware must be updated to run this test.')
    }
    continueTests = true;
  })
})

describe('Export seed', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Error in previous test.');
  })

  it('Should export the seed', async () => {
    const activeWalletUID = helpers.copyBuffer(client.getActiveWallet().uid);
    const jobType = helpers.jobTypes.WALLET_JOB_EXPORT_SEED;
    const jobData = {};
    const jobReq = {
      testID: 0, // wallet_job test ID
      payload: helpers.serializeJobData(jobType, activeWalletUID, jobData),
    };
    const res = await client.test(jobReq);
    const _res = helpers.parseWalletJobResp(res, client.fwVersion);
    continueTests = _res.resultStatus === 0;
    expect(_res.resultStatus).to.equal(0);
    const data = helpers.deserializeExportSeedJobResult(_res.result);
    seed = helpers.copyBuffer(data.seed);
  })
})

describe('EIP1559', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Error in previous test.');
    req.data.payload = null;
    req.txData = {
      type: 2,
      maxFeePerGas: 1200000000,
      maxPriorityFeePerGas: 1200000000,
      nonce: 0,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 100,
      data: '0xdeadbeef',
    };
    req.common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Shanghai })
  })

  it('Should test a basic transaction', async () => {
    await run(req)
  })

  it('Should test a Rinkeby transaction', async () => {
    req.common = new Common({ chain: Chain.Rinkeby, hardfork: Hardfork.Shanghai })
    await run(req)
  })

  it('Should test a transaction with an access list', async () => {
    req.txData.accessList = [
      {
        address: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
        storageKeys: [
          '0x7154f8b310ad6ce97ce3b15e3419d9863865dfe2d8635802f7f4a52a206255a6',
        ],
      },
      {
        address: '0xe0f8ff08ef0242c461da688b8b85e438db724860',
        storageKeys: [],
      },
    ];
    await run(req)
  })
})

describe('EIP2930', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Error in previous test.');
    req.data.payload = null;
    req.txData = {
      type: 1,
      gasPrice: 1200000000,
      nonce: 0,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 100,
      data: '0xdeadbeef',
    };
    req.common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Shanghai })
  })

  it('Should test a basic transaction', async () => {
    await run(req);
  })

  it('Should test a Rinkeby transaction', async () => {
    req.common = new Common({ chain: Chain.Rinkeby, hardfork: Hardfork.Shanghai })
    await run(req);
  })

  it('Should test a transaction with an access list', async () => {
    req.txData.accessList = [
      {
        address: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
        storageKeys: [
          '0x7154f8b310ad6ce97ce3b15e3419d9863865dfe2d8635802f7f4a52a206255a6',
        ],
      },
      {
        address: '0xe0f8ff08ef0242c461da688b8b85e438db724860',
        storageKeys: [],
      },
    ];
    await run(req);
  })
})

describe('Legacy (Non-EIP155)', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Error in previous test.');
    req.data.payload = null;
    req.data.signerPath = DEFAULT_SIGNER;
    req.txData = {
      gasPrice: 1200000000,
      nonce: 0,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 100,
      data: '0xdeadbeef',
    };
    req.common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Homestead })
  })

  it('Should test a transaction that does not use EIP155', async () => {
    await run(req);
  });
})

describe('Boundary tests', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Error in previous test.');
    req.data.payload = null;
    req.data.signerPath = DEFAULT_SIGNER;
    req.txData = {
      gasPrice: 1200000000,
      nonce: 0,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 100,
      data: '0xdeadbeef',
    };
    req.common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.Shanghai })
  })

  it('Should test shorter derivation paths', async () => {
    req.data.signerPath = DEFAULT_SIGNER.slice(0, 3);
    await run(req);
    req.data.signerPath = DEFAULT_SIGNER.slice(0, 2);
    await run(req);
    req.data.signerPath = DEFAULT_SIGNER.slice(0, 1);
    await run(req);
    req.data.signerPath = [];
    await run(req, true);
  })

  it('Should test other chains', async () => {
    // Polygon
    req.common = Common.custom({ chainId: 137 });
    await run(req);
    // BSC
    req.common = Common.custom({ chainId: 56 });
    await run(req);
    // Avalanche
    req.common = Common.custom({ chainId: 43114 });
    await run(req);
    // Palm
    req.common = Common.custom({ chainId: 11297108109 });
    await run(req);
    // Unknown chain
    req.common = Common.custom({ chainId: 9999});
    await run(req);
    // Unknown chain (max chainID, i.e. UINT64_MAX - 1)
    req.common = Common.custom({ chainId: '18446744073709551615' })
    await run(req);
    // Unknown chain (chainID too large)
    req.common = Common.custom({ chainId: '18446744073709551616' })
    await run(req, true);
  })

  it('Should test range of `value`', async () => {
    req.txData.value = 1;
    await run(req);
    req.txData.value = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    await run(req);
  })

  it('Should test range of `data` size', async () => {
    const { extraDataFrameSz, extraDataMaxFrames, genericSigning } = fwConstants;
    const { baseDataSz } = genericSigning;
    // Max size of total payload
    const maxSz = baseDataSz + (extraDataMaxFrames * extraDataFrameSz);
    // Infer the max `data` size
    req.txData.data = null;
    const dummyTx = EthTxFactory.fromTxData(req.txData, { common: req.common });
    const dummyTxSz = rlpEncode(dummyTx.getMessageToSign(false)).length;
    const rlpPrefixSz = 4; // 1 byte for descriptor, 1 byte for llength, 2 bytes for length
    const maxDataSz = maxSz - dummyTxSz - rlpPrefixSz;

    // No data
    req.txData.data = null;
    await run(req);
    // Max payload size
    req.txData.data = `0x${randomBytes(maxDataSz).toString('hex')}`;
    await run(req);
    // Min prehash size
    req.txData.data = `0x${randomBytes(maxDataSz + 1).toString('hex')}`;
    await run(req);
  })

  it('Should test contract deployment', async () => {
    req.txData.to = null;
    req.txData.data = `0x${randomBytes(96).toString('hex')}`;
    await run(req)
  })

  it('Should test direct RLP-encoded payoads with bad params', async () => {
    const tx = EthTxFactory.fromTxData(req.txData, { common: req.common });
    let params = tx.getMessageToSign(false);

    const oversizedInt = Buffer.from(
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff01',
      'hex'
    );
    // Test numerical values >32 bytes
    // ---
    // Nonce
    params[0] = oversizedInt;
    req.data.payload = rlpEncode(params);
    await run(req, true, true);
    params = tx.getMessageToSign(false);
    // Gas
    params[1] = oversizedInt;
    req.data.payload = rlpEncode(params);
    await run(req, true, true);
    params = tx.getMessageToSign(false);
    // Gas Price
    params[2] = oversizedInt;
    req.data.payload = rlpEncode(params);
    await run(req, true, true);
    params = tx.getMessageToSign(false);
    // Value
    params[4] = oversizedInt;
    req.data.payload = rlpEncode(params);
    await run(req, true, true);
    params = tx.getMessageToSign(false);
    // Test wrong sized addresses
    // ---
    params[3] = Buffer.from('e242e54155b1abc71fc118065270cecaaf8b77', 'hex');
    req.data.payload = rlpEncode(params);
    await run(req, true, true);
    params = tx.getMessageToSign(false);
    params[3] = Buffer.from('e242e54155b1abc71fc118065270cecaaf8b770102', 'hex');
    req.data.payload = rlpEncode(params);
    await run(req, true, true);
    params = tx.getMessageToSign(false);
  })
})

describe('Random Transactions', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Error in previous test.');
    req.data.payload = null;
    req.data.signerPath = DEFAULT_SIGNER;
  })

  it('Should test random transactions', async () => {
    const numRandom = process.env.N || 5;
    const randInt = ((n) => Math.floor(Math.random() * n));
    const randIntStr = (
      (nBytes, type) => new BN(
        randomBytes(randInt(nBytes)).toString('hex'), 16
      ).toString(type)
    );
    for (let i = 0; i < numRandom; i++) {
      req.txData = {
        nonce: `0x${randIntStr(4, 'hex')}`,
        gasPrice: `0x${randIntStr(8, 'hex')}`,
        gas: `0x${randIntStr(4, 'hex')}`,
        value: `0x${randIntStr(32, 'hex')}`,
        to: `0x${randomBytes(20).toString('hex')}`,
        data: `0x${randomBytes(randInt(2000)).toString('hex')}`,
      };
      req.common = Common.custom({
        chainId: randIntStr(8),
      });
      await run(req);
    }
  });
})

describe('[TODO: deprecate] Test Legacy Pathway (while it still exists)', () => {
  beforeEach(() => {
    expect(continueTests).to.equal(true, 'Error in previous test.');
    req.currency = 'ETH';
    req.data = {
      payload: null,
      signerPath: DEFAULT_SIGNER,
    }
    req.txData = {
      chainId: 1,
      gasPrice: 1200000000,
      nonce: 0,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 100,
      data: '0xdeadbeef',
    };
    req.common = new Common({ 
      chain: Chain.Mainnet, hardfork: Hardfork.Shanghai 
    });
  })

  it('Should test legacy signing for legacy EIP155 transaction', async () => {
    await run(req, null, null, true);
  })

  it('Should test legacy signing for EIP1559', async () => {
    req.txData = {
      chainId: 1,
      type: 2,
      maxFeePerGas: 1200000000,
      maxPriorityFeePerGas: 1200000000,
      nonce: 0,
      gasLimit: 50000,
      to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
      value: 100,
      data: '0xdeadbeef',
    };
    await run(req, null, null, true);
  })

  it('Should test a Polygon transaction (chainId=137)', async () => {
    req.txData.chainId = 137;
    req.common = Common.custom({ chainId: req.txData.chainId });
    await run(req, null, null, true);
  });
})
