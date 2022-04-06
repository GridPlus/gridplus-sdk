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
import { AbiCoder, Interface } from '@ethersproject/abi';
import { BN } from 'bn.js';
import { readFileSync } from 'fs';
import { keccak256 } from 'js-sha3';
import { jsonc } from 'jsonc';
import { question } from 'readline-sync';
import request from 'request-promise';
import { encode as rlpEncode, decode as rlpDecode } from 'rlp';
import secp256k1 from 'secp256k1';
import { HARDENED_OFFSET } from '../../src/constants'
import { Constants, Decoders } from '../../src/index'
import { randomBytes } from '../../src/util'
import { getEncodedPayload } from '../../src/genericSigning'
let test;
const coder = new AbiCoder();
const EVMDecoder = Decoders.EVM;


//---------------------------------------
// STATE DATA
//---------------------------------------
let DEFAULT_SIGNER, EVM_TYPES, vectors;
const req = {
  data: {
    curveType: Constants.SIGNING.CURVES.SECP256K1,
    hashType: Constants.SIGNING.HASHES.KECCAK256,
    encodingType: Constants.SIGNING.ENCODINGS.EVM,
    payload: null,
  }
};
let numDefsInitial = 0;
const encDefs = [], encDefsCalldata = [];

//---------------------------------------
// TESTS
//---------------------------------------
describe('Start EVM signing tests',  () => {
  test = global.test;
  DEFAULT_SIGNER = [
    test.helpers.BTC_PURPOSE_P2PKH,
    test.helpers.ETH_COIN,
    HARDENED_OFFSET,
    0,
    0,
  ];
  req.data.signerPath = DEFAULT_SIGNER;
  const globalVectors = jsonc.parse(readFileSync(
    `${process.cwd()}/test/signing/vectors.jsonc`
  ).toString());
  vectors = globalVectors.evm.calldata;
  // Copied from calldata/evm.ts (not exported there)
  EVM_TYPES = [ 
    null, 'address', 'bool', 'uint', 'int', 'bytes', 'string', 'tuple' 
  ];
  // Build data for next test sets
  for (let i = 0; i < vectors.canonicalNames.length; i++) {
    const name = vectors.canonicalNames[i];
    const selector = `0x${keccak256(name).slice(0, 8)}`;
    const encDef = EVMDecoder.parsers.parseCanonicalName(selector, name);
    encDefs.push(encDef);
    const { types, data } = convertDecoderToEthers(rlpDecode(encDef).slice(1));
    const calldata = coder.encode(types, data);
    encDefsCalldata.push(`${selector}${calldata.slice(2)}`);
  }
})

describe('[EVM] Test transactions', () => {
  describe('EIP1559', () => {
    beforeEach(() => {
      test.expect(test.continue).to.equal(true, 'Error in previous test.');
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
      req.common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.London })
    })

    it('Should test a basic transaction', async () => {
      await run(req)
    })

    it('Should test a Rinkeby transaction', async () => {
      req.common = new Common({ chain: Chain.Rinkeby, hardfork: Hardfork.London })
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
      test.expect(test.continue).to.equal(true, 'Error in previous test.');
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
      req.common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.London })
    })

    it('Should test a basic transaction', async () => {
      await run(req);
    })

    it('Should test a Rinkeby transaction', async () => {
      req.common = new Common({ chain: Chain.Rinkeby, hardfork: Hardfork.London })
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
      test.expect(test.continue).to.equal(true, 'Error in previous test.');
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
      test.expect(test.continue).to.equal(true, 'Error in previous test.');
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
      req.common = new Common({ chain: Chain.Mainnet, hardfork: Hardfork.London })
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
      const { extraDataFrameSz, extraDataMaxFrames, genericSigning } = test.fwConstants;
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
      test.expect(test.continue).to.equal(true, 'Error in previous test.');
      req.data.payload = null;
      req.data.signerPath = DEFAULT_SIGNER;
    })

    it('Should test random transactions', async () => {
      const randInt = ((n) => Math.floor(Math.random() * n));
      const randIntStr = (
        (nBytes, type) => new BN(
          randomBytes(randInt(nBytes)).toString('hex'), 16
        ).toString(type)
      );
      for (let i = 0; i < test.numIter; i++) {
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
      test.expect(test.continue).to.equal(true, 'Error in previous test.');
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
        chain: Chain.Mainnet, hardfork: Hardfork.London 
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
})

describe('[EVM] Test decoders', () => {
  describe('Test ABI decoder vectors', () => {
    beforeEach(() => {
      test.expect(test.continue).to.equal(true, 'Error in previous test.');
      req.data.payload = null;
      req.data.signerPath = DEFAULT_SIGNER;
      req.txData = {
        gasPrice: 1200000000,
        nonce: 0,
        gasLimit: 50000,
        to: '0xe242e54155b1abc71fc118065270cecaaf8b7768',
        value: 100,
        data: null,
      };
      test.continue = false;
    })

    // Validate that we can decode using Etherscan ABI info as well as 4byte canonical names.
    for (let i = 0; i < vectors.etherscanTxHashes.length; i++) {
      it(`(Etherscan + 4byte #${i}) ${vectors.etherscanTxHashes[i]}`, async () => {
        // Hashes on ETH mainnet that we will use to fetch full tx and ABI data with
        const getTxBase = 'https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash='
        const getAbiBase = 'https://api.etherscan.io/api?module=contract&action=getabi&address=';
        const fourByteBase = 'https://www.4byte.directory/api/v1/signatures?hex_signature=';
        let resp;
        // 1. First fetch the transaction details from etherscan. This is just to get
        // the calldata, so it would not be needed in a production environment
        // (since we already have the calldata).
        let getTxUrl = `${getTxBase}${vectors.etherscanTxHashes[i]}`;
        if (test.etherscanKey) {
          getTxUrl += `&apiKey=${test.etherscanKey}`;
        }
        resp = await request(getTxUrl);
        const tx = JSON.parse(resp).result;
        if (!test.etherscanKey) {
          // Need a timeout between requests if we don't have a key
          console.warn(
            'WARNING: No env.ETHERSCAN_KEY provided. Waiting 5s between requests...'
          )
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        // 2. Fetch the full ABI of the contract that the transaction interacted with.
        let getAbiUrl = `${getAbiBase}${tx.to}`;
        if (test.etherscanKey) {
          getAbiUrl += `&apiKey=${test.etherscanKey}`;
        }
        resp = await request(getAbiUrl);
        const funcSig = tx.input.slice(0, 10);
        const abi = JSON.parse(JSON.parse(resp).result);
        const def = EVMDecoder.parsers.parseSolidityJSONABI(funcSig, abi);
        if (!def) {
          throw new Error(
            `ERROR: Failed to decode ABI definition (${vectors.etherscanTxHashes[i]}). Skipping.`
          )
        }
        // 3. Test decoding using Etherscan ABI info
        // Check that ethers can decode this
        const funcName = rlpDecode(def)[0];
        if (ethersCanDecode(tx.input, resp, funcName.toString())) {
          // Send the request
          req.txData.data = tx.input;
          req.data.decoder = def
          await run(req);
        } else {
          throw new Error(
            `ERROR: ethers.js failed to decode abi for tx ${vectors.etherscanTxHashes[i]}. Skipping.` 
          );
        }
        // 4. Get the canonical name from 4byte
        resp = await request(`${fourByteBase}${funcSig}`);
        const fourByteResults = JSON.parse(resp).results;
        if (fourByteResults.length > 0) {
          console.warn('WARNING: There are multiple results. Using the first one.');
        }
        const canonicalName = fourByteResults[0].text_signature;
        // 5. Convert the decoder data and make a request to the Lattice
        req.data.decoder = EVMDecoder.parsers.parseCanonicalName(funcSig, canonicalName);
        await run(req);
      })
    }

    // Validate a series of canonical definitions
    for (let i = 0; i < vectors.canonicalNames.length; i++) {
      it(`(Canonical #${i}) ${vectors.canonicalNames[i]}`, async () => {
        req.txData.data = encDefsCalldata[i];
        req.data.decoder = encDefs[i];
        // The following prints are helpful for debugging.
        // If you are testing changes to the ABI decoder in firmware, you
        // should uncomment these prints and validate that the `data` matches
        // what you see on the screen for each case. Please scroll through
        // ALL the data on the Lattice to confirm each param has properly decoded.
        const { types, data } = convertDecoderToEthers(rlpDecode(req.data.decoder).slice(1));
        console.log('types', types)
        console.log('params', JSON.stringify(data))
        // for (let cd = 2; cd < calldata.length; cd += 64) {
        //   console.log(calldata.slice(cd, cd + 64));
        // }
        await run(req);
      })
    }

    // Test committing decoder data
    it('Should save the first 10 defs', async () => {
      const decoderType = Decoders.EVM.type;
      const rm = question(
        'Do you want to remove all previously saved definitions? (Y/N) '
      );
      if (rm.toUpperCase() === 'Y') {
        await test.client.removeDecoders({ decoderType, rmAll: true })
      }
      // First determine how many defs there are already
      let saved = await test.client.getDecoders({ decoderType });
      numDefsInitial = saved.total;
      await test.client.addDecoders({ decoderType, decoders: encDefs.slice(0, 10) });
      saved = await test.client.getDecoders({ decoderType, n: 10 });
      test.expect(saved.total).to.equal(numDefsInitial + 10);
      for (let i = 0; i < saved.decoders.length; i++) {
        test.expect(saved.decoders[i].toString('hex')).to.equal(encDefs[i].toString('hex'));
      }
      await test.client.addDecoders({ decoderType, decoders: encDefs.slice(0, 10) });
      saved = await test.client.getDecoders({ decoderType, n: 10 });
      test.expect(saved.total).to.equal(numDefsInitial + 10);
      for (let i = 0; i < saved.decoders.length; i++) {
        test.expect(saved.decoders[i].toString('hex')).to.equal(encDefs[i].toString('hex'));
      }
      test.continue = true;
    })

    it('Should decode saved defs with check marks', async () => {
      question(
        'Please REJECT if decoded params do not show check marks. Press ENT to continue.'
      );
      // Test expected passes
      req.txData.data = encDefsCalldata[0];
      req.data.decoder = encDefs[0];
      await run(req);
      req.txData.data = encDefsCalldata[9];
      req.data.decoder = encDefs[9];
      await run(req);
      // Test expected failure
      req.txData.data = encDefsCalldata[10];
      req.data.decoder = encDefs[10];
      await run(req, true);
      test.continue = true;
    })
    it('Should fetch the first 10 defs', async () => {
      const decoderType = Decoders.EVM.type;
      const { total, decoders } = await test.client.getDecoders({ 
        decoderType, startIdx: numDefsInitial, n: 10 
      });
      test.expect(total).to.equal(numDefsInitial + 10);
      test.expect(decoders.length).to.equal(10);
      for (let i = 0; i < decoders.length; i++) {
        test.expect(decoders[i].toString('hex')).to.equal(encDefs[i].toString('hex'));
      }
      test.continue = true;
    })

    it('Should remove the saved defs', async () => {
      const decoderType = Decoders.EVM.type;
      // Remove the first 5 defs
      await test.client.removeDecoders({ decoderType, decoders: encDefs.slice(0, 5) })
      // There should be 5 defs remaining
      const { total, decoders } = await test.client.getDecoders({ 
        decoderType, startIdx: numDefsInitial, n: 10 
      });
      test.expect(total).to.equal(numDefsInitial + 5);
      test.expect(decoders.length).to.equal(5);
      // Remove the latter 5
      await test.client.removeDecoders({ decoderType, decoders: encDefs.slice(5, 10) })
      const { total, decoders } = await test.client.getDecoders({ 
        decoderType, startIdx: numDefsInitial, n: 10 
      });
      // There should be no more new defs
      test.expect(total).to.equal(numDefsInitial);
      test.expect(decoders.length).to.equal(0);
      // Test to make sure the check marks do not appear
      question(
        'Please REJECT if decoded params do not show check marks. Press ENT to continue.'
      );
      req.txData.data = encDefsCalldata[0];
      req.data.decoder = encDefs[0];
      await run(req, true);
      req.txData.data = encDefsCalldata[9];
      req.data.decoder = encDefs[9];
      await run(req, true);
    })

  })
})

//---------------------------------------
// INTERNAL HELPERS
//---------------------------------------
// Determine if ethers.js can decode calldata using an ABI def
function ethersCanDecode(calldata, etherscanResp, funcName) {
  try {
    const abi = JSON.parse(etherscanResp).result;
    const iface = new Interface(JSON.parse(abi));
    iface.decodeFunctionData(funcName, calldata);
    return true;
  } catch (err) {
    return false;
  }
}

// Convert a decoder definition to something ethers can consume
function convertDecoderToEthers(def) {
  const converted = getConvertedDef(def);
  const types = [], data = [];
  converted.forEach((i) => {
    types.push(i.type);
    data.push(i.data);
  })
  return { types, data };
}

// Convert an encoded def into a combination of ethers-compatable 
// type names and data fields. The data should be random but it
// doesn't matter much for these tests, which mainly just test
// structure of the definitions
function getConvertedDef(def) {
  const converted = [];
  def.forEach((param) => {
    const arrSzs = param[3];
    const evmType = EVM_TYPES[parseInt(param[1].toString('hex'), 16)];
    let type = evmType;
    const numBytes = parseInt(param[2].toString('hex'), 16);
    if (numBytes > 0) {
      type = `${type}${numBytes * 8}`;
    }
    // Handle tuples by recursively generating data
    let tupleData;
    if (evmType === 'tuple') {
      tupleData = [];
      type = `${type}(`
      const tupleDef = getConvertedDef(param[4]);
      tupleDef.forEach((tupleParam) => {
        type = `${type}${tupleParam.type}, `
        tupleData.push(tupleParam.data);
      });
      type = type.slice(0, type.length - 2);
      type = `${type})`;
    }
    // Get the data of a single function (i.e. excluding arrays)
    const funcData = tupleData ? tupleData : genParamData(param);
    // Apply the data to arrays
    for (let i = 0; i < arrSzs.length; i++) {
      let sz = parseInt(arrSzs[i].toString('hex'));
      if (isNaN(sz)) {
        // This is a 0 size, which means we need to
        // define a size to generate data
        type = `${type}[]`;
      } else {
        type = `${type}[${sz}]`;
      }
    }
    // If this param is a tuple we need to copy base data
    // across all dimensions. The individual params are already
    // arraified this way, but not the tuple type
    if (tupleData) {
      converted.push({ type, data: getArrayData(param, funcData) });
    } else {
      converted.push({ type, data: funcData });
    }
  })
  return converted;
}

function genTupleData(tupleParam) {
  const nestedData = [];
  tupleParam.forEach((nestedParam) => {
    nestedData.push(
      genData(
        EVM_TYPES[parseInt(nestedParam[1].toString('hex'), 16)],
        nestedParam
      )
    )
  })
  return nestedData;
}

function genParamData(param) {
  const evmType = EVM_TYPES[parseInt(param[1].toString('hex'), 16)];
  const baseData = genData(evmType, param);
  return getArrayData(param, baseData);
}

function getArrayData(param, baseData) {
  let arrayData, data;
  const arrSzs = param[3];
  for (let i = 0; i < arrSzs.length; i++) {
    let sz = parseInt(arrSzs[i].toString('hex'));
    const dimData = [];
    let sz = parseInt(param[3][i].toString('hex'));
    if (isNaN(sz)) {
      sz = 2 //1;
    }
    if (!arrayData) {
      arrayData = [];
    }
    const lastDimData = JSON.parse(JSON.stringify(arrayData));
    for (let j = 0; j < sz; j++) {
      if (i === 0) {
        dimData.push(baseData);
      } else {
        dimData.push(lastDimData);
      }
    }
    arrayData = dimData;
  }
  if (!data) {
    data = arrayData ? arrayData : baseData;
  }
  return data;
}

function genData(type, param) {
  switch (type) {
    case 'address':
      return '0xdead00000000000000000000000000000000beef';
    case 'bool':
      return true;
    case 'uint':
      return 9;
    case 'int':
      return -9;
    case 'bytes':
      return '0xdeadbeef';
    case 'string':
      return 'string';
    case 'tuple':
      if (!param || param.length < 4) {
        throw new Error('Invalid tuple data');
      }
      return genTupleData(param[4]);
    default:
      throw new Error('Unrecognized type');
  }
}

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
  test.continue = false;
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
    const resp = await test.client.sign(req);
    if (shouldFail) {
      // Exit here without continuing tests. If this block is reached it indicates
      // the Lattice did not throw an error when we expected it to do so.
      return;
    }
    const encodingType = req.data.encodingType || null; 
    const allowedEncodings = test.fwConstants.genericSigning.encodingTypes;
    const { payloadBuf } = getEncodedPayload(req.data.payload, encodingType, allowedEncodings);
    if (useLegacySigning) {
      // [TODO: Deprecate]
      req.data.curveType = Constants.SIGNING.CURVES.SECP256K1;
      req.data.hashType = Constants.SIGNING.HASHES.KECCAK256;
      req.data.encodingType = Constants.SIGNING.ENCODINGS.EVM;
    }
    test.helpers.validateGenericSig(test.seed, resp.sig, payloadBuf, req.data);
    // Sign the original tx and compare
    const { priv } = test.helpers.deriveSECP256K1Key(req.data.signerPath, test.seed);
    const signedTx = tx.sign(priv);
    test.expect(signedTx.verifySignature()).to.equal(true, 'Signature failed to verify');
    const refR = Buffer.from(signedTx.r.toBuffer());
    const refS = Buffer.from(signedTx.s.toBuffer());
    const refV = signedTx.v;
    // Get params from Lattice sig
    const latticeR = Buffer.from(resp.sig.r);
    const latticeS = Buffer.from(resp.sig.s);
    const latticeV = getV(tx, resp);
    // Strip off leading zeros to do an exact componenet check.
    // We will still validate the original lattice sig in a tx.
    const rToCheck =  latticeR.length !== refR.length ?
                      latticeR.slice(latticeR.length - refR.length) :
                      latticeR;
    const sToCheck =  latticeS.length !== refS.length ?
                      latticeS.slice(latticeS.length - refS.length) :
                      latticeS;
    // Validate the signature
    test.expect(rToCheck.equals(refR)).to.equal(
      true, 
      'Signature R component does not match reference'
    );
    test.expect(sToCheck.equals(refS)).to.equal(
      true, 
      'Signature S component does not match reference'
    );
    test.expect(new BN(latticeV).eq(refV)).to.equal(
      true,
      'Signature V component does not match reference'
    );
    // One more check -- create a new tx with the signatre params and verify it
    const signedTxData = JSON.parse(JSON.stringify(txData));
    signedTxData.v = latticeV;
    signedTxData.r = latticeR;
    signedTxData.s = latticeS;
    const verifTx = EthTxFactory.fromTxData(signedTxData, { common: req.common });
    test.expect(verifTx.verifySignature()).to.equal(
      true,
      'Signature did not validate in recreated @ethereumjs/tx object'
    );
  } catch (err) {
    if (shouldFail) {
      test.continue = true;
      return;
    }
    test.expect(err).to.equal(null, err);
  }
  test.continue = !shouldFail;
}